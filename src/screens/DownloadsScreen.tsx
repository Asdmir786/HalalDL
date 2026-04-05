import { Variants } from "framer-motion";
import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { useDownloadsStore } from "@/store/downloads";
import { usePresetsStore } from "@/store/presets";
import { useSettingsStore } from "@/store/settings";
import { useLogsStore } from "@/store/logs";
import { useNavigationStore } from "@/store/navigation";
import { useRuntimeStore } from "@/store/runtime";
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
  fetchMetadata,
  inspectInstagramMedia,
  isDirectImageUrl,
  pauseActiveDownload,
  resumePausedDownload,
  retryFailedJobs,
  startQueuedJobs,
  stopPostProcessingJob,
  type InstagramMediaSummary,
} from "@/lib/downloader";
import { isInstagramUrl } from "@/lib/media-engine";
import { copyFilesToClipboard } from "@/lib/commands";
import { getExplicitOutputPaths } from "@/lib/output-paths";
import { toast } from "sonner";

import { DownloadInputSection } from "./downloads/components/DownloadInputSection";
import { DownloadStatsBar, type DownloadStatusFilter } from "./downloads/components/DownloadStatsBar";
import { DownloadList } from "./downloads/components/DownloadList";
import { getJobTs } from "./downloads/utils";

export function DownloadsScreen() {
  const { settings, updateSettings } = useSettingsStore();
  const [url, setUrl] = useState("");
  
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

  const { presets } = usePresetsStore();
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
  const { setActiveJobId } = useLogsStore();
  const { setScreen } = useNavigationStore();
  const isCustomPreset = selectedPreset === "custom";
  const isDirectImageInput = isDirectImageUrl(url.trim());

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
    let cancelled = false;

    if (!trimmed || !isInstagramUrl(trimmed)) {
      setInstagramMediaSummary(null);
      return;
    }

    inspectInstagramMedia(trimmed)
      .then((summary) => {
        if (!cancelled) {
          setInstagramMediaSummary(summary);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setInstagramMediaSummary(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [url]);

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
    const queued = jobs
      .filter((job) => job.status === "Queued")
      .sort((a, b) => {
        const ao = typeof a.queueOrder === "number" ? a.queueOrder : a.createdAt;
        const bo = typeof b.queueOrder === "number" ? b.queueOrder : b.createdAt;
        return bo - ao;
      });
    const queueRunning = activeCount > 0;

    return new Map(
      queued.map((job, index) => [
        job.id,
        {
          position: index + 1,
          statusLabel: queueRunning ? "Waiting" : "Queued",
          detail: queueRunning
            ? `Starts automatically when a slot opens${queued.length > 1 ? ` • #${index + 1} in queue` : ""}`
            : "Start queue to begin",
        },
      ])
    );
  }, [jobs, activeCount]);

  const handleAdd = async () => {
    const trimmedUrl = url.trim();
    if (!trimmedUrl || isAdding) return;

    setIsAdding(true);
    try {
      const finalTemplate = `${filenameBase.trim() || "%(title)s"}.%(ext)s`;

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
        showOutputConfig ||
        isCustomPreset ||
        Boolean(customDirTrimmed) ||
        subtitleOverridesNeeded
          ? {
              ...(showOutputConfig || isCustomPreset ? { filenameTemplate: finalTemplate } : {}),
              ...(isCustomPreset ? { format: outputFormat } : {}),
              ...(customDirTrimmed ? { downloadDir: customDirTrimmed } : {}),
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
            ...(showOutputConfig || isCustomPreset ? { filenameTemplate: finalTemplate } : {}),
          }
        : overrides;
      const id = addJob(trimmedUrl, presetIdToUse, safeOverrides);

      setUrl("");

      if (addMode === "start") {
        const started = startQueuedJobs([id]);
        if (started === 0) {
          const queuePaused = useRuntimeStore.getState().queuePaused;
          updateJob(id, {
            statusDetail: queuePaused ? "Queue paused" : "Waiting for an open slot",
          });
        }
      } else {
        updateJob(id, { statusDetail: "Queued" });
      }

      void fetchMetadata(id);
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

  const handleRetryFailed = () => {
    retryFailedJobs();
  };

  const handleToggleSelection = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
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
                    autoPasteLinks={settings.autoPasteLinks}
                    onAdd={handleAdd}
                    selectedPreset={selectedPreset}
                    onPresetChange={handlePresetChange}
                    presets={presets}
                    isDirectImageUrl={isDirectImageInput}
                    addMode={addMode}
                    setAddMode={setAddMode}
                    showOutputConfig={showOutputConfig}
                    onToggleOutputConfig={() => setShowOutputConfig(!showOutputConfig)}
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
                    instagramMediaSummary={instagramMediaSummary}
                  />

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
