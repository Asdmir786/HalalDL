import { Variants } from "framer-motion";
import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";

import { useDownloadsStore } from "@/store/downloads";
import { usePresetsStore } from "@/store/presets";
import { useSettingsStore } from "@/store/settings";
import { useLogsStore } from "@/store/logs";
import { useNavigationStore } from "@/store/navigation";
import {
  normalizeSubtitlePreferences,
  splitSubtitleLanguages,
  subtitleLanguagesToString,
} from "@/lib/subtitles";

import { FadeInStagger, FadeInItem } from "@/components/motion/StaggerContainer";
import { fetchMetadata, cleanupThumbnailByJobId, retryFailedJobs, startQueuedJobs } from "@/lib/downloader";
import { copyFilesToClipboard } from "@/lib/commands";
import { toast } from "sonner";

import { DownloadInputSection } from "./downloads/components/DownloadInputSection";
import { DownloadStatsBar } from "./downloads/components/DownloadStatsBar";
import { DownloadList } from "./downloads/components/DownloadList";
import { getJobTs } from "./downloads/utils";

export function DownloadsScreen() {
  const { settings, updateSettings } = useSettingsStore();
  const [url, setUrl] = useState("");
  const selectedPreset = settings.downloadsSelectedPreset || "default";
  
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
  const {
    jobs,
    addJob,
    removeJob,
    pendingUrl,
    setPendingUrl,
    composeDraft,
    setComposeDraft,
  } = useDownloadsStore();
  const { setActiveJobId } = useLogsStore();
  const { setScreen } = useNavigationStore();

  const isCustomPreset = selectedPreset === "custom";

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
    if (!isCustom) {
      setOutputFormat(inferOutputFormat(val));
      applyPresetSubtitleDefaults(val, settings.preferredSubtitleLanguages);
    }
  };

  const [selectedIds, setSelectedIds] = useState<string[]>([]);

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

  const [sortMode, setSortMode] = useState<"newest" | "status">("newest");

  const getStatusRank = (status: string) => {
    if (status === "Downloading" || status === "Post-processing") return 0;
    if (status === "Queued") return 1;
    if (status === "Failed") return 2;
    if (status === "Done") return 3;
    return 4;
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
        if (a.status === "Queued" && b.status === "Queued") {
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

  const MAX_VISIBLE = 5;
  const visibleJobs = useMemo(() => {
    const priority = sortedJobs.filter(
      (job) =>
        job.status === "Downloading" ||
        job.status === "Post-processing" ||
        job.status === "Queued"
    );
    const priorityIds = new Set(priority.map((job) => job.id));
    const rest = sortedJobs.filter((job) => !priorityIds.has(job.id));
    return [...priority, ...rest].slice(0, MAX_VISIBLE);
  }, [sortedJobs]);

  const overflowCount = Math.max(0, jobs.length - visibleJobs.length);
  const hasCompletedJobs = jobs.some(
    (job) => job.status === "Done" || job.status === "Failed"
  );

  const queuedCount = useMemo(
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
    if (!url.trim()) return;
    
    // Construct final template: NamePart + .%(ext)s
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

    const presetIdToUse = isCustomPreset ? "default" : selectedPreset;

    const id = addJob(url, presetIdToUse, overrides);
    
    await fetchMetadata(id);

    if (addMode === "start") {
      startQueuedJobs([id]);
    }
    setUrl("");
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
  };

  const handleCopySelected = async () => {
    const copyablePaths = jobs
      .filter(
        (job) =>
          selectedIds.includes(job.id) &&
          job.status === "Done" &&
          Boolean(job.outputPath)
      )
      .map((job) => job.outputPath!)
      .filter(Boolean);

    if (copyablePaths.length === 0) return;

    try {
      await copyFilesToClipboard(copyablePaths);
      toast.success(
        `${copyablePaths.length} file${copyablePaths.length === 1 ? "" : "s"} copied to clipboard`
      );
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      toast.error(`Failed to copy files: ${message}`);
    }
  };

  const handleRemoveSelected = () => {
    if (!selectedIds.length) return;
    selectedIds.forEach((id) => {
      void cleanupThumbnailByJobId(id);
      removeJob(id);
    });
    setSelectedIds([]);
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
  };

  const handleViewLogs = (jobId: string) => {
    setActiveJobId(jobId);
    setScreen("logs");
  };

  const handleRemoveJob = (jobId: string) => {
    void cleanupThumbnailByJobId(jobId);
    removeJob(jobId);
    setSelectedIds((prev) => prev.filter((id) => id !== jobId));
  };

  const canFillMoreSlots = activeCount < (settings.maxConcurrency || 1);
  const canCopySelected = jobs.some(
    (job) => selectedIds.includes(job.id) && job.status === "Done" && Boolean(job.outputPath)
  );
  const showStartQueue = queuedCount > 0 && activeCount === 0;

  return (
    <div className="flex flex-col h-full bg-background max-w-6xl mx-auto w-full" role="main">
      <FadeInStagger className="flex flex-col h-full">
        <FadeInItem>
          <header className="p-6 pb-4 space-y-4">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-bold tracking-tight">Downloads</h2>
              </div>
              <p className="text-muted-foreground text-sm">
                Live queue for active and pending downloads.
              </p>
            </div>
            
        <DownloadInputSection
              url={url}
              setUrl={setUrl}
              autoPasteLinks={settings.autoPasteLinks}
              onAdd={handleAdd}
              selectedPreset={selectedPreset}
              onPresetChange={handlePresetChange}
              presets={presets}
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
        />

            <DownloadStatsBar 
              queuedCount={queuedCount}
              activeCount={activeCount}
              failedCount={failedCount}
              doneCount={doneCount}
              onStartQueue={handleStartQueue}
              showStartQueue={showStartQueue}
              onRetryFailed={handleRetryFailed}
              canRetryFailed={canFillMoreSlots && jobs.some((job) => job.status === "Failed")}
              sortMode={sortMode}
              onSortModeChange={setSortMode}
            />
          </header>
        </FadeInItem>

        <DownloadList 
          jobs={visibleJobs}
          totalJobs={jobs.length}
          overflowCount={overflowCount}
          hasCompletedJobs={hasCompletedJobs}
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
          queueMetaById={queueMetaById}
          itemVariants={itemVariants}
          formatRelativeTime={formatRelativeTime}
        />
      </FadeInStagger>
    </div>
  );
}
