import * as React from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  Terminal,
  Trash2,
  Download,
  Copy,
  Search,
  AlertCircle,
  ArrowDown,
  LoaderCircle,
  X,
  Filter,
} from "lucide-react";
import { toast } from "sonner";
import { useLogsStore, LogLevel } from "@/store/logs";
import { useDownloadsStore } from "@/store/downloads";
import { MotionButton } from "@/components/motion/MotionButton";
import { FadeInStagger, FadeInItem } from "@/components/motion/StaggerContainer";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";

const LEVEL_STYLES: Record<LogLevel, string> = {
  info: "text-blue-400",
  warn: "text-yellow-400",
  error: "text-red-400",
  debug: "text-zinc-500",
  command: "text-emerald-400",
};

const formatTimestamp = (timestamp: string) => {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;
  return date.toLocaleTimeString(undefined, {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
};

export function LogsScreen() {
  const logs = useLogsStore((state) => state.logs);
  const clearLogs = useLogsStore((state) => state.clearLogs);
  const activeJobId = useLogsStore((state) => state.activeJobId);
  const setActiveJobId = useLogsStore((state) => state.setActiveJobId);
  const loadStatus = useLogsStore((state) => state.loadStatus);
  const loadLogs = useLogsStore((state) => state.loadLogs);
  const jobs = useDownloadsStore((state) => state.jobs);

  const [filter, setFilter] = React.useState<LogLevel | "all">("all");
  const [search, setSearch] = React.useState("");
  const [autoScroll, setAutoScroll] = React.useState(true);
  const [jobFilter, setJobFilter] = React.useState<string | "all" | "active">("active");
  const [availableJobs, setAvailableJobs] = React.useState<string[]>([]);
  const parentRef = React.useRef<HTMLDivElement>(null);
  const didAutoSelectJob = React.useRef(false);

  const activeJobIds = React.useMemo(() => {
    return new Set(
      jobs
        .filter((job) => job.status === "Downloading" || job.status === "Post-processing")
        .map((job) => job.id)
    );
  }, [jobs]);

  const activeJobsCount = activeJobIds.size;

  const jobTitleById = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const job of jobs) {
      if (job.title) map.set(job.id, job.title);
    }
    return map;
  }, [jobs]);

  // Initial load
  React.useEffect(() => {
    if (loadStatus === "idle") {
      loadLogs();
    }
  }, [loadStatus, loadLogs]);

  // Sync available jobs from logs
  React.useEffect(() => {
    const ids = Array.from(
      new Set(logs.map((log) => log.jobId).filter((id): id is string => !!id))
    );
    // Only update if IDs have changed to avoid unnecessary re-renders
    setAvailableJobs((prev) => {
      if (prev.length === ids.length && prev.every((v, i) => v === ids[i])) {
        return prev;
      }
      return ids;
    });
  }, [logs]);

  // Handle external job focus
  React.useEffect(() => {
    if (activeJobId) {
      setJobFilter(activeJobId);
      // Use a timeout or a check to prevent infinite loop if the store update is slow
      const timeout = setTimeout(() => {
        setActiveJobId(undefined);
      }, 0);
      return () => clearTimeout(timeout);
    }
  }, [activeJobId, setActiveJobId]);

  React.useEffect(() => {
    if (!didAutoSelectJob.current) {
      if (activeJobsCount > 0) setJobFilter("active");
      else setJobFilter("all");
      didAutoSelectJob.current = true;
    }
  }, [activeJobsCount]);

  React.useEffect(() => {
    if (jobFilter === "active" && activeJobsCount === 0) setJobFilter("all");
  }, [activeJobsCount, jobFilter]);

  const filteredLogs = React.useMemo(() => {
    const searchLower = search.toLowerCase();
    return logs.filter((log) => {
      const matchesLevel = filter === "all" || log.level === filter;
      const matchesJob =
        jobFilter === "all" ||
        (jobFilter === "active"
          ? !!log.jobId && activeJobIds.has(log.jobId)
          : log.jobId === jobFilter);
      const matchesSearch =
        !search ||
        log.message.toLowerCase().includes(searchLower) ||
        log.command?.toLowerCase().includes(searchLower);
      return matchesLevel && matchesJob && matchesSearch;
    });
  }, [logs, filter, jobFilter, search, activeJobIds]);

  const rowVirtualizer = useVirtualizer({
    count: filteredLogs.length,
    getScrollElement: () => parentRef.current,
    getItemKey: React.useCallback(
      (index: number) => filteredLogs[index]?.id ?? index,
      [filteredLogs]
    ),
    estimateSize: React.useCallback(() => 35, []),
    overscan: 20, // Increased overscan for smoother scrolling
    measureElement: React.useCallback(
      (element: HTMLElement) => element.getBoundingClientRect().height,
      []
    ),
  });

  const lastScrollIndex = React.useRef<number>(-1);
  React.useEffect(() => {
    if (!autoScroll || !filteredLogs.length) return;
    const lastIndex = filteredLogs.length - 1;
    if (lastScrollIndex.current !== lastIndex) {
      rowVirtualizer.scrollToIndex(lastIndex, { align: "end", behavior: "auto" });
      lastScrollIndex.current = lastIndex;
    }
  }, [filteredLogs.length, autoScroll, rowVirtualizer]);

  const handleExport = React.useCallback(async () => {
    try {
      const content = filteredLogs
        .map(
          (l) =>
            `[${l.timestamp}] [${l.level.toUpperCase()}] ${l.message}${
              l.command ? ` | ${l.command}` : ""
            }`
        )
        .join("\n");
      const path = await save({
        filters: [{ name: "Text", extensions: ["txt"] }],
        defaultPath: "HalalDL-logs.txt",
      });
      if (path) {
        await writeFile(path, new TextEncoder().encode(content));
        toast.success("Logs exported successfully");
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`Export failed: ${message}`);
    }
  }, [filteredLogs]);

  const copyToClipboard = React.useCallback((text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  }, []);

  const handleCopyVisible = React.useCallback(() => {
    if (!filteredLogs.length) {
      toast.info("No logs to copy");
      return;
    }
    const content = filteredLogs
      .map(
        (l) =>
          `[${l.timestamp}] [${l.level.toUpperCase()}] ${l.message}${
            l.command ? ` | ${l.command}` : ""
          }`
      )
      .join("\n");
    copyToClipboard(content, "Logs");
  }, [filteredLogs, copyToClipboard]);

  const handleClear = React.useCallback(() => {
    clearLogs();
    toast.success("Logs cleared");
  }, [clearLogs]);

  const handleScroll = React.useCallback((event: React.UIEvent<HTMLDivElement>) => {
    const target = event.currentTarget;
    const distanceFromBottom =
      target.scrollHeight - target.scrollTop - target.clientHeight;
    // Increased threshold for auto-scroll detection
    const isAtBottom = distanceFromBottom < 100;
    
    // Only update if state changes to avoid re-renders
    if (isAtBottom !== autoScroll) {
       setAutoScroll(isAtBottom);
    }
  }, [autoScroll]);

  return (
    <div className="flex flex-col h-full bg-background max-w-6xl mx-auto w-full p-6 space-y-6" role="main">
      <FadeInStagger className="flex flex-col h-full gap-6">
        {/* Modern Header */}
        <FadeInItem>
          <div className="flex flex-col gap-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                  <Terminal className="w-6 h-6 text-primary" />
                  Console Output
                </h2>
                <p className="text-muted-foreground text-sm">
                  System logs and yt-dlp process output
                </p>
              </div>
              
              <div className="flex items-center gap-2">
                 <MotionButton
                  variant="outline"
                  size="sm"
                  onClick={handleExport}
                  disabled={loadStatus !== "ready"}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Download className="w-3.5 h-3.5 mr-2" />
                  Export
                </MotionButton>
                <MotionButton
                  variant="outline"
                  size="sm"
                  onClick={handleCopyVisible}
                  disabled={loadStatus !== "ready"}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Copy className="w-3.5 h-3.5 mr-2" />
                  Copy
                </MotionButton>
                <MotionButton
                  variant="ghost"
                  size="sm"
                  onClick={handleClear}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  disabled={loadStatus !== "ready"}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Trash2 className="w-3.5 h-3.5 mr-2" />
                  Clear
                </MotionButton>
              </div>
            </div>

            {/* Toolbar */}
            <div className="flex flex-col lg:flex-row gap-4 p-1">
              <div className="relative flex-1 group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <Input
                  placeholder="Filter logs..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") setSearch("");
                  }}
                  className="pl-9 h-10 bg-muted/50 border-transparent focus:border-primary/50 focus:bg-background transition-all"
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              
              <div className="flex items-center gap-2 overflow-x-auto pb-1 lg:pb-0 scrollbar-hide">
                <div className="flex items-center bg-muted/50 rounded-lg p-1 border border-border/50">
                  <Filter className="w-3.5 h-3.5 ml-2 mr-2 text-muted-foreground" />
                  <Separator orientation="vertical" className="h-4 mr-1" />
                  {["all", "info", "warn", "error", "command"].map((l) => (
                    <button
                      key={l}
                      onClick={() => setFilter(l === "all" ? "all" : (l as LogLevel))}
                      className={cn(
                        "px-2.5 py-1 text-[11px] uppercase font-bold tracking-wider rounded-md transition-all",
                        filter === l 
                          ? "bg-background shadow-sm text-foreground" 
                          : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                      )}
                    >
                      {l}
                    </button>
                  ))}
                </div>

                <Select
                  value={jobFilter}
                  onValueChange={(value) =>
                    setJobFilter(
                      value === "all" ? "all" : value === "active" ? "active" : value
                    )
                  }
                >
                  <SelectTrigger className="h-10 w-[180px] bg-muted/50 border-transparent focus:border-primary/50 text-xs font-medium">
                    <SelectValue placeholder="All Jobs" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Jobs</SelectItem>
                    <SelectItem value="active" disabled={activeJobsCount === 0}>
                      Active Only ({activeJobsCount})
                    </SelectItem>
                    {availableJobs.map((id) => (
                      <SelectItem key={id} value={id}>
                        {jobTitleById.get(id) || id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </FadeInItem>

        {/* Console View */}
        <FadeInItem className="flex-1 min-h-0">
          <div className="h-full rounded-xl border border-border/50 bg-[#0c0c0c] flex flex-col shadow-inner relative overflow-hidden group/console">
             {/* Status Bar */}
            <div className="absolute top-0 left-0 right-0 h-8 bg-white/5 border-b border-white/5 flex items-center px-3 justify-between z-10 backdrop-blur-md select-none">
              <div className="flex items-center gap-2 text-[10px] font-mono text-white/40">
                <Terminal className="w-3 h-3" />
                <span>BASH</span>
              </div>
              <div className="flex items-center gap-3">
                 <div className={cn(
                    "flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors cursor-pointer",
                    autoScroll ? "bg-primary/20 text-primary hover:bg-primary/30" : "bg-white/5 text-white/40 hover:bg-white/10"
                 )}
                 onClick={() => setAutoScroll(!autoScroll)}
                 >
                    <ArrowDown className={cn("w-3 h-3", autoScroll && "animate-pulse")} />
                    {autoScroll ? "Auto-scroll On" : "Auto-scroll Off"}
                 </div>
                <span className="text-[10px] font-mono text-white/30 border-l border-white/10 pl-3">
                  {filteredLogs.length} lines
                </span>
              </div>
            </div>

            <div
              ref={parentRef}
              className="flex-1 overflow-y-auto overflow-x-hidden p-4 pt-10 font-mono text-xs scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent hover:scrollbar-thumb-white/20"
              onScroll={handleScroll}
              tabIndex={0}
            >
              {loadStatus === "loading" && (
                <div className="h-full flex flex-col items-center justify-center text-white/40 gap-3">
                  <LoaderCircle className="w-6 h-6 animate-spin" />
                  <div className="text-[12px]">Initializing console...</div>
                </div>
              )}
              
              {loadStatus === "error" && (
                <div className="h-full flex flex-col items-center justify-center text-red-400/80 gap-3">
                  <AlertCircle className="w-8 h-8 opacity-50" />
                  <div className="text-sm font-medium">Failed to load logs</div>
                  <MotionButton
                    variant="outline"
                    size="sm"
                    onClick={() => loadLogs()}
                    className="border-white/10 hover:bg-white/5"
                  >
                    Retry Connection
                  </MotionButton>
                </div>
              )}

              {loadStatus === "ready" && (
                <div
                  style={{
                    height: `${rowVirtualizer.getTotalSize()}px`,
                    width: "100%",
                    position: "relative",
                  }}
                >
                  {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                    const log = filteredLogs[virtualRow.index];
                    const line = log.message; // Keep raw formatting
                    
                    return (
                      <div
                        key={virtualRow.key}
                        data-index={virtualRow.index}
                        ref={rowVirtualizer.measureElement}
                        className={cn(
                          "absolute top-0 left-0 w-full flex items-start gap-3 py-1 px-2 hover:bg-white/5 transition-colors rounded-sm group/line",
                          log.level === "error" && "bg-red-500/5"
                        )}
                        style={{
                          transform: `translateY(${virtualRow.start}px)`,
                        }}
                      >
                         {/* Line Number / Timestamp */}
                        <div className="shrink-0 flex flex-col items-end gap-0.5 select-none w-[85px] text-[10px] font-mono opacity-30 group-hover/line:opacity-50 transition-opacity text-right border-r border-white/5 pr-3 mr-1">
                           <span className="text-white/60">{formatTimestamp(log.timestamp)}</span>
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0 break-all whitespace-pre-wrap leading-relaxed">
                          {log.command && (
                             <div className="mb-1 text-[10px] text-emerald-500/80 font-bold bg-emerald-500/5 inline-block px-1.5 rounded border border-emerald-500/10 select-all">
                                $ {log.command}
                             </div>
                          )}
                          <span className={cn(
                             LEVEL_STYLES[log.level],
                             "selection:bg-white/20"
                          )}>
                             {line}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              
              {loadStatus === "ready" && filteredLogs.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-white/20 select-none">
                  <Terminal className="w-12 h-12 mb-4 opacity-10" />
                  <p className="text-sm font-medium">No output found</p>
                  <p className="text-xs opacity-50 mt-1">Try adjusting your filters</p>
                </div>
              )}
            </div>
          </div>
        </FadeInItem>
      </FadeInStagger>
    </div>
  );
}
