import { AnimatePresence, motion, Variants } from "framer-motion";
import { useEffect, useMemo, useState, useRef } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { 
  Plus, 
  X, 
  FolderOpen,
  Download,
  Terminal,
  Settings2,
  ChevronDown,
  ChevronUp,
  Link,
  Copy,
  RotateCcw,
  Play,
  Clock,
  CheckCircle2,
  AlertTriangle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useDownloadsStore } from "@/store/downloads";
import { usePresetsStore } from "@/store/presets";
import { MotionButton } from "@/components/motion/MotionButton";
import { FadeInStagger, FadeInItem } from "@/components/motion/StaggerContainer";
import { Input } from "@/components/ui/input";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { revealInExplorer, deleteFile, openFile } from "@/lib/commands";
import { startDownload, fetchMetadata } from "@/lib/downloader";
import { Checkbox } from "@/components/ui/checkbox";
import { useSettingsStore } from "@/store/settings";
import { useLogsStore } from "@/store/logs";
import { useNavigationStore } from "@/store/navigation";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";
import { toast } from "sonner";

type JobWithTimestamp = { createdAt: number; statusChangedAt?: number };

function getJobTs(job: JobWithTimestamp) {
  return (typeof job.statusChangedAt === "number" ? job.statusChangedAt : job.createdAt) || 0;
}

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
  const [filenameBase, setFilenameBase] = useState("%(title)s");
  const [outputFormat, setOutputFormat] = useState<string>("best");
  const [customDownloadDir, setCustomDownloadDir] = useState<string>("");

  const isCustomPreset = selectedPreset === "custom";

  const handlePresetChange = (val: string) => {
    setSelectedPreset(val);
    const isCustom = val === "custom";
    if (!isCustom) {
      if (val === "mp3") setOutputFormat("mp3");
      else if (val.includes("mp4")) setOutputFormat("mp4");
      else if (val.includes("webm")) setOutputFormat("webm");
      else if (val === "audio-only") setOutputFormat("best");
      else setOutputFormat("best");
    }
  };

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const { jobs, addJob, removeJob, pendingUrl, setPendingUrl } = useDownloadsStore();
  const { presets } = usePresetsStore();
  const { setActiveJobId } = useLogsStore();
  const { setScreen } = useNavigationStore();

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
  // Auto-scroll logic is handled by virtualization naturally when sorted by newest
  // We remove forced scroll-to-top to respect user scroll position
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
    // We enforce the extension part to let yt-dlp handle it based on format
    const finalTemplate = `${filenameBase.trim() || "%(title)s"}.%(ext)s`;

    const overrides = showOutputConfig || isCustomPreset ? {
      filenameTemplate: finalTemplate,
      format: isCustomPreset ? outputFormat : undefined, // Only override format if custom
      downloadDir: customDownloadDir || undefined
    } : undefined;

    // If custom, use "default" as base but rely on overrides
    const presetIdToUse = isCustomPreset ? "default" : selectedPreset;

    const id = addJob(url, presetIdToUse, overrides);
    
    // Fetch metadata (thumbnail/title) asynchronously
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

  const insertPlaceholder = (placeholder: string) => {
    setFilenameBase((prev) => prev + placeholder);
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

  const handleCopyLink = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success("Link copied to clipboard");
  };

  const handleDeleteFile = async (jobId: string, path?: string) => {
    if (path) {
      try {
        await deleteFile(path);
        toast.success("File deleted from disk");
      } catch (e) {
        toast.error("Failed to delete file");
        console.error(e);
      }
    }
    removeJob(jobId);
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
            
            <div className="flex flex-col gap-3 bg-muted/30 p-3 rounded-xl border border-muted/50 shadow-sm glass-card">
              <div className="flex flex-col lg:flex-row gap-3">
                <div className="flex-1 relative">
                  <Input
                    placeholder="Paste video or playlist URL here..."
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                    className="bg-background border-muted shadow-sm focus-visible:ring-1 h-10"
                  />
                </div>
                
                <div className="flex flex-wrap gap-2 items-center justify-end">
                  <Select value={selectedPreset} onValueChange={handlePresetChange}>
                    <SelectTrigger className="w-[140px] bg-background border-muted shadow-sm focus:ring-1 h-10">
                      <SelectValue placeholder="Preset" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="custom" className="font-semibold text-primary">
                        ✨ Custom Configuration
                      </SelectItem>
                      {presets.map((preset) => (
                        <SelectItem key={preset.id} value={preset.id}>
                          {preset.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <div className="flex rounded-lg border border-muted bg-background p-0.5 gap-0.5 h-10 items-center">
                    <MotionButton
                      type="button"
                      variant={addMode === "queue" ? "secondary" : "ghost"}
                      size="sm"
                      className="h-8 px-3 text-[10px] uppercase font-bold tracking-wider rounded-md"
                      onClick={() => setAddMode("queue")}
                    >
                      Queue
                    </MotionButton>
                    <MotionButton
                      type="button"
                      variant={addMode === "start" ? "secondary" : "ghost"}
                      size="sm"
                      className="h-8 px-3 text-[10px] uppercase font-bold tracking-wider rounded-md"
                      onClick={() => setAddMode("start")}
                    >
                      Start now
                    </MotionButton>
                  </div>

                  <MotionButton
                    onClick={handleAdd}
                    disabled={!url.trim()}
                    className="shadow-sm h-10 px-4"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add
                  </MotionButton>
                </div>
              </div>

              <div className="flex justify-center -mt-1">
                <MotionButton
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 opacity-80 hover:opacity-100 transition-all"
                  onClick={() => setShowOutputConfig(!showOutputConfig)}
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
            <div className="pt-2 border-t border-muted/50 grid gap-4 animate-in fade-in slide-in-from-top-2 duration-200">
               {/* Mode Indicator */}
               {!isCustomPreset && (
                  <div className="flex items-center gap-2 bg-blue-500/10 text-blue-500 px-3 py-2 rounded-md text-xs border border-blue-500/20">
                    <Settings2 className="w-3.5 h-3.5" />
                    <span><strong>Preset Mode Active:</strong> Format settings are managed by the selected preset.</span>
                  </div>
               )}

               {/* Row 1: Filename Template */}
               <div className="grid gap-2">
                 <div className="flex items-center justify-between">
                   <label className="text-xs font-medium text-muted-foreground">Output Filename</label>
                   <span className="text-[10px] text-muted-foreground/60">Extension is automatic</span>
                 </div>
                 <div className="flex gap-2">
                   <div className="flex-1 relative flex items-center">
                     <Input 
                        value={filenameBase}
                        onChange={(e) => setFilenameBase(e.target.value)}
                        placeholder="%(title)s"
                        className="font-mono text-xs h-9 bg-background/50 rounded-r-none border-r-0"
                     />
                     <div className="h-9 px-3 flex items-center bg-muted/50 border border-l-0 rounded-r-md text-xs font-mono text-muted-foreground select-none">
                       .%(ext)s
                     </div>
                   </div>
                   <div className="flex gap-1">
                     {[
                       { label: "Title", val: "%(title)s" },
                       { label: "Date", val: "%(upload_date)s" },
                       { label: "ID", val: "%(id)s" }
                     ].map((chip) => (
                       <MotionButton
                         key={chip.val}
                         type="button"
                         variant="outline"
                         size="sm"
                         onClick={() => insertPlaceholder(chip.val)}
                         className="h-9 px-2 text-[10px] font-medium bg-muted/50 hover:bg-muted border-muted"
                         title={`Insert ${chip.val}`}
                       >
                         {chip.label}
                       </MotionButton>
                     ))}
                   </div>
                 </div>
               </div>

               {/* Row 2: Format & Location */}
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <label className="text-xs font-medium text-muted-foreground">
                      Output Format 
                      {!isCustomPreset && <span className="ml-1 opacity-50">(Locked by Preset)</span>}
                    </label>
                    <Select 
                      value={outputFormat} 
                      onValueChange={setOutputFormat} 
                      disabled={!isCustomPreset}
                    >
                      <SelectTrigger className={cn("h-9 bg-background/50 text-xs", !isCustomPreset && "opacity-70 cursor-not-allowed")}>
                        <SelectValue placeholder="Select format" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="best">Best (Video + Audio)</SelectItem>
                        <SelectItem value="mp4">MP4 (Video)</SelectItem>
                        <SelectItem value="mkv">MKV (Video)</SelectItem>
                        <SelectItem value="webm">WebM (Video)</SelectItem>
                        <SelectItem value="mp3">MP3 (Audio Only)</SelectItem>
                        <SelectItem value="m4a">M4A (Audio Only)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-muted-foreground">Download Location</label>
                      {customDownloadDir ? (
                        <span className="text-[10px] text-primary font-medium">Custom</span>
                      ) : (
                        <span className="text-[10px] text-muted-foreground/60">Using default</span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Input 
                        readOnly
                        value={customDownloadDir || settings.defaultDownloadDir || "No default set"}
                        className={cn(
                          "h-9 text-xs bg-background/50",
                          !customDownloadDir && !settings.defaultDownloadDir && "text-destructive/80 border-destructive/30"
                        )}
                      />
                      <MotionButton variant="outline" size="sm" onClick={handleBrowseDir} className="h-9 px-3">
                        <FolderOpen className="w-3.5 h-3.5" />
                      </MotionButton>
                    </div>
                  </div>
               </div>
            </div>
          )}

          {/* Stats and Global Controls */}
          <div className="flex items-center justify-between pt-2 border-t border-muted/50">
            <div className="flex items-center gap-4 text-[11px] text-muted-foreground font-medium">
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-yellow-500/60" />
                {queuedCount} queued
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500/60" />
                {activeCount} active
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-destructive/70" />
                {failedCount} failed
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500/50" />
                {doneCount} done
              </div>
            </div>

            <MotionButton
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleStartAll}
              disabled={jobs.filter((job) => job.status === "Queued" || job.status === "Failed").length === 0}
              className="h-8 text-xs hover:bg-background hover:shadow-sm transition-all"
            >
              <Download className="w-3.5 h-3.5 mr-2" />
              Start All Pending
            </MotionButton>
          </div>
            </div>
          </header>
        </FadeInItem>

      {/* Queue Section */}
      <FadeInItem className="flex-1 overflow-hidden flex flex-col px-8 pb-8">
        <div className="bg-black/5 rounded-2xl border border-white/5 flex-1 flex flex-col overflow-hidden shadow-inner backdrop-blur-sm">
          {jobs.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8 text-center">
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.5 }}
                className="w-24 h-24 bg-gradient-to-tr from-primary/20 to-secondary/20 rounded-full flex items-center justify-center mb-6 shadow-lg border border-white/10 backdrop-blur-md"
              >
                <Download className="w-10 h-10 text-primary/50" />
              </motion.div>
              <h3 className="text-xl font-bold text-foreground/90 mb-2 tracking-tight">Your Queue is Empty</h3>
              <p className="text-sm max-w-[280px] text-muted-foreground/80 leading-relaxed">
                Paste a URL above to start downloading. We support YouTube, Twitch, TikTok, and thousands more.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-end px-4 pt-4 pb-2 gap-2">
                  <AnimatePresence>
                    {selectedIds.length > 0 && (
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            className="flex gap-2"
                        >
                            <MotionButton
                                type="button"
                                variant="secondary"
                                size="sm"
                                className="h-7 px-3 text-xs rounded-full shadow-sm"
                                onClick={handleStartSelected}
                            >
                                Start Selected
                            </MotionButton>
                            <MotionButton
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 px-3 text-xs rounded-full hover:bg-destructive/10 hover:text-destructive"
                                onClick={handleRemoveSelected}
                            >
                                Remove
                            </MotionButton>
                        </motion.div>
                    )}
                  </AnimatePresence>
                  
                  <div className="flex-1" />

                  <MotionButton
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-3 text-xs rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    disabled={!jobs.some((job) => job.status === "Done" || job.status === "Failed")}
                    onClick={handleClearCompleted}
                  >
                    Clear Completed
                  </MotionButton>
              </div>
              <div className="flex-1 overflow-auto p-4 pt-0">
                <div className="flex flex-col gap-2 relative">
                  <AnimatePresence mode="popLayout" initial={false}>
                    {sortedJobs.map((job) => {
                      const ts = getJobTs(job);
                      const relative = formatRelativeTime(ts);
                      const absolute = new Date(ts).toLocaleString();

                      const statusIcon =
                        job.status === "Queued"
                          ? Clock
                          : job.status === "Failed"
                            ? AlertTriangle
                          : job.status === "Done"
                            ? CheckCircle2
                            : Download;

                      const statusColor =
                        job.status === "Queued"
                          ? "text-yellow-500 border-yellow-500/20 bg-yellow-500/10"
                          : job.status === "Failed"
                            ? "text-destructive border-destructive/20 bg-destructive/10"
                          : job.status === "Done"
                            ? "text-emerald-500 border-emerald-500/20 bg-emerald-500/10"
                            : "text-blue-500 border-blue-500/20 bg-blue-500/10";

                      const StatusIcon = statusIcon;

                      return (
                        <motion.div
                          layout
                          key={job.id}
                          initial="initial"
                          animate="animate"
                          exit="exit"
                          whileHover="hover"
                          variants={itemVariants}
                          className="w-full"
                        >
                          <ContextMenu>
                            <ContextMenuTrigger>
                              <div className="group relative flex gap-4 p-3 rounded-xl border border-white/5 bg-background/40 hover:bg-background/60 hover:border-white/10 backdrop-blur-md shadow-sm transition-all duration-300">
                                {/* Selection & Thumbnail Column */}
                                <div className="flex items-start gap-3">
                                  <div className="pt-1">
                                    <Checkbox
                                      checked={selectedIds.includes(job.id)}
                                      onCheckedChange={() => handleToggleSelection(job.id)}
                                      className="border-white/20 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                                    />
                                  </div>

                                  <div className="relative w-28 aspect-video rounded-lg overflow-hidden bg-black/20 ring-1 ring-white/10 shadow-inner group-hover:shadow-md transition-all">
                                    {job.thumbnail ? (
                                      <img
                                        src={job.thumbnail}
                                        alt="Thumbnail"
                                        className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
                                        onError={(e) => {
                                          (e.target as HTMLImageElement).style.display = "none";
                                        }}
                                      />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center text-muted-foreground/20">
                                        <Play className="w-6 h-6" />
                                      </div>
                                    )}
                                    {/* Type Badge Overlay Removed */}
                                  </div>
                                </div>

                                {/* Content Column */}
                                <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                                  {/* Header */}
                                  <div className="flex items-start justify-between gap-4">
                                    <div className="flex flex-col gap-0.5 min-w-0">
                                        <h4 className="font-semibold text-sm leading-tight text-foreground/90 truncate pr-2 group-hover:text-primary transition-colors">
                                        {job.title || job.url}
                                        </h4>
                                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-medium">
                                            <span className="flex items-center gap-1" title={absolute}>
                                                <Clock className="w-3 h-3 opacity-70" /> {relative}
                                            </span>
                                            {job.outputPath && <span className="w-0.5 h-0.5 rounded-full bg-muted-foreground/50" />}
                                            {job.outputPath && (
                                                <span className="truncate max-w-[200px] opacity-70" title={job.outputPath}>
                                                    {job.outputPath.split(/[/\\]/).pop()}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold border shadow-sm backdrop-blur-sm transition-colors", statusColor)}>
                                        <StatusIcon className="w-3 h-3" />
                                        <span>{job.status}</span>
                                    </div>
                                  </div>

                                  {/* Footer: Progress or Actions */}
                                  <div className="flex items-end justify-between gap-4 mt-2">
                                    {/* Left Side of Footer (Empty for now, could hold tags) */}
                                    <div className="flex-1"></div>

                                    {/* Right Side: Actions / Progress */}
                                    <div className="flex items-center gap-3">
                                        {job.status === "Downloading" || job.status === "Post-processing" ? (
                                        <div className="flex flex-col items-end gap-1.5 w-48">
                                            <div className="flex items-center justify-between w-full text-[10px] font-mono font-medium text-muted-foreground">
                                                <span className="text-foreground">{job.speed || "0 KB/s"}</span>
                                                <span className="opacity-70">{job.eta || "--:--"}</span>
                                            </div>
                                            <div className="w-full h-1.5 bg-muted/50 rounded-full overflow-hidden">
                                                <motion.div 
                                                    className="h-full bg-gradient-to-r from-primary/80 to-primary rounded-full"
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${job.progress}%` }}
                                                    transition={{ duration: 0.5, ease: "easeOut" }}
                                                />
                                            </div>
                                        </div>
                                        ) : (
                                        <div className="flex items-center gap-1">
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-4 group-hover:translate-x-0">
                                                {job.status === "Done" && (
                                                    <MotionButton
                                                    variant="ghost"
                                                    size="icon"
                                                    className="w-8 h-8 rounded-full hover:bg-primary/10 hover:text-primary transition-colors"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        revealInExplorer(job.outputPath || "");
                                                    }}
                                                    title="Show in Explorer"
                                                    >
                                                    <FolderOpen className="w-4 h-4" />
                                                    </MotionButton>
                                                )}

                                                {(job.status === "Queued" || job.status === "Failed") && (
                                                    <MotionButton
                                                    variant="ghost"
                                                    size="icon"
                                                    className="w-8 h-8 rounded-full hover:bg-primary/10 hover:text-primary transition-colors"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        startDownload(job.id);
                                                    }}
                                                    title="Start Download"
                                                    >
                                                    <Download className="w-4 h-4" />
                                                    </MotionButton>
                                                )}

                                                <MotionButton
                                                    variant="ghost"
                                                    size="icon"
                                                    className="w-8 h-8 rounded-full hover:bg-destructive/10 hover:text-destructive transition-colors"
                                                    onClick={(e) => {
                                                    e.stopPropagation();
                                                    removeJob(job.id);
                                                    }}
                                                    title="Remove"
                                                >
                                                    <X className="w-4 h-4" />
                                                </MotionButton>
                                            </div>
                                        </div>
                                        )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </ContextMenuTrigger>

                            <ContextMenuContent className="w-48">
                              {job.status === "Done" && job.outputPath && (
                                <>
                                  <ContextMenuItem onClick={() => openFile(job.outputPath!)}>
                                    <Play className="mr-2 h-3.5 w-3.5" />
                                    Open File
                                  </ContextMenuItem>
                                  <ContextMenuItem onClick={() => revealInExplorer(job.outputPath!)}>
                                    <FolderOpen className="mr-2 h-3.5 w-3.5" />
                                    Show in Explorer
                                  </ContextMenuItem>
                                  <ContextMenuSeparator />
                                </>
                              )}
                              <ContextMenuItem onClick={() => handleCopyLink(job.url)}>
                                <Link className="mr-2 h-3.5 w-3.5" />
                                Copy Link
                              </ContextMenuItem>
                              {job.status === "Failed" && (
                                <ContextMenuItem onClick={() => startDownload(job.id)}>
                                  <RotateCcw className="mr-2 h-3.5 w-3.5" />
                                  Retry
                                </ContextMenuItem>
                              )}
                              <ContextMenuSeparator />
                              <ContextMenuItem onClick={() => handleViewLogs(job.id)}>
                                <Terminal className="mr-2 h-3.5 w-3.5" />
                                View Logs
                              </ContextMenuItem>
                              <ContextMenuItem
                                onClick={() => {
                                  navigator.clipboard.writeText(JSON.stringify(job, null, 2));
                                  toast.success("Job details copied");
                                }}
                              >
                                <Copy className="mr-2 h-3.5 w-3.5" />
                                Copy Debug Info
                              </ContextMenuItem>
                              <ContextMenuSeparator />
                              {job.status === "Done" && job.outputPath && (
                                <ContextMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => handleDeleteFile(job.id, job.outputPath)}
                                >
                                  <X className="mr-2 h-3.5 w-3.5" />
                                  Delete File
                                </ContextMenuItem>
                              )}
                              <ContextMenuItem onClick={() => removeJob(job.id)}>
                                <X className="mr-2 h-3.5 w-3.5" />
                                Remove from List
                              </ContextMenuItem>
                            </ContextMenuContent>
                          </ContextMenu>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
              </div>
              </div>
            </>
          )}
        </div>
      </FadeInItem>
      </FadeInStagger>
    </div>
  );
}
