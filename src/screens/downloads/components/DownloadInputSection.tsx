import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  LoaderCircle,
  Play,
  Plus,
  Settings2,
  Sparkles,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  getProbeHostLabel,
  pickSupportedUrlFromText,
  probeMediaUrl,
  quickProbeMediaUrl,
  type UrlProbeResult,
} from "@/lib/downloader";

interface DownloadInputSectionProps {
  url: string;
  setUrl: (val: string) => void;
  autoPasteLinks: boolean;
  onAdd: () => void;
  selectedPreset: string;
  onPresetChange: (val: string) => void;
  presets: Preset[];
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

const GROUP_ORDER = ["Recommended", "Compatibility", "Editors", "Editors Pro", "Web", "Video", "Audio", "Other", "Custom"] as const;

export function DownloadInputSection({
  url, setUrl, autoPasteLinks, onAdd,
  selectedPreset, onPresetChange, presets,
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

  const getGroupAndLabel = (preset: Preset): { group: string; label: string } => {
    const parts = preset.name.split(" — ");
    if (parts.length >= 2) return { group: parts[0], label: parts.slice(1).join(" — ") };
    return { group: preset.isBuiltIn ? "Other" : "Custom", label: preset.name };
  };

  const { grouped, orderedGroups } = useMemo(() => {
    const groupedMap = presets.reduce<Record<string, Array<{ preset: Preset; label: string }>>>((acc, preset) => {
      const { group, label } = getGroupAndLabel(preset);
      acc[group] = acc[group] ?? [];
      acc[group].push({ preset, label });
      return acc;
    }, {});

    const ordered = [
      ...GROUP_ORDER.filter((g) => (groupedMap[g]?.length ?? 0) > 0),
      ...Object.keys(groupedMap).filter((g) => !GROUP_ORDER.includes(g as (typeof GROUP_ORDER)[number])).sort(),
    ];

    return { grouped: groupedMap, orderedGroups: ordered };
  }, [presets]);

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

  return (
    <div className="flex flex-col gap-3 bg-muted/30 p-3 rounded-xl border border-muted/50 shadow-sm glass-card">
      <div className="flex flex-col lg:flex-row gap-3">
        <div className="flex-1 relative">
          <Input
            placeholder="Paste video or playlist URL here..."
            value={url}
            onChange={(e) => handleUrlChange(e.target.value)}
            onFocus={(e) => handleUrlFocus(e.currentTarget)}
            onKeyDown={(e) => e.key === "Enter" && onAdd()}
            className="bg-background border-muted shadow-sm focus-visible:ring-1 h-10"
          />
        </div>
        
        <div className="flex flex-wrap gap-2 items-center justify-end">
          <Select value={selectedPreset} onValueChange={onPresetChange}>
            <SelectTrigger className="w-[140px] bg-background border-muted shadow-sm focus:ring-1 h-10">
              <SelectValue placeholder="Preset" />
            </SelectTrigger>
            <SelectContent className="max-h-[300px] overflow-y-auto" position="popper" sideOffset={6} align="start">
              <SelectItem value="custom" className="font-semibold text-primary">
                ✨ Custom Configuration
              </SelectItem>
              <SelectSeparator />
              {orderedGroups.map((group) => (
                <SelectGroup key={group}>
                  <SelectLabel className="text-[10px] uppercase tracking-wider text-muted-foreground/80 py-1.5">
                    {group}
                  </SelectLabel>
                  {(grouped[group] ?? []).map(({ preset, label }) => (
                    <SelectItem key={preset.id} value={preset.id} title={preset.description}>
                      {label}
                    </SelectItem>
                  ))}
                  <SelectSeparator />
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>

          <div className="flex rounded-xl border border-muted bg-background/80 p-0.5 gap-0.5 h-10 items-center shadow-sm">
            <MotionButton
              type="button"
              variant={addMode === "queue" ? "secondary" : "ghost"}
              size="sm"
              className="h-8 px-3 text-[10px] uppercase font-bold tracking-wider rounded-lg gap-1.5 data-[state=active]:shadow-sm"
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
              className="h-8 px-3 text-[10px] uppercase font-bold tracking-wider rounded-lg gap-1.5 data-[state=active]:shadow-sm"
              onClick={() => setAddMode("start")}
              data-state={addMode === "start" ? "active" : "inactive"}
            >
              <Play className="w-3 h-3" />
              Start now
            </MotionButton>
          </div>

          <MotionButton
            onClick={onAdd}
            disabled={!url.trim()}
            className="h-10 px-4 rounded-xl bg-linear-to-r from-primary/95 via-primary to-primary/85 hover:from-primary hover:to-primary shadow-md shadow-primary/20"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add
          </MotionButton>
        </div>
      </div>

      {url.trim() && !dupDismissed && (
        <DuplicateWarning key={url.trim()} url={url.trim()} onDismiss={() => setDupDismissed(true)} />
      )}

      {probeMessage && (
        <div
          aria-live="polite"
          className={`rounded-xl border px-3 py-2.5 shadow-sm transition-colors ${probeMessage.tone}`}
        >
          <div className="flex items-start gap-2.5">
            <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${probeMessage.iconTone}`}>
              <probeMessage.icon className={`h-4 w-4 ${probeMessage.spin ? "animate-spin" : ""}`} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-[12px] font-semibold">{probeMessage.title}</p>
                <span className="rounded-full border border-current/15 bg-background/50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.18em]">
                  {probeMessage.badge}
                </span>
              </div>
              <p className="mt-1 text-[11px] leading-5 opacity-90">
                {probeMessage.description}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-center -mt-1">
        <MotionButton
          variant="ghost"
          size="sm"
          className="h-6 text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 opacity-80 hover:opacity-100 transition-all"
          onClick={onToggleOutputConfig}
        >
          <Settings2 className="w-3 h-3" />
          {showOutputConfig ? "Hide Output Options" : "Show Output Options"}
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
