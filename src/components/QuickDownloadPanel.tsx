import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import {
  CheckCircle2,
  ClipboardPaste,
  Cookie,
  Download,
  ExternalLink,
  FolderOpen,
  Link2,
  ListMusic,
  LoaderCircle,
  X,
} from "lucide-react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { toast } from "sonner";
import { MotionButton } from "@/components/motion/MotionButton";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDownloadsStore } from "@/store/downloads";
import { usePresetsStore } from "@/store/presets";
import { useSettingsStore } from "@/store/settings";
import { useNavigationStore } from "@/store/navigation";
import { useRuntimeStore } from "@/store/runtime";
import { useToolsStore } from "@/store/tools";
import { buildSubtitleSummary } from "@/lib/subtitles";
import {
  getPresetSubtitleDetail,
  getQuickEligiblePresets,
  groupPresetsForSelect,
  resolveExistingPresetId,
  resolvePresetById,
} from "@/lib/preset-display";
import {
  cookiesEnabled,
  fetchMediaInfo,
  fetchMetadata,
  looksLikePlaylistUrl,
  pickSupportedUrlFromText,
  quickProbeMediaUrl,
  startQueuedJobs,
} from "@/lib/downloader";
import { hideMainWindowToTray, readTextFromClipboard, restoreMainWindow } from "@/lib/commands";
import { normalizeUrlIdentity } from "@/lib/url-identity";

type ClipboardStatus = "idle" | "reading" | "ready" | "empty" | "error";

export function QuickDownloadPanel() {
  const settings = useSettingsStore((state) => state.settings);
  const presets = usePresetsStore((state) => state.presets);
  const tools = useToolsStore((state) => state.tools);
  const addJob = useDownloadsStore((state) => state.addJob);
  const setComposeDraft = useDownloadsStore((state) => state.setComposeDraft);
  const setScreen = useNavigationStore((state) => state.setScreen);
  const { quickDraft, closeQuickMode, restoreFullMode } = useRuntimeStore();

  const quickPresets = useMemo(() => getQuickEligiblePresets(presets), [presets]);
  const quickPresetGroups = useMemo(() => groupPresetsForSelect(quickPresets), [quickPresets]);

  const [url, setUrl] = useState(quickDraft?.url?.trim() || "");
  const [presetId, setPresetId] = useState(
    resolveExistingPresetId(quickPresets, quickDraft?.presetId || settings.quickDefaultPreset || "default")
  );
  const [clipboardUrl, setClipboardUrl] = useState<string | null>(null);
  const [clipboardStatus, setClipboardStatus] = useState<ClipboardStatus>("idle");
  const [submitting, setSubmitting] = useState(false);
  const [titleHint, setTitleHint] = useState<string | null>(null);
  const [titleStatus, setTitleStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");

  const lastAutoFilledNormRef = useRef<string | null>(null);
  const urlUserEditedRef = useRef(Boolean(quickDraft?.url?.trim()));
  const clipboardRequestRef = useRef(0);
  const titleRequestRef = useRef(0);

  const ytDlpTool = tools.find((tool) => tool.id === "yt-dlp");
  const ytDlpMissing = ytDlpTool?.status === "Missing";
  const ytDlpChecking = ytDlpTool?.status === "Checking";
  const cookiesOn = cookiesEnabled();
  const playlistLike = Boolean(url.trim()) && looksLikePlaylistUrl(url.trim());
  const supportedFromField = pickSupportedUrlFromText(url);
  const probe = url.trim() ? quickProbeMediaUrl(url.trim()) : "unsupported";

  const refreshClipboardUrl = useCallback(
    async (options?: { applyToField?: boolean }) => {
      const requestId = clipboardRequestRef.current + 1;
      clipboardRequestRef.current = requestId;
      setClipboardStatus("reading");

      try {
        const text = await readTextFromClipboard();
        if (clipboardRequestRef.current !== requestId) return;

        const supported = pickSupportedUrlFromText(text);
        if (!supported) {
          setClipboardUrl(null);
          setClipboardStatus("empty");
          return;
        }

        setClipboardUrl(supported);
        setClipboardStatus("ready");

        if (options?.applyToField === false) return;
        if (quickDraft?.url?.trim() && options?.applyToField !== true) return;

        const supportedNorm = normalizeUrlIdentity(supported);
        setUrl((current) => {
          const currentTrim = current.trim();
          if (!currentTrim) {
            lastAutoFilledNormRef.current = supportedNorm;
            urlUserEditedRef.current = false;
            return supported;
          }
          if (urlUserEditedRef.current) return current;

          const currentNorm = normalizeUrlIdentity(currentTrim);
          // Replace emptyish or previous auto-fill with newer clipboard.
          if (
            lastAutoFilledNormRef.current == null ||
            lastAutoFilledNormRef.current === currentNorm ||
            options?.applyToField === true
          ) {
            lastAutoFilledNormRef.current = supportedNorm;
            return supported;
          }
          return current;
        });
      } catch {
        if (clipboardRequestRef.current !== requestId) return;
        setClipboardUrl(null);
        setClipboardStatus("error");
      }
    },
    [quickDraft?.url]
  );

  useEffect(() => {
    lastAutoFilledNormRef.current = null;
    urlUserEditedRef.current = Boolean(quickDraft?.url?.trim());
    if (quickDraft?.url?.trim()) {
      setUrl(quickDraft.url.trim());
    }
    setPresetId(
      resolveExistingPresetId(
        quickPresets,
        quickDraft?.presetId || settings.quickDefaultPreset || "default"
      )
    );
    const apply =
      !quickDraft?.url?.trim() && settings.autoPasteLinks !== false;
    void refreshClipboardUrl({ applyToField: apply });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per session mount
  }, []);

  useEffect(() => {
    const pollId = window.setInterval(() => {
      void refreshClipboardUrl({
        applyToField: settings.autoPasteLinks !== false && !urlUserEditedRef.current,
      });
    }, 900);
    return () => window.clearInterval(pollId);
  }, [refreshClipboardUrl, settings.autoPasteLinks]);

  useEffect(() => {
    const trimmed = url.trim();
    const requestId = titleRequestRef.current + 1;
    titleRequestRef.current = requestId;

    if (!trimmed || looksLikePlaylistUrl(trimmed) || !pickSupportedUrlFromText(trimmed)) {
      setTitleHint(null);
      setTitleStatus("idle");
      return;
    }

    const loadingTimer = window.setTimeout(() => {
      if (titleRequestRef.current !== requestId) return;
      setTitleStatus("loading");
      setTitleHint(null);
    }, 0);

    const fetchTimer = window.setTimeout(() => {
      fetchMediaInfo(trimmed)
        .then((info) => {
          if (titleRequestRef.current !== requestId) return;
          const title = info.title?.trim();
          setTitleHint(title || null);
          setTitleStatus(title ? "ready" : "error");
        })
        .catch(() => {
          if (titleRequestRef.current !== requestId) return;
          setTitleHint(null);
          setTitleStatus("error");
        });
    }, 450);

    return () => {
      window.clearTimeout(loadingTimer);
      window.clearTimeout(fetchTimer);
    };
  }, [url]);

  const selectedPreset =
    resolvePresetById(quickPresets, presetId) ?? quickPresets[0] ?? presets[0];

  const subtitleSummary = selectedPreset
    ? buildSubtitleSummary({
        mode: selectedPreset.subtitleOnly ? "only" : selectedPreset.subtitleMode ?? "off",
        sourcePolicy: selectedPreset.subtitleSourcePolicy ?? "manual-then-auto",
        languageMode: selectedPreset.subtitleLanguageMode ?? "preferred",
        languages: selectedPreset.subtitleLanguages ?? ["en.*", "en"],
        format: selectedPreset.subtitleFormat ?? "srt",
      })
    : "No subtitles";
  const subtitleDetail = selectedPreset ? getPresetSubtitleDetail(selectedPreset) : "No subtitles";
  const quickSummary = [
    settings.quickDownloadDestinationMode === "ask" ? "Ask folder" : "Default folder",
    settings.quickDownloadStartMode === "start" ? "Start immediately" : "Queue first",
    subtitleSummary,
  ].join(" · ");

  const handleUrlChange = (value: string) => {
    urlUserEditedRef.current = true;
    lastAutoFilledNormRef.current = null;
    setUrl(value);
  };

  const handleCancel = useCallback(async () => {
    closeQuickMode();
    await hideMainWindowToTray().catch(() => {
      void 0;
    });
  }, [closeQuickMode]);

  const handleAdvanced = async () => {
    const target = (supportedFromField || url).trim();
    if (!target) {
      toast.error("Paste a media URL first.");
      return;
    }

    setComposeDraft({
      url: target,
      presetId: resolveExistingPresetId(quickPresets, presetId || settings.quickDefaultPreset || "default"),
      overrides: {
        origin: "tray",
      },
    });
    setScreen("downloads");
    restoreFullMode("downloads");
    await restoreMainWindow().catch(() => {
      void 0;
    });
  };

  const handleDownload = useCallback(async () => {
    if (submitting) return;
    const supportedUrl = pickSupportedUrlFromText(url);
    if (!supportedUrl) {
      toast.error("Paste a supported media URL first.");
      return;
    }
    if (looksLikePlaylistUrl(supportedUrl)) {
      toast.error("Playlist links need the full Downloads screen", {
        description: "Use Open Advanced to pick which videos to download.",
      });
      return;
    }
    if (ytDlpMissing) {
      toast.error("yt-dlp is missing", {
        description: "Open Tools to install yt-dlp, then try again.",
      });
      return;
    }

    setSubmitting(true);
    try {
      let downloadDir: string | undefined;
      if (settings.quickDownloadDestinationMode === "ask") {
        const selected = await openDialog({
          directory: true,
          multiple: false,
          defaultPath: settings.defaultDownloadDir || undefined,
        });
        if (!selected) {
          return;
        }
        if (!Array.isArray(selected)) {
          downloadDir = selected;
        }
      }

      const id = addJob(supportedUrl, resolveExistingPresetId(quickPresets, presetId), {
        ...(downloadDir ? { downloadDir } : {}),
        origin: "tray",
      });

      if (settings.quickDownloadStartMode === "start") {
        const started = startQueuedJobs([id], { ignoreQueuePaused: true });
        toast.success(started === 0 ? "Queued (waiting for a free slot)" : "Quick download started");
      } else {
        toast.success("Quick download queued");
      }
      void fetchMetadata(id);

      closeQuickMode();
      await hideMainWindowToTray().catch(() => {
        void 0;
      });
    } finally {
      setSubmitting(false);
    }
  }, [
    addJob,
    closeQuickMode,
    presetId,
    quickPresets,
    settings.defaultDownloadDir,
    settings.quickDownloadDestinationMode,
    settings.quickDownloadStartMode,
    submitting,
    url,
    ytDlpMissing,
  ]);

  const handleUrlKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Escape") {
        event.preventDefault();
        void handleCancel();
        return;
      }
      if (event.key !== "Enter") return;
      event.preventDefault();
      void handleDownload();
    },
    [handleCancel, handleDownload]
  );

  const downloadDisabled =
    submitting || !supportedFromField || playlistLike || ytDlpMissing || ytDlpChecking;

  const clipboardLabel =
    clipboardStatus === "reading"
      ? "Checking clipboard…"
      : clipboardStatus === "ready"
        ? "Clipboard link ready"
        : clipboardStatus === "error"
          ? "Could not read clipboard"
          : "No media link on clipboard";

  return (
    <div className="flex h-full min-h-0 flex-col bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.08),_transparent_50%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent)] p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold tracking-tight">Quick Download</div>
          <div className="truncate text-[11px] text-muted-foreground">Paste, choose preset, download.</div>
        </div>
        <MotionButton type="button" variant="ghost" size="icon" className="h-9 w-9" onClick={() => void handleCancel()}>
          <X className="h-4 w-4" />
        </MotionButton>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
        <div className="rounded-xl border border-border/50 bg-card/80 p-2.5 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              {clipboardStatus === "reading" ? (
                <LoaderCircle className="h-4 w-4 shrink-0 animate-spin text-sky-400" />
              ) : clipboardUrl ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
              ) : (
                <Link2 className="h-4 w-4 shrink-0 text-primary" />
              )}
              <div className="min-w-0">
                <div className="text-xs font-medium text-foreground">{clipboardLabel}</div>
                <div className="truncate text-[10px] text-muted-foreground">
                  {clipboardUrl || "Copy a link, then Use or Check"}
                </div>
              </div>
            </div>
            <MotionButton
              type="button"
              variant="outline"
              className="h-8 shrink-0 gap-1.5 rounded-lg px-2.5 text-[11px]"
              disabled={clipboardStatus === "reading"}
              onClick={() => {
                if (clipboardUrl) {
                  urlUserEditedRef.current = false;
                  lastAutoFilledNormRef.current = normalizeUrlIdentity(clipboardUrl);
                  setUrl(clipboardUrl);
                } else {
                  void refreshClipboardUrl({ applyToField: true });
                }
              }}
            >
              <ClipboardPaste className="h-3.5 w-3.5" />
              {clipboardUrl ? "Use" : "Check"}
            </MotionButton>
          </div>
        </div>

        <div className="rounded-xl border border-border/50 bg-card/80 p-2.5 shadow-sm">
          <div className="grid gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Video URL</label>
            <Input
              value={url}
              onChange={(event) => handleUrlChange(event.target.value)}
              onKeyDown={handleUrlKeyDown}
              placeholder="Paste a YouTube, TikTok, Instagram, or similar link"
              className="h-10 rounded-lg"
              autoFocus
            />
            {url.trim() ? (
              <p className="text-[10px] text-muted-foreground">
                {playlistLike
                  ? "Playlist URL — open Advanced to pick videos."
                  : probe === "supported"
                    ? titleStatus === "loading"
                      ? "Looking up title…"
                      : titleHint
                        ? titleHint
                        : "Supported link"
                    : probe === "unknown"
                      ? "Host unknown — may still download with yt-dlp"
                      : "URL not recognized as media"}
              </p>
            ) : null}
          </div>

          <div className="mt-2.5 grid gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Preset</label>
            <Select value={presetId} onValueChange={setPresetId}>
              <SelectTrigger className="h-10 rounded-lg">
                <SelectValue placeholder="Choose preset" />
              </SelectTrigger>
              <SelectContent>
                {quickPresetGroups.map((entry, index) => (
                  <div key={entry.group}>
                    <SelectGroup>
                      <SelectLabel className="py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground/80">
                        {entry.label}
                      </SelectLabel>
                      {entry.presets.map((preset) => (
                        <SelectItem key={preset.id} value={preset.id}>
                          {preset.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                    {index < quickPresetGroups.length - 1 && <SelectSeparator />}
                  </div>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedPreset ? (
            <div className="mt-2 min-w-0 rounded-lg border border-border/45 bg-muted/15 px-2.5 py-2 text-[11px]">
              <div className="truncate font-medium text-foreground">{selectedPreset.name}</div>
              <div className="mt-0.5 truncate text-muted-foreground" title={selectedPreset.description}>
                {selectedPreset.description}
              </div>
            </div>
          ) : null}
        </div>

        {(playlistLike || ytDlpMissing || ytDlpChecking || cookiesOn) && (
          <div className="space-y-1.5">
            {playlistLike ? (
              <div className="flex items-start gap-2 rounded-xl border border-amber-500/25 bg-amber-500/8 px-2.5 py-2 text-[11px] text-amber-900 dark:text-amber-100">
                <ListMusic className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <div>
                  <p className="font-medium">Playlist detected</p>
                  <p className="mt-0.5 opacity-90">
                    Quick panel downloads one video at a time. Use Open Advanced to cherry-pick.
                  </p>
                </div>
              </div>
            ) : null}
            {ytDlpMissing ? (
              <div className="rounded-xl border border-destructive/25 bg-destructive/8 px-2.5 py-2 text-[11px] text-destructive">
                yt-dlp is missing. Open Tools and install it before downloading.
              </div>
            ) : null}
            {ytDlpChecking ? (
              <div className="rounded-xl border border-border/50 bg-muted/20 px-2.5 py-2 text-[11px] text-muted-foreground">
                Checking yt-dlp…
              </div>
            ) : null}
            {cookiesOn ? (
              <div className="flex items-center gap-1.5 rounded-xl border border-border/50 bg-muted/15 px-2.5 py-1.5 text-[10px] text-muted-foreground">
                <Cookie className="h-3 w-3 shrink-0" />
                Cookies file will be used for this download
              </div>
            ) : null}
          </div>
        )}

        <div className="rounded-xl border border-border/45 bg-card/70 px-2.5 py-2 text-[11px] text-muted-foreground shadow-sm">
          <div className="truncate" title={`${quickSummary} · ${subtitleDetail}`}>
            {quickSummary}
          </div>
        </div>
      </div>

      <div className="mt-2 grid shrink-0 gap-2 border-t border-border/40 pt-2">
        <MotionButton
          type="button"
          onClick={() => void handleDownload()}
          disabled={downloadDisabled}
          className="h-10 gap-2 rounded-lg"
        >
          <Download className="h-4 w-4" />
          {submitting ? "Adding..." : playlistLike ? "Use Advanced for playlists" : "Download Now"}
        </MotionButton>
        <div className="grid grid-cols-2 gap-2">
          <MotionButton
            type="button"
            variant="outline"
            onClick={() => void handleAdvanced()}
            className="h-9 gap-2 rounded-lg text-[12px]"
          >
            <ExternalLink className="h-4 w-4" />
            Open Advanced
          </MotionButton>
          <MotionButton
            type="button"
            variant="ghost"
            onClick={() => void handleCancel()}
            className="h-9 gap-2 rounded-lg text-[12px]"
          >
            <FolderOpen className="h-4 w-4" />
            Hide
          </MotionButton>
        </div>
      </div>
    </div>
  );
}
