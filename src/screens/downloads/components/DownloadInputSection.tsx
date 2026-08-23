import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clipboard,
  Clock3,
  Layers,
  LoaderCircle,
  Play,
  Plus,
  Settings2,
  Sparkles,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { MotionButton } from "@/components/motion/MotionButton";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger } from "@/components/ui/select";
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
  groupPresetsForSelect,
  resolvePresetById,
} from "@/lib/preset-display";
import type { SponsorBlockCategoryId } from "@/lib/sponsorblock";
import {
  getProbeHostLabel,
  type InstagramMediaSummary,
  type MediaMetadataProbe,
  type PlaylistEntry,
  pickSupportedUrlFromText,
  probeMediaUrl,
  quickProbeMediaUrl,
  type UrlProbeResult,
} from "@/lib/downloader";
import { normalizeUrlIdentity } from "@/lib/url-identity";
import type { SponsorBlockMode } from "@/store/settings";
import type { ChapterMode } from "@/lib/chapters";
import { UrlInfoPreview, type UrlPreviewStatus } from "./UrlInfoPreview";
import { PlaylistPicker, type PlaylistPickerStatus } from "./PlaylistPicker";

interface DownloadInputSectionProps {
  url: string;
  setUrl: (val: string) => void;
  isAdding: boolean;
  autoPasteLinks: boolean;
  shouldAutoPasteUrl?: (url: string) => boolean;
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
  chapterMode: ChapterMode;
  onChapterModeChange: (value: ChapterMode) => void;
  instagramMediaSummary: InstagramMediaSummary | null;
  urlPreviewStatus: UrlPreviewStatus;
  urlPreview: MediaMetadataProbe | null;
  urlPreviewError?: string | null;
  sponsorBlockMode: SponsorBlockMode;
  onSponsorBlockModeChange: (val: SponsorBlockMode) => void;
  sponsorBlockCategories: SponsorBlockCategoryId[];
  onSponsorBlockCategoriesChange: (val: SponsorBlockCategoryId[]) => void;
  sponsorBlockDisabled?: boolean;
  sponsorBlockDisabledReason?: string;
  playlistStatus: PlaylistPickerStatus;
  playlistEntries: PlaylistEntry[];
  playlistSelectedKeys: Set<string>;
  onPlaylistSelectedKeysChange: (next: Set<string>) => void;
  playlistError?: string | null;
  playlistTruncated?: boolean;
  canPreferSingleVideo?: boolean;
  preferSingleVideo?: boolean;
  onPreferSingleVideoChange?: (value: boolean) => void;
}

export function DownloadInputSection({
  url, setUrl, isAdding, autoPasteLinks, shouldAutoPasteUrl, onAdd,
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
  chapterMode,
  onChapterModeChange,
  instagramMediaSummary,
  urlPreviewStatus,
  urlPreview,
  urlPreviewError,
  sponsorBlockMode,
  onSponsorBlockModeChange,
  sponsorBlockCategories,
  onSponsorBlockCategoriesChange,
  sponsorBlockDisabled,
  sponsorBlockDisabledReason,
  playlistStatus,
  playlistEntries,
  playlistSelectedKeys,
  onPlaylistSelectedKeysChange,
  playlistError,
  playlistTruncated,
  canPreferSingleVideo,
  preferSingleVideo,
  onPreferSingleVideoChange,
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
  const urlRef = useRef(url);
  const lastAutoFilledUrlRef = useRef<string | null>(null);
  const [presetSelectOpen, setPresetSelectOpen] = useState(false);
  const presetGroups = useMemo(() => groupPresetsForSelect(presets), [presets]);
  const selectedPresetConfig = useMemo(
    () => (selectedPreset === "custom" ? null : resolvePresetById(presets, selectedPreset) ?? null),
    [presets, selectedPreset]
  );
  const [dupDismissed, setDupDismissed] = useState(false);
  const handleUrlChange = useCallback((val: string) => {
    setUrl(val);
    setDupDismissed(false);
  }, [setUrl]);

  useEffect(() => {
    urlRef.current = url;
  }, [url]);

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

  const tryAutoPasteClipboard = useCallback(async (target?: HTMLInputElement | null) => {
    if (!autoPasteLinks) return;
    if (urlRef.current.trim()) return;

    try {
      const text = await readTextFromClipboard();
      if (urlRef.current.trim()) return;

      const supportedUrl = pickSupportedUrlFromText(text);
      if (!supportedUrl) return;
      if (shouldAutoPasteUrl && !shouldAutoPasteUrl(supportedUrl)) return;

      const normalized = normalizeUrlIdentity(supportedUrl);
      if (
        lastAutoFilledUrlRef.current &&
        lastAutoFilledUrlRef.current === normalized
      ) {
        return;
      }

      const currentTarget = target ?? inputRef.current;
      if (currentTarget?.value.trim()) return;

      lastAutoFilledUrlRef.current = normalized;
      handleUrlChange(supportedUrl);
    } catch {
      void 0;
    }
  }, [autoPasteLinks, handleUrlChange, shouldAutoPasteUrl]);

  useEffect(() => {
    if (!autoPasteLinks) return;
    const timer = window.setTimeout(() => {
      void tryAutoPasteClipboard();
    }, 0);
    return () => {
      window.clearTimeout(timer);
    };
  }, [autoPasteLinks, tryAutoPasteClipboard]);

  useEffect(() => {
    if (!autoPasteLinks) return;

    const handleWindowFocus = () => {
      void tryAutoPasteClipboard();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      void tryAutoPasteClipboard();
    };

    window.addEventListener("focus", handleWindowFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", handleWindowFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [autoPasteLinks, tryAutoPasteClipboard]);

  useEffect(() => {
    if (!autoPasteLinks) return;

    const pollId = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void tryAutoPasteClipboard();
    }, 750);

    return () => {
      window.clearInterval(pollId);
    };
  }, [autoPasteLinks, tryAutoPasteClipboard]);

  const handleUrlFocus = useCallback((el: HTMLInputElement | null) => {
    void tryAutoPasteClipboard(el);
  }, [tryAutoPasteClipboard]);

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

    const isShiftInsert = e.shiftKey && e.key === "Insert";
    if (isShiftInsert) {
      e.preventDefault();
      void handlePasteFromClipboard();
    }
  }, [handlePasteFromClipboard, isAdding, onAdd]);

  const isInstagramImageOnly = instagramMediaSummary?.isImageOnly ?? false;
  const presetSelectionLocked = isDirectImageUrl || isInstagramImageOnly;
  const presetSelectOpenEffective = presetSelectionLocked ? false : presetSelectOpen;
  const presetSelectionDisabled = presetSelectionLocked;

  const instagramPresetMessage = useMemo(() => {
    if (!instagramMediaSummary) return null;
    if (instagramMediaSummary.isImageOnly) {
      return instagramMediaSummary.kind === "carousel"
        ? `Image carousel detected (${instagramMediaSummary.itemCount} items). Presets are disabled and original files will be kept.`
        : "Instagram image detected. Presets are disabled and the original file will be kept.";
    }
    if (instagramMediaSummary.isMixedCarousel) {
      return `Mixed carousel detected (${instagramMediaSummary.itemCount} items). Presets only affect video items; images stay original.`;
    }
    return null;
  }, [instagramMediaSummary]);

  const playlistSelectedCount = useMemo(
    () => playlistEntries.filter((entry) => playlistSelectedKeys.has(entry.key)).length,
    [playlistEntries, playlistSelectedKeys]
  );
  const addLabel =
    playlistStatus !== "idle" && playlistSelectedCount > 0
      ? addMode === "start"
        ? `Start ${playlistSelectedCount}`
        : `Queue ${playlistSelectedCount}`
      : isAdding
        ? "Adding..."
        : addMode === "start"
          ? "Start download"
          : "Add to queue";
  const presetTitle = isDirectImageUrl
    ? "Direct image detected"
    : isInstagramImageOnly
      ? "No preset needed"
      : isCustomPreset
        ? "Custom configuration"
        : selectedPresetConfig?.name || "Choose preset";
  const presetDetail = isDirectImageUrl
    ? "Original file only"
    : instagramPresetMessage
      || selectedPresetConfig?.description
      || (isCustomPreset ? "Manual format, folder, and filename rules" : "Repeatable output settings");

  return (
      <div className="flex flex-col gap-2">
      <div className="relative">
        <Input
          id="download-url-input"
          placeholder="Paste a video, playlist, or direct media URL"
          value={url}
          ref={inputRef}
          onChange={(e) => handleUrlChange(e.target.value)}
          onFocus={(e) => handleUrlFocus(e.currentTarget)}
          onKeyDown={handleUrlKeyDown}
          className="h-11 rounded-lg border-primary/25 bg-background px-3 pr-[4.75rem] text-sm text-foreground shadow-none placeholder:text-foreground/45 focus-visible:ring-1 dark:bg-[#081018]"
        />
        <MotionButton
          type="button"
          variant="outline"
          size="sm"
          className="absolute right-1.5 top-1/2 h-8 -translate-y-1/2 rounded-md border-primary/30 px-2.5 text-[11px] font-semibold text-foreground hover:bg-primary/15"
          onClick={() => void handlePasteFromClipboard()}
        >
          <Clipboard className="mr-1 h-3.5 w-3.5" />
          Paste
        </MotionButton>
      </div>

      {url.trim() && !dupDismissed && (
        <DuplicateWarning key={url.trim()} url={url.trim()} onDismiss={() => setDupDismissed(true)} />
      )}

      {probeMessage && (
        <div aria-live="polite" className="flex items-center gap-1.5 px-1 text-[11px] text-muted-foreground">
          <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${probeMessage.iconTone}`}>
            <probeMessage.icon className={`h-3 w-3 ${probeMessage.spin ? "animate-spin" : ""}`} />
          </div>
          <p className="min-w-0 truncate">
            <span className="font-medium text-foreground/85">{probeMessage.title}</span>
            <span className="ml-2 opacity-80">{probeMessage.description}</span>
          </p>
        </div>
      )}

      <UrlInfoPreview
        status={urlPreviewStatus}
        preview={urlPreview}
        errorMessage={urlPreviewError}
      />

      <PlaylistPicker
        status={playlistStatus}
        entries={playlistEntries}
        selectedKeys={playlistSelectedKeys}
        onSelectedKeysChange={onPlaylistSelectedKeysChange}
        errorMessage={playlistError}
        truncated={playlistTruncated}
        canPreferSingleVideo={canPreferSingleVideo}
        preferSingleVideo={preferSingleVideo}
        onPreferSingleVideoChange={onPreferSingleVideoChange}
      />

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto] sm:items-stretch">
        <div className="min-w-0">
        <Select
            value={selectedPreset}
            onValueChange={onPresetChange}
            open={presetSelectOpenEffective}
            onOpenChange={(open) => {
              if (presetSelectionLocked) {
                setPresetSelectOpen(false);
                return;
              }
              setPresetSelectOpen(open);
            }}
            disabled={presetSelectionDisabled}
          >
            <SelectTrigger className="h-11 w-full justify-start gap-2 overflow-hidden rounded-lg border-white/10 bg-[#0d1520] px-3 py-0 text-left shadow-none focus:ring-1 focus:ring-primary/25 disabled:cursor-not-allowed disabled:opacity-70 [&>span]:flex [&>span]:min-w-0 [&>span]:max-w-[calc(100%-1.25rem)] [&>span]:flex-none [&>span]:items-center">
              <span className="flex min-w-0 items-center gap-2">
                <Layers className="h-4 w-4 shrink-0 text-primary/80" />
                <span className="min-w-0 leading-none">
                  <span className="block truncate text-sm font-medium">{presetTitle}</span>
                  <span className="mt-1 block truncate text-[11px] font-normal text-foreground/55">{presetDetail}</span>
                </span>
              </span>
            </SelectTrigger>
            <SelectContent
              position="popper"
              sideOffset={6}
              align="start"
              className="w-80 max-w-[min(20rem,calc(100vw-2rem))] rounded-xl border-white/10 bg-[#101820] p-0 shadow-lg"
            >
              <SelectItem value="custom" className="rounded-lg py-2 font-semibold text-primary">
                <div className="flex min-w-0 flex-col">
                  <span className="text-sm">Custom configuration</span>
                  <span className="text-[11px] font-normal text-foreground/60">
                    Manual control over format, subtitles, folder, and filename rules
                  </span>
                </div>
              </SelectItem>
              <SelectSeparator />
              {presetGroups.map((entry, index) => (
                <div key={entry.group}>
                  <SelectGroup>
                    <SelectLabel className="px-2 py-1.5 pl-2 text-[10px] uppercase tracking-wider text-foreground/50">
                      {entry.label}
                    </SelectLabel>
                    {entry.presets.map((preset) => (
                      <SelectItem key={preset.id} value={preset.id} title={preset.description} className="rounded-lg py-2">
                        <div className="flex min-w-0 flex-col">
                          <span className="truncate text-sm font-medium">{preset.name}</span>
                          <span className="truncate text-[11px] font-normal text-foreground/55">
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
        </div>
        <MotionButton
          variant="outline"
          size="sm"
          className="h-11 shrink-0 rounded-lg border-primary/30 px-2.5 text-[11px] font-semibold text-foreground hover:bg-primary/15 disabled:cursor-not-allowed disabled:opacity-45"
          onClick={onToggleOutputConfig}
          disabled={isDirectImageUrl || isInstagramImageOnly}
        >
          <Settings2 className="mr-1 h-3.5 w-3.5" />
          {showOutputConfig ? "Hide options" : "Options"}
          {showOutputConfig ? (
            <ChevronUp className="ml-1 h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="ml-1 h-3.5 w-3.5" />
          )}
        </MotionButton>
        <div className="relative grid h-11 w-[10.5rem] shrink-0 grid-cols-2 rounded-lg border border-white/10 bg-black/20 p-0.5">
          <span
            aria-hidden
            className={cn(
              "pointer-events-none absolute inset-y-0.5 w-[calc(50%-2px)] rounded-md bg-primary/20 ring-1 ring-primary/25 transition-transform duration-200 ease-out",
              addMode === "start" ? "translate-x-[calc(100%+2px)]" : "translate-x-0"
            )}
          />
          <button
            type="button"
            onClick={() => setAddMode("queue")}
            data-state={addMode === "queue" ? "active" : "inactive"}
            className={cn(
              "relative z-10 inline-flex items-center justify-center gap-1 rounded-md text-[11px] font-semibold transition-colors",
              addMode === "queue" ? "text-primary" : "text-foreground/65 hover:text-foreground"
            )}
          >
            <Clock3 className="h-3 w-3" />
            Later
          </button>
          <button
            type="button"
            onClick={() => setAddMode("start")}
            data-state={addMode === "start" ? "active" : "inactive"}
            className={cn(
              "relative z-10 inline-flex items-center justify-center gap-1 rounded-md text-[11px] font-semibold transition-colors",
              addMode === "start" ? "text-primary" : "text-foreground/65 hover:text-foreground"
            )}
          >
            <Zap className="h-3 w-3" />
            Now
          </button>
        </div>
        <MotionButton
          onClick={onAdd}
          disabled={!url.trim() || isAdding || playlistStatus === "loading"}
          className="h-11 shrink-0 rounded-lg px-3 text-[12px] font-semibold shadow-sm shadow-primary/15"
        >
          {addMode === "start" ? <Play className="mr-1.5 h-3.5 w-3.5" /> : <Plus className="mr-1.5 h-3.5 w-3.5" />}
          {isAdding ? "Adding..." : addLabel}
        </MotionButton>
      </div>

      {showOutputConfig && !isInstagramImageOnly && (
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
          chapterMode={chapterMode}
          onChapterModeChange={onChapterModeChange}
          sponsorBlockMode={sponsorBlockMode}
          onSponsorBlockModeChange={onSponsorBlockModeChange}
          sponsorBlockCategories={sponsorBlockCategories}
          onSponsorBlockCategoriesChange={onSponsorBlockCategoriesChange}
          sponsorBlockDisabled={sponsorBlockDisabled}
          sponsorBlockDisabledReason={sponsorBlockDisabledReason}
        />
      )}
    </div>
  );
}
