import * as React from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { 
  Terminal, 
  Trash2, 
  Download, 
  Copy, 
  Search,
  ChevronRight,
  Info,
  AlertCircle,
  Bug,
  Code
} from "lucide-react";
import { toast } from "sonner";
import { useLogsStore, LogLevel } from "@/store/logs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const LEVEL_COLORS: Record<LogLevel, string> = {
  info: "text-blue-400",
  warn: "text-yellow-400",
  error: "text-red-400",
  debug: "text-muted-foreground",
  command: "text-green-400 font-bold",
};

const LEVEL_ICONS: Record<LogLevel, React.ReactNode> = {
  info: <Info className="w-3 h-3" />,
  warn: <AlertCircle className="w-3 h-3" />,
  error: <AlertCircle className="w-3 h-3" />,
  debug: <Bug className="w-3 h-3" />,
  command: <Code className="w-3 h-3" />,
};

export function LogsScreen() {
  const { logs, clearLogs } = useLogsStore();
  const [filter, setFilter] = React.useState<LogLevel | "all">("all");
  const [search, setSearch] = React.useState("");
  
  const parentRef = React.useRef<HTMLDivElement>(null);

  const filteredLogs = React.useMemo(() => {
    return logs
      .filter((log) => filter === "all" || log.level === filter)
      .filter((log) => 
        log.message.toLowerCase().includes(search.toLowerCase()) || 
        log.command?.toLowerCase().includes(search.toLowerCase())
      );
  }, [logs, filter, search]);

  const rowVirtualizer = useVirtualizer({
    count: filteredLogs.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 32,
    overscan: 5,
  });

  const handleExport = () => {
    const content = JSON.stringify(logs, null, 2);
    console.log("Exporting logs:", content);
    toast.success("Logs exported to console (JSON)");
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="p-4 border-b space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Terminal className="w-6 h-6" />
              Logs & Diagnostics
            </h2>
            <p className="text-muted-foreground text-sm">
              Raw output from yt-dlp and application events.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={clearLogs}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Clear
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-4 items-center">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search logs..."
              className="pl-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-1 bg-muted p-1 rounded-md">
            {(["all", "info", "command", "error", "debug"] as const).map((l) => (
              <Button
                key={l}
                variant={filter === l ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setFilter(l)}
                className="capitalize h-8 px-3"
              >
                {l}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Terminal Area */}
      <div 
        ref={parentRef}
        className="flex-1 overflow-auto bg-[#0c0c0c] font-mono text-sm p-2 selection:bg-primary/30"
      >
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: "100%",
            position: "relative",
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const log = filteredLogs[virtualRow.index];
            return (
              <div
                key={virtualRow.key}
                className={cn(
                  "absolute top-0 left-0 w-full flex items-start gap-3 px-2 py-0.5 hover:bg-white/5 transition-colors group",
                  LEVEL_COLORS[log.level]
                )}
                style={{
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <span className="text-muted-foreground/50 shrink-0 select-none w-20">
                  {new Date(log.timestamp).toLocaleTimeString([], { hour12: false })}
                </span>
                <span className="shrink-0 flex items-center gap-1 w-20 opacity-70">
                  {LEVEL_ICONS[log.level]}
                  <span className="uppercase text-[10px]">{log.level}</span>
                </span>
                <div className="flex-1 truncate">
                  {log.command ? (
                    <span className="flex items-center gap-2">
                      <ChevronRight className="w-3 h-3 shrink-0" />
                      <span className="bg-green-900/20 px-1 rounded">{log.command}</span>
                    </span>
                  ) : (
                    log.message
                  )}
                </div>
                
                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 shrink-0">
                  {log.command && (
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-5 w-5 text-white/50 hover:text-white"
                      onClick={() => copyToClipboard(log.command!, "Command")}
                      title="Copy Command"
                    >
                      <Code className="w-3 h-3" />
                    </Button>
                  )}
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-5 w-5 text-white/50 hover:text-white"
                    onClick={() => copyToClipboard(log.message, "Log message")}
                    title="Copy Message"
                  >
                    <Copy className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            );
          })}
          {filteredLogs.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground/50 pt-20">
              <Terminal className="w-12 h-12 mb-4 opacity-20" />
              <p>No logs found matching filters.</p>
            </div>
          )}
        </div>
      </div>

      {/* Footer Info */}
      <div className="p-2 border-t bg-muted/30 flex justify-between items-center px-4">
        <div className="flex gap-4 text-[10px] uppercase tracking-wider text-muted-foreground">
          <span>Total: {logs.length}</span>
          <span>Filtered: {filteredLogs.length}</span>
        </div>
        <Badge variant="outline" className="text-[10px] font-mono">
          yt-dlp v2025.01.15
        </Badge>
      </div>
    </div>
  );
}
