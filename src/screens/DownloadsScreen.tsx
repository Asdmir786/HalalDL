import { Variants } from "framer-motion";
import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { useDownloadsStore } from "@/store/downloads";
import { useHistoryStore } from "@/store/history";
import { usePresetsStore } from "@/store/presets";
import { useSettingsStore } from "@/store/settings";
import { useLogsStore } from "@/store/logs";
import { useNavigationStore } from "@/store/navigation";
import { useRuntimeStore } from "@/store/runtime";
import { useLibraryStore } from "@/store/library";
import {
  normalizeSubtitlePreferences,
  splitSubtitleLanguages,
  subtitleLanguagesToString,
} from "@/lib/subtitles";
import { resolveExistingPresetId } from "@/lib/preset-display";

import { FadeInStagger, FadeInItem } from "@/components/motion/StaggerContainer";
import {
  changePausedJobPreset,
  cleanupThumbnailByJobId,
  fetchMediaInfo,
  fetchMetadata,
  fetchPlaylistEntries,
  instagramSummaryFromMediaCollection,
  isDirectImageUrl,
  isYouTubeUrl,
  looksLikePlaylistUrl,
  canPreferSingleVideoFromUrl,
  singleVideoUrlFromMixedUrl,
  pauseActiveDownload,
  quickProbeMediaUrl,
  resumePausedDownload,
  retryFailedJobs,
  startQueuedJobs,
  stopPostProcessingJob,
  type InstagramMediaSummary,
  type MediaMetadataProbe,
  type PlaylistEntry,
} from "@/lib/downloader";
import { isInstagramUrl } from "@/lib/media-engine";
import { copyFilesToClipboard } from "@/lib/commands";
import { probeReliability } from "@/lib/reliability";
import { Button } from "@/components/ui/button";
import { getExplicitOutputPaths } from "@/lib/output-paths";
import { toast } from "sonner";
import type { SponsorBlockCategoryId } from "@/lib/sponsorblock";
import type { SponsorBlockMode } from "@/store/settings";

import { DownloadInputSection } from "./downloads/components/DownloadInputSection";
import { DownloadStatsBar, type DownloadStatusFilter } from "./downloads/components/DownloadStatsBar";
import { DownloadList } from "./downloads/components/DownloadList";
import type { UrlPreviewStatus } from "./downloads/components/UrlInfoPreview";
import type { PlaylistPickerStatus } from "./downloads/components/PlaylistPicker";
import { getJobTs } from "./downloads/utils";
import { buildClipSection } from "@/lib/clip";
import { normalizeUrlIdentity } from "@/lib/url-identity";
import { applySourceRule, resolveSourceRule } from "@/lib/source-rules";
import type { ChapterMode } from "@/lib/chapters";
import { getMarketingCaptureState, isDemoModeEnabled } from "@/lib/demo-mode";

const MARKETING_PLAYLIST_URL = "https://www.youtube.com/playlist?list=PLdemoHalalDL060";
const MARKETING_PLAYLIST_ENTRIES: PlaylistEntry[] = [
  { key: "garden-01", id: "garden-01", index: 1, title: "Community garden: welcome and plan", url: "https://www.youtube.com/watch?v=garden01", durationSeconds: 486 },
  { key: "garden-02", id: "garden-02", index: 2, title: "Five easy harvest tips", url: "https://www.youtube.com/watch?v=garden02", durationSeconds: 332 },
  { key: "garden-03", id: "garden-03", index: 3, title: "Water-wise growing for beginners", url: "https://www.youtube.com/watch?v=garden03", durationSeconds: 628 },
  { key: "garden-04", id: "garden-04", index: 4, title: "Volunteer day highlights", url: "https://www.youtube.com/watch?v=garden04", durationSeconds: 214 },
  { key: "garden-05", id: "garden-05", index: 5, title: "Saving seeds for next season", url: "https://www.youtube.com/watch?v=garden05", durationSeconds: 571 },
];

export function DownloadsScreen() {
  const { settings, updateSettings } = useSettingsStore();
  const [url, setUrl] = useState("");
  const [checkingLink, setCheckingLink] = useState(false);
  const [linkCheckResult, setLinkCheckResult] = useState<{ url: string; message: string } | null>(null);
  const persistenceReady = useRuntimeStore((state) => state.persistenceReady);

  
  // Derived state for addMode from settings
  const addMode = settings.downloadsAddMode;
  const setAddMode = (mode: "queue" | "start") => {
    updateSettings({ downloadsAddMode: mode });
  };
  
  // Advanced Output Config State
  const [showOutputConfig, setShowOutputConfig] = useState(false);
  const [filenameBase, setFilenameBase] = useState("%(title)s [%(id)s]");
  const [outputFormat, setOutputFormat] = useState<string>("best");
  const [customDownloadDir, setCustomDownloadDir] = useState<string>("");
  const [subtitleMode, setSubtitleMode] = useState<"off" | "on" | "only">("off");
  const [subtitleSourcePolicy, setSubtitleSourcePolicy] = useState<"manual" | "auto" | "manual-then-auto">("manual-then-auto");
  const [subtitleLanguageMode, setSubtitleLanguageMode] = useState<"all" | "preferred" | "custom">("preferred");
  const [subtitleLanguagesText, setSubtitleLanguagesText] = useState("en.*, en");
  const [subtitleFormat, setSubtitleFormat] = useState<"original" | "srt" | "vtt">("srt");
  const [clipStartTime, setClipStartTime] = useState("");
  const [clipEndTime, setClipEndTime] = useState("");
  const [chapterMode, setChapterMode] = useState<ChapterMode>("preserve");

  const { presets } = usePresetsStore();
  const { rules: sourceRules, collections } = useLibraryStore();
  const selectedPreset = resolveExistingPresetId(presets, settings.downloadsSelectedPreset || "default");
  const selectedPresetConfig = useMemo(
    () => presets.find((preset) => preset.id === selectedPreset) ?? null,
    [presets, selectedPreset]
  );
  const {
    jobs,
    addJob,
    removeJob,
    updateJob,
    pendingUrl,
    setPendingUrl,
    composeDraft,
    setComposeDraft,
  } = useDownloadsStore();
  const historyEntries = useHistoryStore((state) => state.entries);
  const { setActiveJobId } = useLogsStore();
  const { setScreen } = useNavigationStore();
  const isCustomPreset = selectedPreset === "custom";
  const isDirectImageInput = isDirectImageUrl(url.trim());
  const shouldAutoPasteUrl = useCallback(
    (candidate: string) => {
      const candidateKey = normalizeUrlIdentity(candidate);
      if (!candidateKey) return false;

      return !(
        jobs.some((job) => normalizeUrlIdentity(job.url) === candidateKey) ||
        historyEntries.some((entry) => normalizeUrlIdentity(entry.url) === candidateKey)
      );
    },
    [historyEntries, jobs]
  );

  useEffect(() => {
    if (selectedPreset !== "custom" && settings.downloadsSelectedPreset !== selectedPreset) {
      updateSettings({ downloadsSelectedPreset: selectedPreset });
    }
  }, [selectedPreset, settings.downloadsSelectedPreset, updateSettings]);

  const inferOutputFormat = useCallback((presetId: string): string => {
    const preset = presets.find((p) => p.id === presetId);
    if (!preset) return "best";

    const audioFormatIndex = preset.args.indexOf("--audio-format");
    if (audioFormatIndex !== -1) {
      const next = preset.args[audioFormatIndex + 1];
      if (next === "mp3") return "mp3";
      if (next === "m4a") return "m4a";
      if (next === "flac") return "flac";
      if (next === "wav") return "wav";
      if (next === "alac") return "alac";
    }

    const mergeIndex = preset.args.indexOf("--merge-output-format");
    if (mergeIndex !== -1) {
      const next = preset.args[mergeIndex + 1];
      if (next === "mp4" || next === "mkv" || next === "webm") return next;
    }

    const formatIndex = preset.args.indexOf("-f");
    if (formatIndex !== -1) {
      const fmt = preset.args[formatIndex + 1] ?? "";
      if (fmt.includes("ext=mp4") || fmt.includes("[ext=mp4]")) return "mp4";
      if (fmt.includes("ext=webm") || fmt.includes("[ext=webm]")) return "webm";
    }

    return "best";
  }, [presets]);

  const applyPresetSubtitleDefaults = useCallback((presetId: string, preferredLanguages: string) => {
    const preset = presets.find((p) => p.id === presetId);
    const defaults = normalizeSubtitlePreferences({
      mode: preset?.subtitleOnly ? "only" : preset?.subtitleMode,
      sourcePolicy: preset?.subtitleSourcePolicy,
      languageMode: preset?.subtitleLanguageMode,
      languages: preset?.subtitleLanguages,
      format: preset?.subtitleFormat,
    });
    setSubtitleMode(defaults.mode);
    setSubtitleSourcePolicy(defaults.sourcePolicy);
    setSubtitleLanguageMode(defaults.languageMode);
    setSubtitleLanguagesText(
      subtitleLanguagesToString(
        defaults.languageMode === "preferred"
          ? splitSubtitleLanguages(preferredLanguages)
          : defaults.languages
      )
    );
    setSubtitleFormat(defaults.format);
  }, [presets]);

  const handlePresetChange = (val: string) => {
    updateSettings({ downloadsSelectedPreset: val });
    const isCustom = val === "custom";
    setShowOutputConfig(isCustom);
    if (!isCustom) {
      setOutputFormat(inferOutputFormat(val));
      applyPresetSubtitleDefaults(val, settings.preferredSubtitleLanguages);
    }
  };

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [instagramMediaSummary, setInstagramMediaSummary] = useState<InstagramMediaSummary | null>(null);
  const [urlPreview, setUrlPreview] = useState<MediaMetadataProbe | null>(null);
  const [urlPreviewStatus, setUrlPreviewStatus] = useState<UrlPreviewStatus>("idle");
  const [urlPreviewError, setUrlPreviewError] = useState<string | null>(null);
  const urlPreviewCacheRef = useRef(new Map<string, MediaMetadataProbe>());
  const urlPreviewRequestRef = useRef(0);
  const [playlistStatus, setPlaylistStatus] = useState<PlaylistPickerStatus>("idle");
  const [playlistEntries, setPlaylistEntries] = useState<PlaylistEntry[]>([]);
  const [playlistSelectedKeys, setPlaylistSelectedKeys] = useState<Set<string>>(new Set());
  const [playlistError, setPlaylistError] = useState<string | null>(null);
  const [playlistTruncated, setPlaylistTruncated] = useState(false);
  const [preferSingleVideo, setPreferSingleVideo] = useState(false);
  const playlistRequestRef = useRef(0);

  useEffect(() => {
    if (!isDemoModeEnabled() || getMarketingCaptureState() !== "queue") return;
    const timer = window.setTimeout(() => {
      setSelectedIds(jobs.filter((job) => ["Queued", "Paused", "Stopped"].includes(job.status)).map((job) => job.id));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [jobs]);

  useEffect(() => {
    if (isDemoModeEnabled() && getMarketingCaptureState() === "playlist") {
      const timer = window.setTimeout(() => {
        setUrl(MARKETING_PLAYLIST_URL);
        setPlaylistEntries(MARKETING_PLAYLIST_ENTRIES);
        setPlaylistSelectedKeys(new Set(["garden-01", "garden-03", "garden-04"]));
        setPlaylistStatus("ready");
        setPlaylistError(null);
        setPlaylistTruncated(false);
      }, 0);
      return () => window.clearTimeout(timer);
    }
  }, []);

  // Handle Drag & Drop Pending URL
  useEffect(() => {
    if (composeDraft) {
      const presetId = composeDraft.presetId || selectedPreset;
      const subtitleDefaults = normalizeSubtitlePreferences({
        mode: composeDraft.overrides?.subtitleOnly
          ? "only"
          : composeDraft.overrides?.subtitleMode,
        sourcePolicy: composeDraft.overrides?.subtitleSourcePolicy,
        languageMode: composeDraft.overrides?.subtitleLanguageMode,
        languages: composeDraft.overrides?.subtitleLanguages,
        format: composeDraft.overrides?.subtitleFormat,
      });

      setTimeout(() => {
        setUrl(composeDraft.url);
        updateSettings({ downloadsSelectedPreset: presetId });
        setOutputFormat(composeDraft.overrides?.format || inferOutputFormat(presetId));
        setCustomDownloadDir(composeDraft.overrides?.downloadDir || "");
        setShowOutputConfig(Boolean(composeDraft.overrides));
        setSubtitleMode(subtitleDefaults.mode);
        setSubtitleSourcePolicy(subtitleDefaults.sourcePolicy);
        setSubtitleLanguageMode(subtitleDefaults.languageMode);
        setSubtitleLanguagesText(
          subtitleLanguagesToString(
            subtitleDefaults.languageMode === "preferred"
              ? splitSubtitleLanguages(settings.preferredSubtitleLanguages)
              : subtitleDefaults.languages
          )
        );
        setSubtitleFormat(subtitleDefaults.format);
        setClipStartTime(composeDraft.overrides?.clipStartTime || "");
        setClipEndTime(composeDraft.overrides?.clipEndTime || "");
        setComposeDraft(undefined);
      }, 0);
      return;
    }

    if (pendingUrl) {
      setTimeout(() => {
        setUrl(pendingUrl);
        setPendingUrl(undefined);
      }, 0);
    }
  }, [composeDraft, inferOutputFormat, pendingUrl, selectedPreset, setComposeDraft, setPendingUrl, settings.preferredSubtitleLanguages, updateSettings]);

  // Keep a valid preset selection after preset edits/deletes.
  useEffect(() => {
    if (selectedPreset === "custom") return;
    const exists = presets.some((p) => p.id === selectedPreset);
    if (!exists) {
      updateSettings({ downloadsSelectedPreset: "default" });
    }
  }, [presets, selectedPreset, updateSettings]);

  useEffect(() => {
    if (selectedPreset === "custom") return;
    const timer = window.setTimeout(() => {
      applyPresetSubtitleDefaults(selectedPreset, settings.preferredSubtitleLanguages);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [applyPresetSubtitleDefaults, presets, selectedPreset, settings.preferredSubtitleLanguages]);

  useEffect(() => {
    const trimmed = url.trim();
    const requestId = urlPreviewRequestRef.current + 1;
    urlPreviewRequestRef.current = requestId;
    const useDownloadGram =
      isInstagramUrl(trimmed) && settings.instagramEngine !== "yt-dlp";
    const cacheKey = `${settings.instagramEngine}:${trimmed}`;

    if (!trimmed || isDirectImageUrl(trimmed) || (looksLikePlaylistUrl(trimmed) && !preferSingleVideo)) {
      const timer = window.setTimeout(() => {
        if (urlPreviewRequestRef.current !== requestId) return;
        setUrlPreview(null);
        setUrlPreviewError(null);
        setUrlPreviewStatus("idle");
        if (!isInstagramUrl(trimmed)) {
          setInstagramMediaSummary(null);
        }
      }, 0);
      return () => window.clearTimeout(timer);
    }

    if (!isInstagramUrl(trimmed) && quickProbeMediaUrl(trimmed) === "unsupported") {
      const timer = window.setTimeout(() => {
        if (urlPreviewRequestRef.current !== requestId) return;
        setUrlPreview(null);
        setUrlPreviewError(null);
        setUrlPreviewStatus("idle");
        setInstagramMediaSummary(null);
      }, 0);
      return () => window.clearTimeout(timer);
    }

    const cached = urlPreviewCacheRef.current.get(cacheKey);
    if (cached) {
      const timer = window.setTimeout(() => {
        if (urlPreviewRequestRef.current !== requestId) return;
        setUrlPreview(cached);
        setUrlPreviewError(null);
        setUrlPreviewStatus("ready");
        setInstagramMediaSummary(
          useDownloadGram
            ? instagramSummaryFromMediaCollection(cached.mediaCollectionSummary)
            : null
        );
      }, 0);
      return () => window.clearTimeout(timer);
    }

    const loadingTimer = window.setTimeout(() => {
      if (urlPreviewRequestRef.current !== requestId) return;
      setUrlPreview(null);
      setUrlPreviewError(null);
      setUrlPreviewStatus("loading");
      if (!useDownloadGram) {
        setInstagramMediaSummary(null);
      }
    }, 0);

    const fetchTimer = window.setTimeout(() => {
      fetchMediaInfo(trimmed)
        .then((info) => {
          urlPreviewCacheRef.current.set(cacheKey, info);
          if (urlPreviewRequestRef.current !== requestId) return;
          setUrlPreview(info);
          setUrlPreviewError(null);
          setUrlPreviewStatus("ready");
          setInstagramMediaSummary(
            useDownloadGram
              ? instagramSummaryFromMediaCollection(info.mediaCollectionSummary)
              : null
          );
        })
        .catch((error) => {
          if (urlPreviewRequestRef.current !== requestId) return;
          setUrlPreview(null);
          setUrlPreviewError(String(error).replace(/^Error:\s*/i, "").slice(0, 220));
          setUrlPreviewStatus("error");
          setInstagramMediaSummary(null);
        });
    }, 320);

    return () => {
      window.clearTimeout(loadingTimer);
      window.clearTimeout(fetchTimer);
    };
  }, [settings.instagramEngine, url, preferSingleVideo]);

  useEffect(() => {
    const trimmed = url.trim();
    const requestId = playlistRequestRef.current + 1;
    playlistRequestRef.current = requestId;

    if (isDemoModeEnabled() && getMarketingCaptureState() === "playlist") {
      const timer = window.setTimeout(() => {
        if (playlistRequestRef.current !== requestId) return;
        setPlaylistEntries(MARKETING_PLAYLIST_ENTRIES);
        setPlaylistSelectedKeys(new Set(["garden-01", "garden-03", "garden-04"]));
        setPlaylistStatus("ready");
        setPlaylistError(null);
        setPlaylistTruncated(false);
      }, 0);
      return () => window.clearTimeout(timer);
    }

    if (!trimmed || !looksLikePlaylistUrl(trimmed) || preferSingleVideo) {
      const timer = window.setTimeout(() => {
        if (playlistRequestRef.current !== requestId) return;
        setPlaylistStatus(preferSingleVideo && looksLikePlaylistUrl(trimmed) ? "ready" : "idle");
        if (!preferSingleVideo) {
          setPlaylistEntries([]);
          setPlaylistSelectedKeys(new Set());
          setPlaylistError(null);
          setPlaylistTruncated(false);
        }
      }, 0);
      return () => window.clearTimeout(timer);
    }

    const loadingTimer = window.setTimeout(() => {
      if (playlistRequestRef.current !== requestId) return;
      setPlaylistStatus("loading");
      setPlaylistEntries([]);
      setPlaylistSelectedKeys(new Set());
      setPlaylistError(null);
      setPlaylistTruncated(false);
    }, 0);

    const scanTimer = window.setTimeout(() => {
      fetchPlaylistEntries(trimmed)
        .then((result) => {
          if (playlistRequestRef.current !== requestId) return;
          setPlaylistEntries(result.entries);
          setPlaylistSelectedKeys(new Set(result.entries.map((entry) => entry.key)));
          setPlaylistTruncated(Boolean(result.truncated));
          setPlaylistError(null);
          setPlaylistStatus("ready");
        })
        .catch((error) => {
          if (playlistRequestRef.current !== requestId) return;
          setPlaylistEntries([]);
          setPlaylistSelectedKeys(new Set());
          setPlaylistError(String(error).replace(/^Error:\s*/i, "").slice(0, 280));
          setPlaylistStatus("error");
          setPlaylistTruncated(false);
        });
    }, 360);

    return () => {
      window.clearTimeout(loadingTimer);
      window.clearTimeout(scanTimer);
    };
  }, [url, settings.cookiesFilePath, preferSingleVideo]);

  // Reset single-video preference when the pasted URL changes.
  useEffect(() => {
    const resetTimer = window.setTimeout(() => setPreferSingleVideo(false), 0);
    return () => window.clearTimeout(resetTimer);
  }, [url]);

  const isInstagramImageOnly = instagramMediaSummary?.isImageOnly ?? false;
  const outputConfigOpen = showOutputConfig && !isInstagramImageOnly;

  const prevJobsCountRef = useRef(jobs.length);
  useEffect(() => {
    prevJobsCountRef.current = jobs.length;
  }, [jobs.length]);

  // Framer Motion Variants for List Items
  const itemVariants: Variants = {
    initial: { opacity: 0, y: 10, scale: 0.98 },
    animate: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 400, damping: 25 } },
    exit: { opacity: 0, scale: 0.95, transition: { duration: 0.2 } },
    hover: { scale: 1.005, transition: { duration: 0.2 } }
  };

  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(interval);
  }, []);

  const formatRelativeTime = (ts: number) => {
    const diffMs = now - ts;
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 10) return "just now";
    if (diffSec < 60) return `${diffSec}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 7) return `${diffDay}d ago`;
    return new Date(ts).toLocaleDateString();
  };

  const formatDownloadCount = useCallback((count: number) => {
    return `${count} download${count === 1 ? "" : "s"}`;
  }, []);

  const [sortMode, setSortMode] = useState<"newest" | "status">("newest");
  const [statusFilter, setStatusFilter] = useState<DownloadStatusFilter>("all");

  const getStatusRank = (status: string) => {
    if (status === "Downloading" || status === "Post-processing") return 0;
    if (status === "Queued") return 1;
    if (status === "Paused") return 2;
    if (status === "Stopped") return 3;
    if (status === "Failed") return 4;
    if (status === "Done") return 5;
    return 6;
  };

  const sortedJobs = useMemo(() => {
    const copy = [...jobs];
    if (sortMode === "newest") {
      return copy.sort((a, b) => getJobTs(b) - getJobTs(a));
    }
    if (sortMode === "status") {
      return copy.sort((a, b) => {
        const rankDiff = getStatusRank(a.status) - getStatusRank(b.status);
        if (rankDiff !== 0) return rankDiff;
        if (
          (a.status === "Queued" || a.status === "Paused" || a.status === "Stopped") &&
          (b.status === "Queued" || b.status === "Paused" || b.status === "Stopped")
        ) {
          const ao = typeof a.queueOrder === "number" ? a.queueOrder : a.createdAt;
          const bo = typeof b.queueOrder === "number" ? b.queueOrder : b.createdAt;
          return bo - ao;
        }
        return getJobTs(b) - getJobTs(a);
      });
    }
    return copy.sort((a, b) => {
      const rankDiff = getStatusRank(a.status) - getStatusRank(b.status);
      if (rankDiff !== 0) return rankDiff;
      return getJobTs(b) - getJobTs(a);
    });
  }, [jobs, sortMode]);

  const matchesStatusFilter = useCallback(
    (status: DownloadStatusFilter, jobStatus: typeof jobs[number]["status"]) => {
      if (status === "all") return true;
      if (status === "active") {
        return jobStatus === "Downloading" || jobStatus === "Post-processing";
      }
      if (status === "queued") return jobStatus === "Queued" || jobStatus === "Paused" || jobStatus === "Stopped";
      if (status === "failed") return jobStatus === "Failed";
      if (status === "done") return jobStatus === "Done";
      return true;
    },
    []
  );

  const MAX_RECENT_TERMINAL_JOBS = 5;
  const liveJobs = useMemo(
    () =>
      sortedJobs.filter(
        (job) =>
          job.status === "Downloading" ||
          job.status === "Post-processing" ||
          job.status === "Queued" ||
          job.status === "Paused" ||
          job.status === "Stopped"
      ),
    [sortedJobs]
  );
  const recentTerminalJobs = useMemo(
    () =>
      sortedJobs
        .filter((job) => job.status === "Done" || job.status === "Failed")
        .slice(0, MAX_RECENT_TERMINAL_JOBS),
    [sortedJobs]
  );
  const visibleLiveJobs = useMemo(
    () => liveJobs.filter((job) => matchesStatusFilter(statusFilter, job.status)),
    [liveJobs, matchesStatusFilter, statusFilter]
  );
  const visibleRecentJobs = useMemo(
    () => recentTerminalJobs.filter((job) => matchesStatusFilter(statusFilter, job.status)),
    [matchesStatusFilter, recentTerminalJobs, statusFilter]
  );
  const filteredTerminalCount = useMemo(
    () =>
      sortedJobs.filter(
        (job) =>
          (job.status === "Done" || job.status === "Failed") &&
          matchesStatusFilter(statusFilter, job.status)
      ).length,
    [matchesStatusFilter, sortedJobs, statusFilter]
  );

  const overflowCount = Math.max(
    0,
    filteredTerminalCount - visibleRecentJobs.length
  );
  const hasCompletedJobs = jobs.some(
    (job) => job.status === "Done" || job.status === "Failed"
  );
  const hasVisibleJobs = visibleLiveJobs.length > 0 || visibleRecentJobs.length > 0;

  const queuedCount = useMemo(
    () => jobs.filter((job) => job.status === "Queued" || job.status === "Paused" || job.status === "Stopped").length,
    [jobs]
  );
  const queueJobIds = useMemo(
    () => jobs
      .filter((job) => job.status === "Queued" || job.status === "Paused" || job.status === "Stopped")
      .map((job) => job.id),
    [jobs]
  );
  const allQueueJobsSelected =
    queueJobIds.length > 0 && queueJobIds.every((id) => selectedIds.includes(id));
  const startableQueuedCount = useMemo(
    () => jobs.filter((job) => job.status === "Queued").length,
    [jobs]
  );
  const activeCount = useMemo(
    () =>
      jobs.filter(
        (job) =>
          job.status === "Downloading" || job.status === "Post-processing"
      ).length,
    [jobs]
  );
  const doneCount = useMemo(
    () => jobs.filter((job) => job.status === "Done").length,
    [jobs]
  );
  const failedCount = useMemo(
    () => jobs.filter((job) => job.status === "Failed").length,
    [jobs]
  );
  const selectedFailedCount = useMemo(
    () => jobs.filter((job) => selectedIds.includes(job.id) && job.status === "Failed").length,
    [jobs, selectedIds]
  );
  const queueMetaById = useMemo(() => {
    const queueItems = jobs
      .filter((job) => job.status === "Queued" || job.status === "Paused" || job.status === "Stopped")
      .sort((a, b) => {
        const ao = typeof a.queueOrder === "number" ? a.queueOrder : a.createdAt;
        const bo = typeof b.queueOrder === "number" ? b.queueOrder : b.createdAt;
        return bo - ao;
      });
    const queueRunning = activeCount > 0;

    return new Map(
      queueItems.map((job, index) => [
        job.id,
        {
          position: index + 1,
          canMoveUp: index > 0,
          canMoveDown: index < queueItems.length - 1,
          statusLabel: queueRunning ? "Waiting" : "Queued",
          detail: queueRunning
            ? `Starts automatically when a slot opens${queueItems.length > 1 ? ` • #${index + 1} in queue` : ""}`
            : "Start queue to begin",
        },
      ])
    );
  }, [jobs, activeCount]);

  const handleAdd = async () => {
    const trimmedUrl = url.trim();
    if (!trimmedUrl || isAdding) return;

    const isPlaylistFlow = looksLikePlaylistUrl(trimmedUrl) && !preferSingleVideo;
    const selectedPlaylistEntries =
      isPlaylistFlow && playlistStatus === "ready"
        ? playlistEntries.filter((entry) => playlistSelectedKeys.has(entry.key))
        : [];

    const singleFromMixed =
      preferSingleVideo ? singleVideoUrlFromMixedUrl(trimmedUrl) : null;
    const jobUrl = singleFromMixed || trimmedUrl;

    if (isPlaylistFlow) {
      if (playlistStatus === "loading") {
        toast.error("Still scanning playlist", {
          description: "Wait for the entry list to finish, then add selected items.",
        });
        return;
      }
      if (playlistStatus === "error" || playlistEntries.length === 0) {
        toast.error("Playlist could not be loaded", {
          description:
            playlistError ||
            "Private lists need a cookies.txt file in Settings → Download Engine.",
        });
        return;
      }
      if (selectedPlaylistEntries.length === 0) {
        toast.error("Pick at least one playlist item");
        return;
      }
    }

    setIsAdding(true);
    try {
      const finalTemplate = `${filenameBase.trim() || "%(title)s"}.%(ext)s`;
      const clipStartTrimmed = clipStartTime.trim();
      const clipEndTrimmed = clipEndTime.trim();
      const clipOverridesNeeded = Boolean(clipStartTrimmed || clipEndTrimmed);

      if (clipOverridesNeeded && !buildClipSection(clipStartTrimmed, clipEndTrimmed)) {
        toast.error("Clip times need a valid range", {
          description: "Use seconds, mm:ss, or hh:mm:ss, and make sure the end is after the start.",
        });
        return;
      }
      if (clipOverridesNeeded && isInstagramUrl(trimmedUrl) && settings.instagramEngine !== "yt-dlp") {
        toast.error("Clip download is not available for Instagram yet", {
          description: "Leave start and end blank for Instagram downloads, or switch Instagram Engine to yt-dlp in Settings.",
        });
        return;
      }
      if (clipOverridesNeeded && isDirectImageInput) {
        toast.error("Clip download is only for timed media", {
          description: "Images do not have a timeline, so leave start and end blank.",
        });
        return;
      }
      if (clipOverridesNeeded && isPlaylistFlow && selectedPlaylistEntries.length > 1) {
        toast.error("Clip range applies to one video at a time", {
          description: "Select a single playlist item, or clear clip start/end for batch add.",
        });
        return;
      }

      const customDirTrimmed = customDownloadDir.trim();
      const selectedPresetConfig = presets.find((preset) => preset.id === selectedPreset);
      const presetSubtitleDefaults = normalizeSubtitlePreferences({
        mode: selectedPresetConfig?.subtitleOnly ? "only" : selectedPresetConfig?.subtitleMode,
        sourcePolicy: selectedPresetConfig?.subtitleSourcePolicy,
        languageMode: selectedPresetConfig?.subtitleLanguageMode,
        languages: selectedPresetConfig?.subtitleLanguages,
        format: selectedPresetConfig?.subtitleFormat,
      });
      const resolvedSubtitleLanguages = splitSubtitleLanguages(subtitleLanguagesText);
      const subtitleOverridesNeeded =
        subtitleMode !== presetSubtitleDefaults.mode ||
        subtitleSourcePolicy !== presetSubtitleDefaults.sourcePolicy ||
        subtitleLanguageMode !== presetSubtitleDefaults.languageMode ||
        subtitleFormat !== presetSubtitleDefaults.format ||
        (subtitleLanguageMode === "custom" &&
          subtitleLanguagesToString(resolvedSubtitleLanguages) !==
            subtitleLanguagesToString(presetSubtitleDefaults.languages));

      const overrides =
        outputConfigOpen ||
        isCustomPreset ||
        Boolean(customDirTrimmed) ||
        subtitleOverridesNeeded ||
        clipOverridesNeeded
          ? {
              ...(outputConfigOpen || isCustomPreset ? { filenameTemplate: finalTemplate } : {}),
              ...(isCustomPreset ? { format: outputFormat } : {}),
              ...(customDirTrimmed ? { downloadDir: customDirTrimmed } : {}),
              ...(clipOverridesNeeded
                ? {
                    ...(clipStartTrimmed ? { clipStartTime: clipStartTrimmed } : {}),
                    ...(clipEndTrimmed ? { clipEndTime: clipEndTrimmed } : {}),
                    chapterMode,
                  }
                : {}),
              ...(subtitleOverridesNeeded
                ? {
                    subtitleMode,
                    subtitleSourcePolicy,
                    subtitleLanguageMode,
                    subtitleLanguages:
                      subtitleLanguageMode === "custom"
                        ? resolvedSubtitleLanguages
                        : undefined,
                    subtitleFormat,
                    subtitleOnly: subtitleMode === "only",
                    origin: "app" as const,
                  }
                : {}),
            }
          : undefined;

      const presetIdToUse = isDirectImageInput
        ? "default"
        : instagramMediaSummary?.isImageOnly
          ? "default"
        : isCustomPreset
          ? "default"
          : selectedPreset;
      const safeOverrides = isDirectImageInput || instagramMediaSummary?.isImageOnly
        ? {
            ...(customDirTrimmed ? { downloadDir: customDirTrimmed } : {}),
            ...(outputConfigOpen || isCustomPreset ? { filenameTemplate: finalTemplate } : {}),
          }
        : overrides;

      const targets =
        isPlaylistFlow && selectedPlaylistEntries.length > 0
          ? selectedPlaylistEntries.map((entry) => ({
              url: entry.url,
              title: entry.title,
              mediaDurationSeconds: entry.durationSeconds,
            }))
          : [
              {
                url: jobUrl,
                title: urlPreview?.title,
                mediaDurationSeconds: urlPreview?.mediaDurationSeconds,
                preview: urlPreviewStatus === "ready" ? urlPreview : null,
              },
            ];

      const createdIds: string[] = [];
      for (const target of targets) {
        const previewSource = "preview" in target && target.preview ? {
          ...(target.preview.uploader ? { creator: target.preview.uploader } : {}),
          ...(target.preview.uploaderId ? { creatorId: target.preview.uploaderId } : {}),
          ...(target.preview.playlist ? { playlist: target.preview.playlist } : {}),
          ...(target.preview.playlistId ? { playlistId: target.preview.playlistId } : {}),
        } : undefined;
        const rule = resolveSourceRule(target.url, previewSource, sourceRules);
        const collection = collections.find((item) => item.id === rule?.collectionId);
        const id = addJob(target.url, rule?.presetId || presetIdToUse, applySourceRule(safeOverrides, rule, collection));
        createdIds.push(id);
        if (rule) updateJob(id, { collectionId: rule.collectionId, appliedRuleId: rule.id, sourceRef: previewSource });

        if ("preview" in target && target.preview) {
          const preview = target.preview;
          updateJob(id, {
            ...(preview.title ? { title: preview.title } : {}),
            ...(preview.thumbnailUrl && /^https?:/i.test(preview.thumbnailUrl)
              ? { thumbnail: preview.thumbnailUrl, thumbnailStatus: "ready" as const }
              : {}),
            ...(preview.mediaDurationSeconds
              ? { mediaDurationSeconds: preview.mediaDurationSeconds }
              : {}),
            ...(preview.mediaCollectionSummary
              ? { mediaCollectionSummary: preview.mediaCollectionSummary }
              : {}),
            subtitleStatus:
              preview.hasManualSubtitles || preview.hasAutoSubtitles
                ? "available"
                : "unavailable",
            hasManualSubtitles: preview.hasManualSubtitles,
            hasAutoSubtitles: preview.hasAutoSubtitles,
            availableSubtitleLanguages: preview.availableSubtitleLanguages,
            hasChapters: preview.chapters.length > 0,
            chapters: preview.chapters,
            sourceRef: {
              ...(preview.uploader ? { creator: preview.uploader } : {}),
              ...(preview.uploaderId ? { creatorId: preview.uploaderId } : {}),
              ...(preview.playlist ? { playlist: preview.playlist } : {}),
              ...(preview.playlistId ? { playlistId: preview.playlistId } : {}),
            },
          });
        } else {
          updateJob(id, {
            ...(target.title ? { title: target.title } : {}),
            ...(target.mediaDurationSeconds
              ? { mediaDurationSeconds: target.mediaDurationSeconds }
              : {}),
          });
        }
      }

      setUrl("");
      setUrlPreview(null);
      setUrlPreviewError(null);
      setUrlPreviewStatus("idle");
      setPlaylistStatus("idle");
      setPlaylistEntries([]);
      setPlaylistSelectedKeys(new Set());
      setPlaylistError(null);
      setPlaylistTruncated(false);
      setPreferSingleVideo(false);

      if (addMode === "start") {
        startQueuedJobs(createdIds, { ignoreQueuePaused: true });
        for (const id of createdIds) {
          const job = useDownloadsStore.getState().jobs.find((j) => j.id === id);
          if (job?.status === "Queued") {
            updateJob(id, { statusDetail: "Waiting for an open slot" });
          }
        }
      } else {
        for (const id of createdIds) {
          updateJob(id, { statusDetail: "Queued" });
        }
      }

      for (const id of createdIds) {
        void fetchMetadata(id);
      }

      if (createdIds.length > 1) {
        toast.success(`Added ${createdIds.length} playlist items`, {
          description: addMode === "start" ? "Downloads will start as slots open." : "Queued for later.",
        });
      }
    } finally {
      setIsAdding(false);
    }
  };

  const handleBrowseDir = async () => {
    const selected = await openDialog({
      directory: true,
      multiple: false,
      defaultPath: settings.defaultDownloadDir || undefined,
    });
    if (selected) {
      setCustomDownloadDir(selected as string);
    }
  };

  const handleStartQueue = () => {
    startQueuedJobs();
  };

  const subtitleHint =
    subtitleMode === "off"
      ? "No subtitles"
      : subtitleMode === "only"
        ? "Download subtitles only"
        : "Download sidecar subtitles when available";
  const clipValidationMessage = useMemo(() => {
    if (!clipStartTime.trim() && !clipEndTime.trim()) return null;
    return buildClipSection(clipStartTime, clipEndTime)
      ? null
      : "Enter a valid range like 0:30 to 2:15. End time must be after start time.";
  }, [clipEndTime, clipStartTime]);

  const sponsorBlockDisabled = Boolean(url.trim()) && !isYouTubeUrl(url.trim());
  const sponsorBlockDisabledReason = isInstagramUrl(url.trim())
    ? "Instagram downloads do not use yt-dlp, so SponsorBlock cannot apply."
    : "SponsorBlock only works on YouTube URLs.";

  const handleSponsorBlockModeChange = useCallback(
    (mode: SponsorBlockMode) => {
      updateSettings({ sponsorBlockMode: mode });
    },
    [updateSettings]
  );

  const handleSponsorBlockCategoriesChange = useCallback(
    (categories: SponsorBlockCategoryId[]) => {
      updateSettings({ sponsorBlockCategories: categories });
    },
    [updateSettings]
  );

  const handleRetryFailed = () => {
    retryFailedJobs();
  };

  const handleToggleSelection = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleToggleQueueSelection = () => {
    setSelectedIds((previous) => {
      const queueIds = new Set(queueJobIds);
      const allSelected = queueJobIds.length > 0 && queueJobIds.every((id) => previous.includes(id));

      return allSelected
        ? previous.filter((id) => !queueIds.has(id))
        : [...new Set([...previous, ...queueJobIds])];
    });
  };

  const handleRetrySelected = () => {
    if (!selectedIds.length) return;
    retryFailedJobs(selectedIds);
    toast.success(`Retrying ${formatDownloadCount(selectedFailedCount)}`);
  };

  const handleCopySelected = async () => {
    const selectedDoneCount = jobs.filter(
      (job) => selectedIds.includes(job.id) && job.status === "Done" && getExplicitOutputPaths(job).length > 0
    ).length;
    const copyablePaths = jobs
      .filter(
        (job) =>
          selectedIds.includes(job.id) &&
          job.status === "Done" &&
          getExplicitOutputPaths(job).length > 0
      )
      .flatMap((job) => getExplicitOutputPaths(job));

    if (copyablePaths.length === 0) return;

    try {
      await copyFilesToClipboard(copyablePaths);
      toast.success("Copied to clipboard", {
        description: `${copyablePaths.length} file${copyablePaths.length === 1 ? "" : "s"} from ${formatDownloadCount(selectedDoneCount)}`,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      toast.error(`Failed to copy: ${message}`);
    }
  };

  const handleRemoveSelected = () => {
    if (!selectedIds.length) return;
    const removedCount = selectedIds.length;
    selectedIds.forEach((id) => {
      void cleanupThumbnailByJobId(id);
      removeJob(id);
    });
    setSelectedIds([]);
    toast.success(`Removed ${formatDownloadCount(removedCount)}`);
  };

  const handleClearCompleted = () => {
    const completed = jobs.filter((job) => job.status === "Done" || job.status === "Failed");
    if (!completed.length) return;
    completed.forEach((job) => {
      void cleanupThumbnailByJobId(job.id);
      removeJob(job.id);
    });
    setSelectedIds((prev) =>
      prev.filter((id) => !completed.some((job) => job.id === id))
    );
    toast.success("Cleared completed downloads", {
      description: formatDownloadCount(completed.length),
    });
  };

  const handleRemoveJob = (jobId: string) => {
    void cleanupThumbnailByJobId(jobId);
    removeJob(jobId);
    setSelectedIds((prev) => prev.filter((id) => id !== jobId));
  };

  const handleViewLogs = (jobId: string) => {
    setActiveJobId(jobId);
    setScreen("logs");
  };

  const handlePauseJob = async (jobId: string) => {
    await pauseActiveDownload(jobId);
  };

  const handleStopJob = async (jobId: string) => {
    await stopPostProcessingJob(jobId);
  };

  const handleResumePausedJob = (jobId: string) => {
    resumePausedDownload(jobId);
  };

  const handleChangePausedPreset = (jobId: string, presetId: string) => {
    changePausedJobPreset(jobId, presetId);
  };

  const canFillMoreSlots = activeCount < (settings.maxConcurrency || 1);
  const canCopySelected = jobs.some(
    (job) => selectedIds.includes(job.id) && job.status === "Done" && getExplicitOutputPaths(job).length > 0
  );
  const showStartQueue = startableQueuedCount > 0 && activeCount === 0;
  const destinationLabel = customDownloadDir.trim() || settings.defaultDownloadDir || "Default folder";

  return (
    <div className="relative mx-auto w-full max-w-6xl overflow-x-hidden bg-background pb-10" role="main">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-10 top-0 h-56 w-56 rounded-full bg-sky-500/10 blur-3xl" />
        <div className="absolute right-[-4rem] top-10 h-72 w-72 rounded-full bg-emerald-500/8 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-64 bg-[linear-gradient(180deg,rgba(148,163,184,0.08),transparent)] dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.035),transparent)]" />
      </div>
      <FadeInStagger className="relative pb-8">
        <FadeInItem className="shrink-0">
          <header className="px-4 pb-1.5 pt-2.5">
            <div className="rounded-[24px] border border-border/60 bg-card/78 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] dark:shadow-[0_20px_80px_rgba(0,0,0,0.22)]">
              <div className="px-3 py-2">
                <div className="space-y-1.5">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <h2 className="text-[1.45rem] font-bold tracking-tight">Downloads</h2>
                      <div className="text-[11px] text-muted-foreground">
                        {isCustomPreset ? "Custom" : selectedPresetConfig?.name || "Default"} • {destinationLabel}
                      </div>
                    </div>
                  </div>

                  <DownloadInputSection
                    url={url}
                    setUrl={setUrl}
                    isAdding={isAdding}
                    autoPasteLinks={settings.autoPasteLinks && persistenceReady}
                    shouldAutoPasteUrl={shouldAutoPasteUrl}
                    onAdd={handleAdd}
                    selectedPreset={selectedPreset}
                    onPresetChange={handlePresetChange}
                    presets={presets}
                    isDirectImageUrl={isDirectImageInput}
                    addMode={addMode}
                    setAddMode={setAddMode}
                    showOutputConfig={outputConfigOpen}
                    onToggleOutputConfig={() => {
                      if (isInstagramImageOnly) return;
                      setShowOutputConfig(!showOutputConfig);
                    }}
                    filenameBase={filenameBase}
                    onFilenameChange={setFilenameBase}
                    outputFormat={outputFormat}
                    onFormatChange={setOutputFormat}
                    customDownloadDir={customDownloadDir}
                    onBrowseDir={handleBrowseDir}
                    isCustomPreset={isCustomPreset}
                    defaultDownloadDir={settings.defaultDownloadDir || ""}
                    subtitleMode={subtitleMode}
                    onSubtitleModeChange={setSubtitleMode}
                    subtitleSourcePolicy={subtitleSourcePolicy}
                    onSubtitleSourcePolicyChange={setSubtitleSourcePolicy}
                    subtitleLanguageMode={subtitleLanguageMode}
                    onSubtitleLanguageModeChange={setSubtitleLanguageMode}
                    subtitleLanguagesText={subtitleLanguagesText}
                    onSubtitleLanguagesTextChange={setSubtitleLanguagesText}
                    subtitleFormat={subtitleFormat}
                    onSubtitleFormatChange={setSubtitleFormat}
                    subtitleHint={subtitleHint}
                    clipStartTime={clipStartTime}
                    onClipStartTimeChange={setClipStartTime}
                    clipEndTime={clipEndTime}
                    onClipEndTimeChange={setClipEndTime}
                    clipValidationMessage={clipValidationMessage}
                    chapterMode={chapterMode}
                    onChapterModeChange={setChapterMode}
                    instagramMediaSummary={instagramMediaSummary}
                    urlPreviewStatus={urlPreviewStatus}
                    urlPreview={urlPreview}
                    urlPreviewError={urlPreviewError}
                    sponsorBlockMode={settings.sponsorBlockMode}
                    onSponsorBlockModeChange={handleSponsorBlockModeChange}
                    sponsorBlockCategories={settings.sponsorBlockCategories}
                    onSponsorBlockCategoriesChange={handleSponsorBlockCategoriesChange}
                    sponsorBlockDisabled={sponsorBlockDisabled}
                    sponsorBlockDisabledReason={sponsorBlockDisabledReason}
                    playlistStatus={playlistStatus}
                    playlistEntries={playlistEntries}
                    playlistSelectedKeys={playlistSelectedKeys}
                    onPlaylistSelectedKeysChange={setPlaylistSelectedKeys}
                    playlistError={playlistError}
                    playlistTruncated={playlistTruncated}
                    canPreferSingleVideo={canPreferSingleVideoFromUrl(url.trim())}
                    preferSingleVideo={preferSingleVideo}
                    onPreferSingleVideoChange={setPreferSingleVideo}
                  />

                  {url.trim() && (
                    <div className="flex flex-col gap-2 border-t border-border/60 pt-3 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-xs text-muted-foreground">Not sure whether this link will work? Check it first without downloading.</p>
                      <Button variant="outline" size="sm" disabled={checkingLink} onClick={() => void (async () => { const checkedUrl = url.trim(); setCheckingLink(true); const result = await probeReliability(checkedUrl); setLinkCheckResult({ url: checkedUrl, message: result.message }); setCheckingLink(false); })()}>{checkingLink ? "Checking link…" : "Check this link"}</Button>
                    </div>
                  )}
                  {linkCheckResult?.url === url.trim() && <p className="rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground">{linkCheckResult.message}</p>}

                  <DownloadStatsBar 
                    queuedCount={queuedCount}
                    activeCount={activeCount}
                    failedCount={failedCount}
                    doneCount={doneCount}
                    statusFilter={statusFilter}
                    onStatusFilterChange={setStatusFilter}
                    onStartQueue={handleStartQueue}
                    showStartQueue={showStartQueue}
                    onRetryFailed={handleRetryFailed}
                    canRetryFailed={canFillMoreSlots && jobs.some((job) => job.status === "Failed")}
                    sortMode={sortMode}
                    onSortModeChange={setSortMode}
                  />
                </div>
              </div>
            </div>
          </header>
        </FadeInItem>

        <DownloadList 
          liveJobs={visibleLiveJobs}
          recentJobs={visibleRecentJobs}
          totalJobs={jobs.length}
          hasVisibleJobs={hasVisibleJobs}
          overflowCount={overflowCount}
          hasCompletedJobs={hasCompletedJobs}
          statusFilter={statusFilter}
          onResetFilter={() => setStatusFilter("all")}
          selectedIds={selectedIds}
          queueJobIds={queueJobIds}
          allQueueJobsSelected={allQueueJobsSelected}
          onToggleQueueSelection={handleToggleQueueSelection}
          onToggleSelection={handleToggleSelection}
          onRetrySelected={handleRetrySelected}
          canRetrySelected={selectedFailedCount > 0 && canFillMoreSlots}
          selectedFailedCount={selectedFailedCount}
          onCopySelected={handleCopySelected}
          canCopySelected={canCopySelected}
          onRemoveSelected={handleRemoveSelected}
          onClearCompleted={handleClearCompleted}
          onRemoveJob={handleRemoveJob}
          onViewLogs={handleViewLogs}
          onRetryJob={(jobId) => retryFailedJobs([jobId])}
          onPauseJob={handlePauseJob}
          onStopJob={handleStopJob}
          onResumePausedJob={handleResumePausedJob}
          onChangePausedPreset={handleChangePausedPreset}
          queueMetaById={queueMetaById}
          itemVariants={itemVariants}
          formatRelativeTime={formatRelativeTime}
        />
      </FadeInStagger>
    </div>
  );
}
