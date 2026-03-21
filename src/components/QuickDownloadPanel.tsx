import { useEffect, useMemo, useState } from "react";
import { Download, ExternalLink, FolderOpen, X } from "lucide-react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { toast } from "sonner";
import { MotionButton } from "@/components/motion/MotionButton";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDownloadsStore } from "@/store/downloads";
import { usePresetsStore } from "@/store/presets";
import { useSettingsStore } from "@/store/settings";
import { useNavigationStore } from "@/store/navigation";
import { useRuntimeStore } from "@/store/runtime";
import { buildSubtitleSummary } from "@/lib/subtitles";
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
    () => presets.filter((preset) => preset.quickEligible !== false),
    [presets]
  );

  const [url, setUrl] = useState("");
  const [presetId, setPresetId] = useState(settings.quickDefaultPreset || "default");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (quickDraft) {
      setUrl(quickDraft.url);
      setPresetId(quickDraft.presetId || settings.quickDefaultPreset || "default");
      return;
    }

    readTextFromClipboard()
      .then((text) => {
        const supported = pickSupportedUrlFromText(text);
        if (supported) setUrl(supported);
      })
      .catch(() => {
        void 0;
      });
  }, [quickDraft, settings.quickDefaultPreset]);

  const selectedPreset =
    quickPresets.find((preset) => preset.id === presetId) ??
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
      presetId: presetId || settings.quickDefaultPreset || "default",
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

  const handleDownload = async () => {
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

      const id = addJob(supportedUrl, presetId, {
        ...(downloadDir ? { downloadDir } : {}),
        origin: "tray",
      });

      await fetchMetadata(id);

      if (settings.quickDownloadStartMode === "start") {
        startQueuedJobs([id]);
      }

      toast.success("Quick download added");
      closeQuickMode();
      await hideMainWindowToTray().catch(() => {
        void 0;
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex h-full flex-col bg-background p-4">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold tracking-tight">Quick Download</div>
          <div className="mt-1 text-xs text-muted-foreground">
            Paste a link, pick a preset, and send it straight to the queue.
          </div>
        </div>
        <MotionButton type="button" variant="ghost" size="icon" className="h-9 w-9" onClick={() => void handleCancel()}>
          <X className="h-4 w-4" />
        </MotionButton>
      </div>

      <div className="space-y-3">
        <div className="grid gap-2">
          <label className="text-xs font-medium text-muted-foreground">URL</label>
          <Input
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="Paste a YouTube, TikTok, Instagram, or similar link"
            className="h-10"
          />
        </div>

        <div className="grid gap-2">
          <label className="text-xs font-medium text-muted-foreground">Preset</label>
          <Select value={presetId} onValueChange={setPresetId}>
            <SelectTrigger className="h-10">
              <SelectValue placeholder="Choose preset" />
            </SelectTrigger>
            <SelectContent>
              {quickPresets.map((preset) => (
                <SelectItem key={preset.id} value={preset.id}>
                  {preset.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-xl border border-border/40 bg-muted/20 p-3 text-xs text-muted-foreground">
          <div className="flex items-center justify-between gap-3">
            <span>Destination</span>
            <span className="font-medium text-foreground/90">
              {settings.quickDownloadDestinationMode === "ask"
                ? "Ask every time"
                : "Default folder"}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between gap-3">
            <span>Start mode</span>
            <span className="font-medium text-foreground/90">
              {settings.quickDownloadStartMode === "start" ? "Start immediately" : "Queue first"}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between gap-3">
            <span>Subtitles</span>
            <span className="font-medium text-foreground/90">{subtitleSummary}</span>
          </div>
        </div>
      </div>

      <div className="mt-auto grid gap-2 pt-4">
        <MotionButton
          type="button"
          onClick={() => void handleDownload()}
          disabled={submitting}
          className="h-11 gap-2 rounded-xl"
        >
          <Download className="h-4 w-4" />
          {submitting ? "Adding..." : "Download"}
        </MotionButton>
        <div className="grid grid-cols-2 gap-2">
          <MotionButton type="button" variant="outline" onClick={() => void handleAdvanced()} className="h-10 gap-2 rounded-xl">
            <ExternalLink className="h-4 w-4" />
            Advanced
          </MotionButton>
          <MotionButton type="button" variant="ghost" onClick={() => void handleCancel()} className="h-10 gap-2 rounded-xl">
            <FolderOpen className="h-4 w-4" />
            Cancel
          </MotionButton>
        </div>
      </div>
    </div>
  );
}
