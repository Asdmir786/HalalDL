import * as React from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  Terminal,
  Trash2,
  Download,
  Copy,
  Search,
  Info,
  AlertCircle,
  Bug,
  Code,
  ArrowDown,
  LoaderCircle,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useLogsStore, LogLevel } from "@/store/logs";
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

const LEVEL_STYLES: Record<LogLevel, string> = {
  info: "bg-blue-500/10 text-blue-300 border-blue-500/40",
  warn: "bg-yellow-500/10 text-yellow-200 border-yellow-500/40",
  error: "bg-red-500/10 text-red-200 border-red-500/40",
  debug: "bg-zinc-500/10 text-zinc-300 border-zinc-500/40",
  command: "bg-emerald-500/10 text-emerald-300 border-emerald-500/50",
};

const LEVEL_ICONS: Record<LogLevel, React.ReactNode> = {
  info: <Info className="w-3 h-3" />,
  warn: <AlertCircle className="w-3 h-3" />,
  error: <AlertCircle className="w-3 h-3" />,
  debug: <Bug className="w-3 h-3" />,
  command: <Code className="w-3 h-3" />,
};

const formatTimestamp = (timestamp: string) => {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;
  return date.toLocaleTimeString();
};

export function LogsScreen() {
  const logs = useLogsStore((state) => state.logs);
  const clearLogs = useLogsStore((state) => state.clearLogs);
  const activeJobId = useLogsStore((state) => state.activeJobId);
  const setActiveJobId = useLogsStore((state) => state.setActiveJobId);
  const loadStatus = useLogsStore((state) => state.loadStatus);
  const loadError = useLogsStore((state) => state.loadError);
  const loadLogs = useLogsStore((state) => state.loadLogs);

  const [filter, setFilter] = React.useState<LogLevel | "all">("all");
  const [search, setSearch] = React.useState("");
  const [autoScroll, setAutoScroll] = React.useState(true);
  const [jobFilter, setJobFilter] = React.useState<string | "all">("all");
  const [availableJobs, setAvailableJobs] = React.useState<string[]>([]);
  const parentRef = React.useRef<HTMLDivElement>(null);

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

  const filteredLogs = React.useMemo(() => {
    const searchLower = search.toLowerCase();
    return logs.filter((log) => {
      const matchesLevel = filter === "all" || log.level === filter;
      const matchesJob = jobFilter === "all" || log.jobId === jobFilter;
      const matchesSearch =
        !search ||
        log.message.toLowerCase().includes(searchLower) ||
        log.command?.toLowerCase().includes(searchLower);
      return matchesLevel && matchesJob && matchesSearch;
    });
  }, [logs, filter, jobFilter, search]);

  const rowVirtualizer = useVirtualizer({
    count: filteredLogs.length,
    getScrollElement: () => parentRef.current,
    getItemKey: React.useCallback(
      (index: number) => filteredLogs[index]?.id ?? index,
      [filteredLogs]
    ),
    estimateSize: React.useCallback(() => 35, []),
    overscan: 10,
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
      rowVirtualizer.scrollToIndex(lastIndex, { align: "end" });
      lastScrollIndex.current = lastIndex;
    }
  }, [filteredLogs.length, autoScroll, rowVirtualizer]);

  const handleExport = React.useCallback(async () => {
    console.debug("[LogsScreen] handleExport:start", { count: filteredLogs.length });
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
        console.debug("[LogsScreen] handleExport:success", { path });
        toast.success("Logs exported successfully");
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("[LogsScreen] handleExport:error", error);
      toast.error(`Export failed: ${message}`);
    }
  }, [filteredLogs]);

  const copyToClipboard = React.useCallback((text: string, label: string) => {
    console.debug("[LogsScreen] copyToClipboard", { label, length: text.length });
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  }, []);

  const handleCopyVisible = React.useCallback(() => {
    console.debug("[LogsScreen] handleCopyVisible", { count: filteredLogs.length });
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
    console.debug("[LogsScreen] handleClear");
    clearLogs();
    toast.success("Logs cleared");
  }, [clearLogs]);

  const handleScroll = React.useCallback((event: React.UIEvent<HTMLDivElement>) => {
    const target = event.currentTarget;
    const distanceFromBottom =
      target.scrollHeight - target.scrollTop - target.clientHeight;
    const isAtBottom = distanceFromBottom < 50;
    setAutoScroll(isAtBottom);
  }, []);

  return (
    <div className="flex flex-col h-full bg-background max-w-6xl mx-auto w-full" role="main">
      <FadeInStagger className="flex flex-col h-full">
        {/* Header */}
        <FadeInItem>
          <header className="p-8 pb-6 space-y-6" aria-label="Logs Control Panel">
            <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center">
              <div className="space-y-1">
                <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                  <Terminal className="w-8 h-8 text-primary" />
                  Logs & Diagnostics
                </h2>
                <p className="text-muted-foreground text-sm">
                  Raw output from yt-dlp and application events.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <MotionButton
                  variant="outline"
                  size="sm"
                  onClick={handleExport}
                  className="h-9 flex-1 sm:flex-none"
                  disabled={loadStatus !== "ready"}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </MotionButton>
                <MotionButton
                  variant="outline"
                  size="sm"
                  onClick={handleCopyVisible}
                  className="h-9 flex-1 sm:flex-none"
                  disabled={loadStatus !== "ready"}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Copy
                </MotionButton>
                <MotionButton
                  variant="outline"
                  size="sm"
                  onClick={handleClear}
                  className="h-9 flex-1 sm:flex-none text-destructive hover:text-destructive hover:bg-destructive/10"
                  disabled={loadStatus !== "ready"}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Clear
                </MotionButton>
              </div>
            </div>

            <div className="flex flex-col gap-3 bg-muted/30 p-2 rounded-xl border border-muted/50 lg:flex-row lg:items-center lg:gap-4 glass-card">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search logs..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 pr-9 bg-background border-none shadow-none focus-visible:ring-1"
                />
                {search && (
                  <MotionButton
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setSearch("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground hover:text-foreground"
                    aria-label="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </MotionButton>
                )}
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between lg:justify-end">
                <div className="flex flex-wrap gap-1 bg-background p-1 rounded-lg border shadow-sm">
                  {["all", "info", "warn", "error", "command", "debug"].map((l) => (
                    <MotionButton
                      key={l}
                      variant={filter === l ? "secondary" : "ghost"}
                      size="sm"
                      className={cn(
                        "h-7 px-3 text-[10px] uppercase font-bold tracking-wider rounded-md",
                        filter === l && "bg-muted shadow-sm"
                      )}
                      onClick={() =>
                        setFilter(l === "all" ? "all" : (l as LogLevel))
                      }
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      {l}
                    </MotionButton>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider">
                    Job
                  </span>
                  <Select
                    value={jobFilter}
                    onValueChange={(value) =>
                      setJobFilter(value === "all" ? "all" : value)
                    }
                  >
                    <SelectTrigger className="h-7 w-[200px] bg-background text-[10px] font-mono">
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      {availableJobs.map((id) => (
                        <SelectItem key={id} value={id}>
                          {id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <MotionButton
                  variant={autoScroll ? "secondary" : "ghost"}
                  size="sm"
                  className="h-7 px-3 text-[10px] uppercase font-bold tracking-wider rounded-md"
                  onClick={() => setAutoScroll((prev) => !prev)}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <ArrowDown className="w-3 h-3 mr-1" />
                  {autoScroll ? "Following" : "Follow tail"}
                </MotionButton>
              </div>
            </div>
          </header>
        </FadeInItem>

        {/* Logs View */}
        <FadeInItem className="flex-1 overflow-hidden px-8 pb-8">
        <div className="bg-gradient-to-br from-slate-950 via-slate-950 to-black dark:from-black dark:via-slate-950 dark:to-black rounded-2xl border border-white/10 flex-1 flex flex-col overflow-hidden shadow-2xl relative">
          <div className="absolute top-0 left-0 right-0 h-9 bg-white/5 border-b border-white/10 flex items-center px-4 justify-between z-10 backdrop-blur-sm">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
              <div className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
            </div>
            <span className="text-[10px] font-mono text-white/40 uppercase tracking-[0.25em]">
              Console Output
            </span>
          </div>

          <div
            ref={parentRef}
            className="flex-1 overflow-auto overflow-x-hidden p-3 pt-10 font-mono text-xs text-white/80 scroll-smooth"
            onScroll={handleScroll}
          >
            {loadStatus === "loading" && (
              <div className="h-full flex flex-col items-center justify-center text-white/60 gap-3">
                <LoaderCircle className="w-7 h-7 animate-spin text-white/50" />
                <div className="text-[12px] tracking-wide">Loading logs…</div>
              </div>
            )}
            {loadStatus === "error" && (
              <div className="h-full flex flex-col items-center justify-center text-white/70 gap-4 px-6 text-center">
                <div className="text-[12px] font-medium">
                  Couldn’t load logs
                </div>
                {loadError && (
                  <div className="text-[11px] text-white/50 break-words max-w-xl">
                    {loadError}
                  </div>
                )}
                <MotionButton
                  variant="secondary"
                  size="sm"
                  className="h-8"
                  onClick={() => loadLogs()}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <X className="w-4 h-4 mr-2" />
                  Retry
                </MotionButton>
              </div>
            )}
            {loadStatus === "ready" && (
              <>
                <div
                  style={{
                    height: `${rowVirtualizer.getTotalSize()}px`,
                    width: "100%",
                    position: "relative",
                  }}
                >
                  {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                    const log = filteredLogs[virtualRow.index];
                    const line = log.message.replace(/\r/g, "");
                    return (
                      <div
                        key={virtualRow.key}
                        data-index={virtualRow.index}
                        ref={rowVirtualizer.measureElement}
                        className="absolute top-0 left-0 w-full group flex items-start gap-3 py-1.5 px-3 hover:bg-white/5 rounded-md transition-colors"
                        style={{
                          transform: `translateY(${virtualRow.start}px)`,
                        }}
                        onDoubleClick={() =>
                          copyToClipboard(
                            `[${formatTimestamp(log.timestamp)}] [${log.level.toUpperCase()}] ${line}${
                              log.command ? ` | ${log.command}` : ""
                            }`,
                            "Log line"
                          )
                        }
                      >
                        <span className="text-white/30 shrink-0 select-none w-[72px] text-[11px] leading-relaxed mt-0.5">
                          {formatTimestamp(log.timestamp)}
                        </span>
                        <span
                          className={cn(
                            "shrink-0 inline-flex items-center gap-1.5 min-w-[84px] px-2 py-0.5 rounded-full border text-[10px] uppercase font-semibold tracking-[0.18em] bg-white/5",
                            LEVEL_STYLES[log.level]
                          )}
                        >
                          {LEVEL_ICONS[log.level]}
                          <span>{log.level}</span>
                        </span>
                        <span
                          className={cn(
                            "min-w-0 whitespace-pre-wrap break-words leading-relaxed flex-1 text-[12px]",
                            log.level === "error" && "text-red-100",
                            log.level === "warn" && "text-yellow-100",
                            log.level === "debug" && "text-zinc-400",
                            log.level === "command" && "text-emerald-100",
                            log.level === "info" && "text-white/80"
                          )}
                        >
                          {line}
                          {log.command && (
                            <div className="mt-1 bg-white/5 p-2 rounded border border-white/10 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between group/cmd">
                              <code className="text-emerald-300 text-[10px] min-w-0 whitespace-pre-wrap break-words flex-1">
                                {log.command}
                              </code>
                              <MotionButton
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 opacity-0 group-hover/cmd:opacity-100 transition-opacity self-end sm:self-auto"
                                onClick={() =>
                                  copyToClipboard(log.command!, "Command")
                                }
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                              >
                                <Copy className="w-3 h-3 text-white/50" />
                              </MotionButton>
                            </div>
                          )}
                        </span>
                        <MotionButton
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 ml-2 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(event) => {
                            event.stopPropagation();
                            copyToClipboard(
                              `[${formatTimestamp(log.timestamp)}] [${log.level.toUpperCase()}] ${line}${
                                log.command ? ` | ${log.command}` : ""
                              }`,
                              "Log line"
                            );
                          }}
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                        >
                          <Copy className="w-3 h-3 text-white/40" />
                        </MotionButton>
                      </div>
                    );
                  })}
                </div>
                {filteredLogs.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-white/20">
                    <Terminal className="w-12 h-12 mb-4 opacity-10" />
                    <p>No logs found matching your criteria</p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </FadeInItem>
      </FadeInStagger>
    </div>
  );
}
