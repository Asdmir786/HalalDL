import { useCallback, useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { CheckCircle2, ClipboardPaste, Download, ExternalLink, FolderOpen, Link2, X } from "lucide-react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { toast } from "sonner";
import { MotionButton } from "@/components/motion/MotionButton";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDownloadsStore } from "@/store/downloads";
import { usePresetsStore } from "@/store/presets";
import { useSettingsStore } from "@/store/settings";
import { useNavigationStore } from "@/store/navigation";
import { useRuntimeStore } from "@/store/runtime";
import { buildSubtitleSummary } from "@/lib/subtitles";
import {
  getPresetSubtitleDetail,
  getQuickEligiblePresets,
  groupPresetsForSelect,
  resolveExistingPresetId,
  resolvePresetById,
} from "@/lib/preset-display";
import { fetchMetadata, pickSupportedUrlFromText, startQueuedJobs } from "@/lib/downloader";
import { hideMainWindowToTray, readTextFromClipboard, restoreMainWindow } from "@/lib/commands";

export function QuickDownloadPanel() {
  const settings = useSettingsStore((state) => state.settings);
  const presets = usePresetsStore((state) => state.presets);
  const addJob = useDownloadsStore((state) => state.addJob);
  const setComposeDraft = useDownloadsStore((state) => state.setComposeDraft);
  const setScreen = useNavigationStore((state) => state.setScreen);
  const { quickDraft, closeQuickMode, restoreFullMode } = useRuntimeStore();

  const quickPresets = useMemo(
    () => getQuickEligiblePresets(presets),
    [presets]
  );
  const quickPresetGroups = useMemo(
    () => groupPresetsForSelect(quickPresets),
    [quickPresets]
  );

  const [url, setUrl] = useState("");
  const [presetId, setPresetId] = useState(resolveExistingPresetId(quickPresets, settings.quickDefaultPreset || "default"));
  const [clipboardUrl, setClipboardUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const refreshClipboardUrl = useCallback(async () => {
    try {
      const text = await readTextFromClipboard();
      const supported = pickSupportedUrlFromText(text);
      setClipboardUrl(supported ?? null);
      if (supported && (!quickDraft || !quickDraft.url)) {
        setUrl(supported);
      }
    } catch {
      setClipboardUrl(null);
    }
  }, [quickDraft]);

  useEffect(() => {
    if (quickDraft) {
      setUrl(quickDraft.url);
      setPresetId(resolveExistingPresetId(quickPresets, quickDraft.presetId || settings.quickDefaultPreset || "default"));
      void refreshClipboardUrl();
      return;
    }

    setPresetId((current) => resolveExistingPresetId(quickPresets, current || settings.quickDefaultPreset || "default"));
    void refreshClipboardUrl();
  }, [quickDraft, quickPresets, refreshClipboardUrl, settings.quickDefaultPreset]);

  const selectedPreset =
    resolvePresetById(quickPresets, presetId) ??
    quickPresets[0] ??
    presets[0];

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

  const handleCancel = async () => {
    closeQuickMode();
    await hideMainWindowToTray().catch(() => {
      void 0;
    });
  };

  const handleAdvanced = async () => {
    if (!url.trim()) return;

      setComposeDraft({
        url: url.trim(),
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
          setSubmitting(false);
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
        startQueuedJobs([id], { ignoreQueuePaused: true });
      }
      void fetchMetadata(id);

      toast.success("Quick download added");
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
  ]);

  const handleUrlKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      void handleDownload();
    },
    [handleDownload]
  );

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
              {clipboardUrl ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
              ) : (
                <Link2 className="h-4 w-4 shrink-0 text-primary" />
              )}
              <div className="min-w-0">
                <div className="text-xs font-medium text-foreground">
                  {clipboardUrl ? "Clipboard link ready" : "Clipboard"}
                </div>
                <div className="truncate text-[10px] text-muted-foreground">
                  {clipboardUrl || "Check for a copied media link"}
                </div>
              </div>
            </div>
            <MotionButton
              type="button"
              variant="outline"
              className="h-8 shrink-0 gap-1.5 rounded-lg px-2.5 text-[11px]"
              onClick={() => {
                if (clipboardUrl) {
                  setUrl(clipboardUrl);
                } else {
                  void refreshClipboardUrl();
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
              onChange={(event) => setUrl(event.target.value)}
              onKeyDown={handleUrlKeyDown}
              placeholder="Paste a YouTube, TikTok, Instagram, or similar link"
              className="h-10 rounded-lg"
            />
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

          {selectedPreset && (
            <div className="mt-2 min-w-0 rounded-lg border border-border/45 bg-muted/15 px-2.5 py-2 text-[11px]">
              <div className="truncate font-medium text-foreground">{selectedPreset.name}</div>
              <div className="mt-0.5 truncate text-muted-foreground" title={selectedPreset.description}>
                {selectedPreset.description}
              </div>
            </div>
          )}
        </div>

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
          disabled={submitting}
          className="h-10 gap-2 rounded-lg"
        >
          <Download className="h-4 w-4" />
          {submitting ? "Adding..." : "Download Now"}
        </MotionButton>
        <div className="grid grid-cols-2 gap-2">
          <MotionButton type="button" variant="outline" onClick={() => void handleAdvanced()} className="h-9 gap-2 rounded-lg text-[12px]">
            <ExternalLink className="h-4 w-4" />
            Open Advanced
          </MotionButton>
          <MotionButton type="button" variant="ghost" onClick={() => void handleCancel()} className="h-9 gap-2 rounded-lg text-[12px]">
            <FolderOpen className="h-4 w-4" />
            Hide
          </MotionButton>
        </div>
      </div>
    </div>
  );
}
