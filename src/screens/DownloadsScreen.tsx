import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
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
  Play
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
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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

export function DownloadsScreen() {
  const [url, setUrl] = useState("");
  const [selectedPreset, setSelectedPreset] = useState("default");
  const [addMode, setAddMode] = useState<"queue" | "start">("queue");
  
  // Advanced Output Config State
  const [showOutputConfig, setShowOutputConfig] = useState(false);
  const [filenameBase, setFilenameBase] = useState("%(title)s");
  const [outputFormat, setOutputFormat] = useState<string>("best");
  const [customDownloadDir, setCustomDownloadDir] = useState<string>("");

  const isCustomPreset = selectedPreset === "custom";

  // Determine effective format based on preset for display/logic
  useEffect(() => {
    if (isCustomPreset) return;
    
    // Map known presets to formats for UI consistency
    // This is a heuristic mapping for the UI
    if (selectedPreset === "mp3") setOutputFormat("mp3");
    else if (selectedPreset.includes("mp4")) setOutputFormat("mp4");
    else if (selectedPreset.includes("webm")) setOutputFormat("webm");
    else if (selectedPreset === "audio-only") setOutputFormat("best"); // Or specific audio
    else setOutputFormat("best");
  }, [selectedPreset, isCustomPreset]);

  type StatusFilter = "all" | "active" | "queued" | "done" | "failed";

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const { settings, updateSettings } = useSettingsStore();
  const { jobs, addJob, removeJob, pendingUrl, setPendingUrl } = useDownloadsStore();
  const { presets } = usePresetsStore();
  const parentRef = useRef<HTMLDivElement>(null);
  const { setActiveJobId } = useLogsStore();
  const { setScreen } = useNavigationStore();

  // Handle Drag & Drop Pending URL
  useEffect(() => {
    if (pendingUrl) {
      setUrl(pendingUrl);
      setPendingUrl(undefined);
    }
  }, [pendingUrl, setPendingUrl]);

  useEffect(() => {
    const savedAddMode =
      (settings as unknown as { downloadsAddMode?: "queue" | "start" })
        .downloadsAddMode;
    const savedFilter =
      (settings as unknown as { downloadsStatusFilter?: StatusFilter })
        .downloadsStatusFilter;

    setAddMode(savedAddMode ?? "queue");
    setStatusFilter(savedFilter ?? "all");
  }, [settings]);

  useEffect(() => {
    updateSettings({
      downloadsAddMode: addMode,
      downloadsStatusFilter: statusFilter,
    } as unknown as Partial<typeof settings>);
  }, [addMode, statusFilter, updateSettings]);

  // Framer Motion Variants for List Items
  const itemVariants = {
    initial: { opacity: 0, x: -10, scale: 0.98 },
    animate: { opacity: 1, x: 0, scale: 1 },
    exit: { opacity: 0, scale: 0.95, transition: { duration: 0.2 } },
    hover: { scale: 1.01, backgroundColor: "var(--accent)", transition: { duration: 0.2 } }
  };

  const filteredJobs = useMemo(() => {
    let result = jobs;
    if (statusFilter === "active") {
      result = jobs.filter((job) => job.status === "Downloading" || job.status === "Post-processing");
    } else if (statusFilter === "queued") {
      result = jobs.filter((job) => job.status === "Queued");
    } else if (statusFilter === "done") {
      result = jobs.filter((job) => job.status === "Done");
    } else if (statusFilter === "failed") {
      result = jobs.filter((job) => job.status === "Failed");
    }
    
    // Sort by createdAt desc (newest first)
    return [...result].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }, [jobs, statusFilter]);

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

  const virtualizer = useVirtualizer({
    count: filteredJobs.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 100,
    overscan: 5,
  });

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

    // Switch filter if needed to show the new job
    if (addMode === "queue") {
      if (statusFilter === "active" || statusFilter === "done" || statusFilter === "failed") {
        setStatusFilter("queued");
      }
    } else if (addMode === "start") {
      if (statusFilter === "queued" || statusFilter === "done" || statusFilter === "failed") {
        setStatusFilter("active");
      }
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
                  <Select value={selectedPreset} onValueChange={setSelectedPreset}>
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
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500/50" />
                {queuedCount} queued
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-yellow-500/50" />
                {activeCount} active
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
        <div className="bg-muted/10 rounded-2xl border border-muted/50 flex-1 flex flex-col overflow-hidden shadow-inner">
          {jobs.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8 text-center">
              <div className="w-20 h-20 bg-muted/50 rounded-full flex items-center justify-center mb-6 shadow-sm border border-muted/20">
                <Download className="w-10 h-10 opacity-20" />
              </div>
              <p className="text-xl font-semibold text-foreground/80 mb-2">Queue is empty</p>
              <p className="text-sm max-w-[280px] opacity-70">
                Media you add will appear here. We support YouTube, X, Instagram, and 1000+ more.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between px-4 pt-4 pb-2 gap-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  {[
                    { id: "all", label: "All" },
                    { id: "active", label: "Active" },
                    { id: "queued", label: "Queued" },
                    { id: "done", label: "Done" },
                    { id: "failed", label: "Failed" },
                  ].map((item) => (
                    <MotionButton
                      key={item.id}
                      type="button"
                      variant={statusFilter === item.id ? "secondary" : "ghost"}
                      size="sm"
                      className="h-7 px-3 text-[10px] uppercase font-bold tracking-wider"
                      onClick={() =>
                        setStatusFilter(item.id as typeof statusFilter)
                      }
                    >
                      {item.label}
                    </MotionButton>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <MotionButton
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 px-3 text-[10px] uppercase font-bold tracking-wider"
                    disabled={!selectedIds.length}
                    onClick={handleStartSelected}
                  >
                    Start selected
                  </MotionButton>
                  <MotionButton
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 px-3 text-[10px] uppercase font-bold tracking-wider"
                    disabled={!selectedIds.length}
                    onClick={handleRemoveSelected}
                  >
                    Remove selected
                  </MotionButton>
                  <MotionButton
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-3 text-[10px] uppercase font-bold tracking-wider text-destructive"
                    disabled={!jobs.some((job) => job.status === "Done")}
                    onClick={handleClearCompleted}
                  >
                    Clear completed
                  </MotionButton>
                </div>
              </div>
              <div 
                ref={parentRef}
                className="flex-1 overflow-auto p-4 pt-0"
              >
                <div
                  style={{
                    height: `${virtualizer.getTotalSize()}px`,
                    width: "100%",
                    position: "relative",
                  }}
                >
                  <AnimatePresence mode="popLayout">
                    {virtualizer.getVirtualItems().map((virtualRow) => {
                      const job = filteredJobs[virtualRow.index];
                      if (!job) return null;
                      return (
                        <motion.div
                          key={job.id}
                          layout
                          initial="initial"
                          animate="animate"
                          exit="exit"
                          whileHover="hover"
                          variants={itemVariants}
                          className="absolute top-0 left-0 w-full p-2"
                          style={{
                            height: `${virtualRow.size}px`,
                            transform: `translateY(${virtualRow.start}px)`,
                          }}
                        >
                        <ContextMenu>
                          <ContextMenuTrigger>
                        {/* Inner Card Content */}
                        <div className={cn(
                          "glass-card rounded-xl p-4 flex gap-4 h-full relative group overflow-hidden border-l-4",
                          job.status === "Failed" ? "border-l-destructive/50" : 
                          job.status === "Done" ? "border-l-green-500/50" : 
                          job.status === "Downloading" ? "border-l-blue-500/50" : "border-l-transparent"
                        )}>
                          {/* Animated Background Gradient for Active Downloads */}
                          {job.status === "Downloading" && (
                            <motion.div 
                              className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-transparent to-blue-500/5"
                              animate={{ x: ["-100%", "100%"] }}
                              transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                            />
                          )}
                          
                          <div className="flex-shrink-0 pt-1 z-10">
                            <Checkbox
                              checked={selectedIds.includes(job.id)}
                              onCheckedChange={() => handleToggleSelection(job.id)}
                              className="mt-0.5"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex gap-4">
                              {job.thumbnail && (
                                <div className="relative w-24 h-16 rounded-md overflow-hidden bg-muted/50 flex-shrink-0 border border-muted/50">
                                  <img 
                                    src={job.thumbnail} 
                                    alt="Thumbnail" 
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      // Hide image on error
                                      (e.target as HTMLImageElement).style.display = 'none';
                                    }}
                                  />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-2">
                                  <h4 className="font-medium truncate pr-4 text-sm select-text">
                                    {job.title || job.url}
                                  </h4>
                                  <div className="flex items-center gap-2">
                                <Badge
                                  variant={
                                    job.status === "Done"
                                      ? "default"
                                      : job.status === "Downloading"
                                      ? "secondary"
                                      : job.status === "Failed"
                                      ? "destructive"
                                      : "outline"
                                  }
                                  className="text-[10px] px-1.5 h-5"
                                >
                                  {job.status}
                                </Badge>
                                <MotionButton
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className={cn(
                                    "w-7 h-7 text-muted-foreground hover:text-primary transition-opacity",
                                    job.status === "Done" ? "opacity-0 pointer-events-none" : "opacity-0 group-hover:opacity-100"
                                  )}
                                  disabled={job.status === "Downloading" || job.status === "Done"}
                                  onClick={() => startDownload(job.id)}
                                >
                                  <Download className="w-4 h-4" />
                                </MotionButton>
                                <MotionButton
                                  variant="ghost"
                                  size="icon"
                                  className="w-7 h-7 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={() => removeJob(job.id)}
                                >
                                  <X className="w-4 h-4" />
                                </MotionButton>
                                {job.status === "Failed" && (
                                  <MotionButton
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="w-7 h-7 text-muted-foreground hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={() => handleViewLogs(job.id)}
                                  >
                                    <Terminal className="w-4 h-4" />
                                  </MotionButton>
                                )}
                              </div>
                            </div>

                            {job.status === "Downloading" && (
                              <div className="space-y-1.5">
                                <Progress value={job.progress} className="h-1.5" />
                                <div className="flex justify-between text-[10px] text-muted-foreground font-medium">
                                  <span>{job.progress}% downloaded</span>
                                  <span>{job.speed || "0 KB/s"}</span>
                                </div>
                              </div>
                            )}

                            <div className="flex items-center gap-3 mt-1">
                              <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">
                                {job.presetId}
                              </span>
                              {job.status === "Done" && (
                                <MotionButton
                                  variant="link"
                                  className="h-auto p-0 text-[10px] text-primary flex items-center gap-1"
                                  onClick={() =>
                                    revealInExplorer(job.outputPath || "")
                                  }
                                >
                                  <FolderOpen className="w-3 h-3" />
                                  Show in Explorer
                                </MotionButton>
                              )}
                            </div>
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
                          <ContextMenuItem 
                            className={cn(!job.outputPath && "text-destructive focus:text-destructive")}
                            onClick={() => removeJob(job.id)}
                          >
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
