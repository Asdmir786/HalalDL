import { Variants } from "framer-motion";
import { useEffect, useMemo, useState, useRef } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";

import { useDownloadsStore } from "@/store/downloads";
import { usePresetsStore } from "@/store/presets";
import { useSettingsStore } from "@/store/settings";
import { useLogsStore } from "@/store/logs";
import { useNavigationStore } from "@/store/navigation";

import { FadeInStagger, FadeInItem } from "@/components/motion/StaggerContainer";
import { startDownload, fetchMetadata } from "@/lib/downloader";

import { DownloadInputSection } from "./downloads/components/DownloadInputSection";
import { DownloadStatsBar } from "./downloads/components/DownloadStatsBar";
import { DownloadList } from "./downloads/components/DownloadList";
import { getJobTs } from "./downloads/utils";

export function DownloadsScreen() {
  const { settings, updateSettings } = useSettingsStore();
  const [url, setUrl] = useState("");
  const [selectedPreset, setSelectedPreset] = useState("default");
  
  // Derived state for addMode from settings
  const addMode = (settings as unknown as { downloadsAddMode?: "queue" | "start" }).downloadsAddMode ?? "queue";
  const setAddMode = (mode: "queue" | "start") => {
    updateSettings({ downloadsAddMode: mode } as unknown as Partial<typeof settings>);
  };
  
  // Advanced Output Config State
  const [showOutputConfig, setShowOutputConfig] = useState(false);
  const [filenameBase, setFilenameBase] = useState("%(title)s [%(id)s]");
  const [outputFormat, setOutputFormat] = useState<string>("best");
  const [customDownloadDir, setCustomDownloadDir] = useState<string>("");

  const { presets } = usePresetsStore();
  const { jobs, addJob, removeJob, pendingUrl, setPendingUrl } = useDownloadsStore();
  const { setActiveJobId } = useLogsStore();
  const { setScreen } = useNavigationStore();

  const isCustomPreset = selectedPreset === "custom";

  const inferOutputFormat = (presetId: string): string => {
    const preset = presets.find((p) => p.id === presetId);
    if (!preset) return "best";

    const audioFormatIndex = preset.args.indexOf("--audio-format");
    if (audioFormatIndex !== -1) {
      const next = preset.args[audioFormatIndex + 1];
      if (next === "mp3") return "mp3";
      if (next === "m4a") return "m4a";
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
  };

  const handlePresetChange = (val: string) => {
    setSelectedPreset(val);
    const isCustom = val === "custom";
    if (!isCustom) {
      setOutputFormat(inferOutputFormat(val));
    }
  };

  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Handle Drag & Drop Pending URL
  useEffect(() => {
    if (pendingUrl) {
      setTimeout(() => {
        setUrl(pendingUrl);
        setPendingUrl(undefined);
      }, 0);
    }
  }, [pendingUrl, setPendingUrl]);

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

  const sortedJobs = useMemo(
    () =>
      [...jobs].sort((a, b) => {
        const tsA = getJobTs(a);
        const tsB = getJobTs(b);
        return tsB - tsA; // Newest first
      }),
    [jobs]
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

  const handleAdd = () => {
    if (!url.trim()) return;
    
    // Construct final template: NamePart + .%(ext)s
    const finalTemplate = `${filenameBase.trim() || "%(title)s"}.%(ext)s`;

    const overrides = showOutputConfig || isCustomPreset ? {
      filenameTemplate: finalTemplate,
      format: isCustomPreset ? outputFormat : undefined,
      downloadDir: customDownloadDir || undefined
    } : undefined;

    const presetIdToUse = isCustomPreset ? "default" : selectedPreset;

    const id = addJob(url, presetIdToUse, overrides);
    
    fetchMetadata(id);

    if (addMode === "start") {
      startDownload(id);
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

  const handleStartAll = () => {
    const max = settings.maxConcurrency || 1;
    const queuedOrFailed = jobs.filter(
      (job) => job.status === "Queued" || job.status === "Failed"
    );
    let active = jobs.filter(
      (job) =>
        job.status === "Downloading" || job.status === "Post-processing"
    ).length;

    for (const job of queuedOrFailed) {
      if (active >= max) break;
      startDownload(job.id);
      active += 1;
    }
  };

  const handleToggleSelection = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleStartSelected = () => {
    if (!selectedIds.length) return;
    selectedIds.forEach((id) => {
      const job = jobs.find((j) => j.id === id);
      if (!job) return;
      if (job.status === "Queued" || job.status === "Failed") {
        startDownload(id);
      }
    });
  };

  const handleRemoveSelected = () => {
    if (!selectedIds.length) return;
    selectedIds.forEach((id) => removeJob(id));
    setSelectedIds([]);
  };

  const handleClearCompleted = () => {
    const completed = jobs.filter((job) => job.status === "Done" || job.status === "Failed");
    if (!completed.length) return;
    completed.forEach((job) => removeJob(job.id));
    setSelectedIds((prev) =>
      prev.filter((id) => !completed.some((job) => job.id === id))
    );
  };

  const handleViewLogs = (jobId: string) => {
    setActiveJobId(jobId);
    setScreen("logs");
  };

  return (
    <div className="flex flex-col h-full bg-background max-w-6xl mx-auto w-full" role="main">
      <FadeInStagger className="flex flex-col h-full">
        <FadeInItem>
          <header className="p-6 pb-4 space-y-4">
            <div className="flex flex-col gap-1">
              <h2 className="text-2xl font-bold tracking-tight">Downloads</h2>
              <p className="text-muted-foreground text-sm">
                Add URLs to start downloading your media.
              </p>
            </div>
            
            <DownloadInputSection 
              url={url}
              setUrl={setUrl}
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
            />

            <DownloadStatsBar 
              queuedCount={queuedCount}
              activeCount={activeCount}
              failedCount={failedCount}
              doneCount={doneCount}
              onStartAll={handleStartAll}
              canStartAll={jobs.some((job) => job.status === "Queued" || job.status === "Failed")}
            />
          </header>
        </FadeInItem>

        <DownloadList 
          jobs={sortedJobs}
          selectedIds={selectedIds}
          onToggleSelection={handleToggleSelection}
          onStartSelected={handleStartSelected}
          onRemoveSelected={handleRemoveSelected}
          onClearCompleted={handleClearCompleted}
          onRemoveJob={removeJob}
          onViewLogs={handleViewLogs}
          itemVariants={itemVariants}
          formatRelativeTime={formatRelativeTime}
        />
      </FadeInStagger>
    </div>
  );
}
