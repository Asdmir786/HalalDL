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
  Code
} from "lucide-react";
import { toast } from "sonner";
import { useLogsStore, LogLevel } from "@/store/logs";
import { Button } from "@/components/ui/button";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import { Input } from "@/components/ui/input";
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

  const handleExport = async () => {
    try {
      const content = logs.map(l => `[${l.timestamp}] [${l.level.toUpperCase()}] ${l.message}`).join("\n");
      const path = await save({
        filters: [{ name: 'Text', extensions: ['txt'] }],
        defaultPath: 'halaldl_logs.txt'
      });
      if (path) {
        await writeFile(path, new TextEncoder().encode(content));
        toast.success("Logs exported successfully");
      }
    } catch (e) {
      toast.error(`Export failed: ${e}`);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  return (
    <div className="flex flex-col h-full bg-background max-w-6xl mx-auto w-full">
      {/* Header */}
      <header className="p-8 pb-6 space-y-6">
        <div className="flex justify-between items-center">
          <div className="space-y-1">
            <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Terminal className="w-8 h-8 text-primary" />
              Logs & Diagnostics
            </h2>
            <p className="text-muted-foreground text-sm">
              Raw output from yt-dlp and application events.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExport} className="h-9">
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
            <Button variant="outline" size="sm" onClick={clearLogs} className="h-9 text-destructive hover:text-destructive hover:bg-destructive/10">
              <Trash2 className="w-4 h-4 mr-2" />
              Clear
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 bg-muted/30 p-2 rounded-xl border border-muted/50">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search logs..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-background border-none shadow-none focus-visible:ring-1"
            />
          </div>
          <div className="flex gap-1 bg-background p-1 rounded-lg border shadow-sm">
            {["all", "info", "warn", "error", "command", "debug"].map((l) => (
              <Button
                key={l}
                variant={filter === l ? "secondary" : "ghost"}
                size="sm"
                className={cn(
                  "h-7 px-3 text-[10px] uppercase font-bold tracking-wider rounded-md",
                  filter === l && "bg-muted shadow-sm"
                )}
                onClick={() => setFilter(l as any)}
              >
                {l}
              </Button>
            ))}
          </div>
        </div>
      </header>

      {/* Logs View */}
      <div className="flex-1 overflow-hidden px-8 pb-8">
        <div className="bg-black/90 dark:bg-black/40 rounded-2xl border border-white/10 flex-1 flex flex-col overflow-hidden shadow-2xl relative">
          <div className="absolute top-0 left-0 right-0 h-8 bg-white/5 border-b border-white/5 flex items-center px-4 justify-between z-10">
             <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/50" />
                <div className="w-2.5 h-2.5 rounded-full bg-green-500/50" />
             </div>
             <span className="text-[10px] font-mono text-white/30 uppercase tracking-widest">Console Output</span>
          </div>

          <div 
            ref={parentRef}
            className="flex-1 overflow-auto p-4 pt-10 font-mono text-xs"
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
                    key={virtualRow.index}
                    className="absolute top-0 left-0 w-full group flex items-start gap-3 py-1 px-2 hover:bg-white/5 rounded transition-colors"
                    style={{
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    <span className="text-white/20 shrink-0 select-none w-14 text-[10px] mt-0.5">
                      {log.timestamp.split(" ")[1]}
                    </span>
                    <span className={cn("shrink-0 flex items-center gap-1.5 min-w-[70px]", LEVEL_COLORS[log.level])}>
                      {LEVEL_ICONS[log.level]}
                      <span className="text-[9px] uppercase font-bold tracking-tighter">{log.level}</span>
                    </span>
                    <span className="text-white/80 break-all leading-relaxed flex-1">
                      {log.message}
                      {log.command && (
                        <div className="mt-1 bg-white/5 p-2 rounded border border-white/10 flex items-center justify-between group/cmd">
                           <code className="text-green-400 text-[10px] break-all">{log.command}</code>
                           <Button
                             variant="ghost"
                             size="icon"
                             className="h-6 w-6 opacity-0 group-hover/cmd:opacity-100 transition-opacity"
                             onClick={() => copyToClipboard(log.command!, "Command")}
                           >
                             <Copy className="w-3 h-3 text-white/50" />
                           </Button>
                        </div>
                      )}
                    </span>
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
          </div>
        </div>
      </div>
    </div>
  );
}
