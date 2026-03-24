import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clipboard,
  Clock3,
  LoaderCircle,
  Play,
  Plus,
  Settings2,
  Sparkles,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { MotionButton } from "@/components/motion/MotionButton";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DownloadOutputOptions } from "./DownloadOutputOptions";
import { DuplicateWarning } from "./DuplicateWarning";
import { Preset } from "@/store/presets";
import { readTextFromClipboard } from "@/lib/commands";
import type {
  SubtitleFormat,
  SubtitleLanguageMode,
  SubtitleMode,
  SubtitleSourcePolicy,
} from "@/lib/subtitles";
import {
  getPresetGroup,
  groupPresetsForSelect,
  PRESET_GROUP_LABELS,
  resolvePresetById,
} from "@/lib/preset-display";
import {
  getProbeHostLabel,
  pickSupportedUrlFromText,
  probeMediaUrl,
  quickProbeMediaUrl,
  type UrlProbeResult,
} from "@/lib/downloader";

interface DownloadInputSectionProps {
  url: string;
  setUrl: (val: string) => void;
  isAdding: boolean;
  autoPasteLinks: boolean;
  onAdd: () => void;
  selectedPreset: string;
  onPresetChange: (val: string) => void;
  presets: Preset[];
  isDirectImageUrl: boolean;
  addMode: "queue" | "start";
  setAddMode: (mode: "queue" | "start") => void;
  
  // Output Config Props
  showOutputConfig: boolean;
  onToggleOutputConfig: () => void;
  filenameBase: string;
  onFilenameChange: (val: string) => void;
  outputFormat: string;
  onFormatChange: (val: string) => void;
  customDownloadDir: string;
  onBrowseDir: () => void;
  isCustomPreset: boolean;
  defaultDownloadDir: string;
  subtitleMode: SubtitleMode;
  onSubtitleModeChange: (val: SubtitleMode) => void;
  subtitleSourcePolicy: SubtitleSourcePolicy;
  onSubtitleSourcePolicyChange: (val: SubtitleSourcePolicy) => void;
  subtitleLanguageMode: SubtitleLanguageMode;
  onSubtitleLanguageModeChange: (val: SubtitleLanguageMode) => void;
  subtitleLanguagesText: string;
  onSubtitleLanguagesTextChange: (val: string) => void;
  subtitleFormat: SubtitleFormat;
  onSubtitleFormatChange: (val: SubtitleFormat) => void;
  subtitleHint: string;
}

export function DownloadInputSection({
  url, setUrl, isAdding, autoPasteLinks, onAdd,
  selectedPreset, onPresetChange, presets,
  isDirectImageUrl,
  addMode, setAddMode,
  showOutputConfig, onToggleOutputConfig,
  filenameBase, onFilenameChange,
  outputFormat, onFormatChange,
  customDownloadDir, onBrowseDir,
  isCustomPreset,
  defaultDownloadDir,
  subtitleMode,
  onSubtitleModeChange,
  subtitleSourcePolicy,
  onSubtitleSourcePolicyChange,
  subtitleLanguageMode,
  onSubtitleLanguageModeChange,
  subtitleLanguagesText,
  onSubtitleLanguagesTextChange,
  subtitleFormat,
  onSubtitleFormatChange,
  subtitleHint,
}: DownloadInputSectionProps) {
  const [probeState, setProbeState] = useState<{
    url: string;
    result: UrlProbeResult | null;
    pending: boolean;
    verified: boolean;
    host: string | null;
  }>({
    url: "",
    result: null,
    pending: false,
    verified: false,
    host: null,
  });
  const probeCacheRef = useRef(new Map<string, UrlProbeResult>());
  const probeRequestRef = useRef(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const presetGroups = useMemo(() => groupPresetsForSelect(presets), [presets]);
  const selectedPresetConfig = useMemo(
    () => (selectedPreset === "custom" ? null : resolvePresetById(presets, selectedPreset) ?? null),
    [presets, selectedPreset]
  );
  const selectedPresetGroupLabel = selectedPresetConfig
    ? PRESET_GROUP_LABELS[getPresetGroup(selectedPresetConfig)]
    : "Custom";
  const [dupDismissed, setDupDismissed] = useState(false);
  const handleUrlChange = useCallback((val: string) => {
    setUrl(val);
    setDupDismissed(false);
  }, [setUrl]);

  useEffect(() => {
    const trimmed = url.trim();
    let immediateTimer: number | undefined;
    const queueProbeState = (next: {
      url: string;
      result: UrlProbeResult | null;
      pending: boolean;
      verified: boolean;
      host: string | null;
    }) => {
      immediateTimer = window.setTimeout(() => {
        setProbeState(next);
      }, 0);
    };

    if (!trimmed) {
      queueProbeState({
        url: "",
        result: null,
        pending: false,
        verified: false,
        host: null,
      });
      return () => {
        if (typeof immediateTimer === "number") {
          window.clearTimeout(immediateTimer);
        }
      };
    }

    const host = getProbeHostLabel(trimmed);
    const quickResult = quickProbeMediaUrl(trimmed);
    const cachedResult = probeCacheRef.current.get(trimmed);

    if (cachedResult) {
      queueProbeState({
        url: trimmed,
        result: cachedResult,
        pending: false,
        verified: true,
        host,
      });
      return () => {
        if (typeof immediateTimer === "number") {
          window.clearTimeout(immediateTimer);
        }
      };
    }

    if (quickResult === "unsupported") {
      queueProbeState({
        url: trimmed,
        result: "unsupported",
        pending: false,
        verified: false,
        host,
      });
      return () => {
        if (typeof immediateTimer === "number") {
          window.clearTimeout(immediateTimer);
        }
      };
    }

    const requestId = probeRequestRef.current + 1;
    probeRequestRef.current = requestId;

    queueProbeState({
      url: trimmed,
      result: quickResult,
      pending: true,
      verified: false,
      host,
    });

    const timer = window.setTimeout(() => {
      probeMediaUrl(trimmed)
        .then((result) => {
          probeCacheRef.current.set(trimmed, result);
          if (probeRequestRef.current !== requestId) return;
          setProbeState({
            url: trimmed,
            result,
            pending: false,
            verified: true,
            host,
          });
        })
        .catch(() => {
          if (probeRequestRef.current !== requestId) return;
          setProbeState({
            url: trimmed,
            result: "unknown",
            pending: false,
            verified: true,
            host,
          });
        });
    }, quickResult === "supported" ? 120 : 180);

    return () => {
      if (typeof immediateTimer === "number") {
        window.clearTimeout(immediateTimer);
      }
      window.clearTimeout(timer);
    };
  }, [url]);

  const trimmedUrl = url.trim();
  const probeStatus: "idle" | "checking" | UrlProbeResult =
    !trimmedUrl
      ? "idle"
      : probeState.url !== trimmedUrl || probeState.pending || probeState.result === null
        ? "checking"
        : probeState.result;

  const probeMessage = useMemo(() => {
    if (probeStatus === "idle") return null;

    const hostLabel = probeState.host ?? "this link";
    const hostText = probeState.host ? ` for ${probeState.host}` : "";

    if (probeStatus === "checking") {
      if (probeState.result === "supported") {
        return {
          title: "Link looks good",
          description: `${hostLabel} was recognized instantly. Running a quick yt-dlp check now.`,
          tone:
            "border-emerald-500/25 bg-emerald-500/8 text-emerald-700 dark:text-emerald-300",
          iconTone: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
          badge: "Verifying",
          icon: Sparkles,
          spin: false,
        };
      }

      return {
        title: "Checking link",
        description: `Running a quick compatibility check${hostText}.`,
        tone:
          "border-sky-500/25 bg-sky-500/8 text-sky-700 dark:text-sky-300",
        iconTone: "bg-sky-500/15 text-sky-600 dark:text-sky-300",
        badge: "Live",
        icon: LoaderCircle,
        spin: true,
      };
    }

    if (probeStatus === "supported") {
      return {
        title: "Ready to download",
        description: probeState.verified
          ? `Verified with yt-dlp${hostText}.`
          : `${hostLabel} looks supported.`,
        tone:
          "border-emerald-500/25 bg-emerald-500/8 text-emerald-700 dark:text-emerald-300",
        iconTone: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
        badge: probeState.verified ? "Verified" : "Fast match",
        icon: CheckCircle2,
        spin: false,
      };
    }

    if (probeStatus === "unsupported") {
      return {
        title: "Link looks invalid",
        description: probeState.host
          ? `This URL on ${probeState.host} does not look compatible.`
          : "Paste a full http or https media URL.",
        tone:
          "border-amber-500/25 bg-amber-500/8 text-amber-700 dark:text-amber-300",
        iconTone: "bg-amber-500/15 text-amber-600 dark:text-amber-300",
        badge: "Needs fix",
        icon: AlertTriangle,
        spin: false,
      };
    }

    return {
      title: "Could not verify yet",
      description: `This link may still work, but it could require login, cookies, or a slower extractor${hostText}.`,
      tone:
        "border-zinc-500/20 bg-zinc-500/8 text-muted-foreground",
      iconTone: "bg-zinc-500/15 text-foreground/80",
      badge: "Unknown",
      icon: AlertTriangle,
      spin: false,
    };
  }, [probeState.host, probeState.result, probeState.verified, probeStatus]);

  const handleUrlFocus = useCallback((el: HTMLInputElement | null) => {
    if (!autoPasteLinks) return;
    if (url.trim()) return;

    readTextFromClipboard()
      .then((text) => {
        if (!el) return;
        if (el.value.trim()) return;
        const supportedUrl = pickSupportedUrlFromText(text);
        if (!supportedUrl) return;
        handleUrlChange(supportedUrl);
      })
      .catch(() => {
        void 0;
      });
  }, [autoPasteLinks, handleUrlChange, url]);

  const handlePasteFromClipboard = useCallback(async () => {
    try {
      const text = await readTextFromClipboard();
      const normalized = pickSupportedUrlFromText(text) || text.trim();
      if (!normalized) return;
      handleUrlChange(normalized);
      window.setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    } catch {
      void 0;
    }
  }, [handleUrlChange]);

  const handleUrlKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !isAdding) {
      onAdd();
      return;
    }

    const isWindowsPasteFallback = e.metaKey && e.key.toLowerCase() === "v";
    const isShiftInsert = e.shiftKey && e.key === "Insert";
    if (isWindowsPasteFallback || isShiftInsert) {
      e.preventDefault();
      void handlePasteFromClipboard();
    }
  }, [handlePasteFromClipboard, isAdding, onAdd]);

  return (
    <div className="relative flex flex-col gap-2 rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.015))] p-2.5 shadow-[0_14px_40px_rgba(0,0,0,0.18)] glass-card">
      <div className="pointer-events-none absolute inset-0 rounded-2xl bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.08),transparent_42%)]" />
      <div className="relative flex flex-col gap-2 md:flex-row">
        <div className="flex-1 relative">
          <Input
            id="download-url-input"
            placeholder="Paste a video, playlist, or direct media URL"
            value={url}
            ref={inputRef}
            onChange={(e) => handleUrlChange(e.target.value)}
            onFocus={(e) => handleUrlFocus(e.currentTarget)}
            onKeyDown={handleUrlKeyDown}
            className="h-11 rounded-xl border-white/10 bg-background/90 px-4 shadow-sm focus-visible:ring-1"
          />
        </div>
        
        <div className="flex flex-wrap items-center justify-end gap-2 md:shrink-0">
          <MotionButton
            type="button"
            variant="outline"
            size="sm"
            className="h-10 rounded-xl border-white/10 bg-background/70 px-3 text-[11px] font-semibold"
            onClick={() => void handlePasteFromClipboard()}
          >
            <Clipboard className="mr-1.5 h-3.5 w-3.5" />
            Paste
          </MotionButton>
          <div className="flex h-10 items-center gap-0.5 rounded-xl border border-white/10 bg-background/70 p-0.5 shadow-sm">
            <MotionButton
              type="button"
              variant={addMode === "queue" ? "secondary" : "ghost"}
              size="sm"
              className="h-8 gap-1.5 rounded-lg px-3 text-[10px] font-semibold uppercase tracking-wider data-[state=active]:shadow-sm"
              onClick={() => setAddMode("queue")}
              data-state={addMode === "queue" ? "active" : "inactive"}
            >
              <Clock3 className="w-3 h-3" />
              Queue
            </MotionButton>
            <MotionButton
              type="button"
              variant={addMode === "start" ? "secondary" : "ghost"}
              size="sm"
              className="h-8 gap-1.5 rounded-lg px-3 text-[10px] font-semibold uppercase tracking-wider data-[state=active]:shadow-sm"
              onClick={() => setAddMode("start")}
              data-state={addMode === "start" ? "active" : "inactive"}
            >
              <Play className="w-3 h-3" />
              Start now
            </MotionButton>
          </div>

          <MotionButton
            onClick={onAdd}
            disabled={!url.trim() || isAdding}
            className="h-10 rounded-xl bg-linear-to-r from-primary/95 via-primary to-primary/85 px-4 shadow-md shadow-primary/20 hover:from-primary hover:to-primary"
          >
            <Plus className="w-4 h-4 mr-2" />
            {isAdding ? "Adding..." : addMode === "start" ? "Start Download" : "Add to Queue"}
          </MotionButton>
        </div>
      </div>

      {url.trim() && !dupDismissed && (
        <DuplicateWarning key={url.trim()} url={url.trim()} onDismiss={() => setDupDismissed(true)} />
      )}

      {probeMessage && (
        <div
          aria-live="polite"
          className={`rounded-lg border px-3 py-2 transition-colors ${probeMessage.tone}`}
        >
          <div className="flex items-center gap-2">
            <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${probeMessage.iconTone}`}>
              <probeMessage.icon className={`h-3.5 w-3.5 ${probeMessage.spin ? "animate-spin" : ""}`} />
            </div>
            <p className="min-w-0 flex-1 truncate text-[12px]">
              <span className="font-semibold">{probeMessage.title}</span>
              <span className="ml-2 opacity-80">{probeMessage.description}</span>
            </p>
          </div>
        </div>
      )}

      <div className="relative rounded-xl border border-white/10 bg-background/75 p-2 shadow-sm">
          <div className="grid gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <label className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Preset
              </label>
              {!isCustomPreset && selectedPresetConfig && (
                <div className="truncate rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-muted-foreground">
                  {selectedPresetGroupLabel}
                </div>
              )}
            </div>
            <Select
              value={selectedPreset}
              onValueChange={onPresetChange}
              disabled={isDirectImageUrl}
            >
              <SelectTrigger className="h-10 rounded-lg border-white/10 bg-background/90 px-3 shadow-sm focus:ring-1 disabled:cursor-not-allowed disabled:opacity-70">
                {isDirectImageUrl ? (
                  <div className="min-w-0 text-left">
                    <div className="truncate text-sm font-semibold">Direct image detected</div>
                  </div>
                ) : isCustomPreset ? (
                  <div className="min-w-0 text-left">
                    <div className="truncate text-sm font-semibold">Custom configuration</div>
                  </div>
                ) : selectedPresetConfig ? (
                  <div className="min-w-0 text-left">
                    <div className="truncate text-sm font-semibold">{selectedPresetConfig.name}</div>
                  </div>
                ) : (
                  <SelectValue placeholder="Choose preset" />
                )}
              </SelectTrigger>
              <SelectContent className="max-h-[360px] overflow-y-auto rounded-2xl border-border/70 bg-popover/98 p-1.5 shadow-2xl" position="popper" sideOffset={6} align="start">
                <SelectItem value="custom" className="rounded-xl py-2.5 font-semibold text-primary">
                  <div className="flex min-w-0 flex-col">
                    <span className="text-sm">Custom configuration</span>
                    <span className="text-[11px] font-normal text-muted-foreground">
                      Manual control over format, subtitles, folder, and filename rules
                    </span>
                  </div>
                </SelectItem>
                <SelectSeparator />
                {presetGroups.map((entry, index) => (
                  <div key={entry.group}>
                    <SelectGroup>
                      <SelectLabel className="py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground/80">
                        {entry.label}
                      </SelectLabel>
                      {entry.presets.map((preset) => (
                        <SelectItem key={preset.id} value={preset.id} title={preset.description} className="rounded-xl py-2.5">
                          <div className="flex min-w-0 flex-col">
                            <span className="truncate text-sm font-medium">{preset.name}</span>
                            <span className="truncate text-[11px] font-normal text-muted-foreground">
                              {preset.description}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectGroup>
                    {index < presetGroups.length - 1 && <SelectSeparator />}
                  </div>
                ))}
              </SelectContent>
            </Select>
            {isDirectImageUrl ? (
              <p className="text-[11px] text-muted-foreground">
                Direct image links use the original file, so presets and output conversion stay disabled.
              </p>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                {selectedPresetConfig?.description || "Use a preset for repeatable output settings."}
              </p>
            )}
          </div>
      </div>

      <div className="flex justify-center">
        <MotionButton
          variant="ghost"
          size="sm"
          className="h-6 text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 opacity-80 hover:opacity-100 transition-all disabled:cursor-not-allowed disabled:opacity-45"
          onClick={onToggleOutputConfig}
          disabled={isDirectImageUrl}
        >
          <Settings2 className="w-3 h-3" />
          {isDirectImageUrl
            ? "Direct images keep original output"
            : showOutputConfig
              ? "Hide Output Options"
              : "Show Output Options"}
          {showOutputConfig ? (
            <ChevronUp className="w-3 h-3" />
          ) : (
            <ChevronDown className="w-3 h-3" />
          )}
        </MotionButton>
      </div>

      {showOutputConfig && (
        <DownloadOutputOptions
          filenameBase={filenameBase}
          onFilenameChange={onFilenameChange}
          outputFormat={outputFormat}
          onFormatChange={onFormatChange}
          customDownloadDir={customDownloadDir}
          onBrowseDir={onBrowseDir}
          isCustomPreset={isCustomPreset}
          defaultDownloadDir={defaultDownloadDir}
          subtitleMode={subtitleMode}
          onSubtitleModeChange={onSubtitleModeChange}
          subtitleSourcePolicy={subtitleSourcePolicy}
          onSubtitleSourcePolicyChange={onSubtitleSourcePolicyChange}
          subtitleLanguageMode={subtitleLanguageMode}
          onSubtitleLanguageModeChange={onSubtitleLanguageModeChange}
          subtitleLanguagesText={subtitleLanguagesText}
          onSubtitleLanguagesTextChange={onSubtitleLanguagesTextChange}
          subtitleFormat={subtitleFormat}
          onSubtitleFormatChange={onSubtitleFormatChange}
          subtitleHint={subtitleHint}
        />
      )}
    </div>
  );
}
