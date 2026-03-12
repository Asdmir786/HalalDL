import { Progress } from "@/components/ui/progress";
import { Terminal, ChevronRight } from "lucide-react";

export interface ToolTransferStatusProps {
  progress: number;
  currentToolName: string | null;
  currentStatus: string;
  orderedToolIds: string[];
  toolProgress: Record<string, number>;
  toolNameById: Record<string, string>;
  logs: string[];
  emptyLabel?: string;
}

export function ToolTransferStatus({
  progress,
  currentToolName,
  currentStatus,
  orderedToolIds,
  toolProgress,
  toolNameById,
  logs,
  emptyLabel = "Preparing transfer...",
}: ToolTransferStatusProps) {
  return (
    <div className="space-y-5 py-1">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              Overall Progress
            </div>
            <div className="mt-1 text-sm font-medium text-foreground/90">
              {currentToolName ? `${currentToolName} · ${currentStatus}` : currentStatus}
            </div>
          </div>
          <div className="text-3xl font-semibold tabular-nums tracking-tight">
            {Math.round(progress)}%
          </div>
        </div>
        <Progress value={progress} className="h-2 bg-muted/50" />
      </div>

      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <div className="rounded-xl border border-white/10 bg-muted/20 px-3 py-2.5">
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Active Tool
          </div>
          <div className="mt-1 truncate font-medium text-foreground/90">
            {currentToolName || "Waiting"}
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-muted/20 px-3 py-2.5">
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Stage
          </div>
          <div className="mt-1 truncate font-medium text-foreground/90">
            {currentStatus}
          </div>
        </div>
      </div>

      {orderedToolIds.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-muted/15 p-3">
          <div className="mb-3 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Tools In This Run
          </div>
          <div className="space-y-2.5">
            {orderedToolIds.map((toolId) => {
              const pct = Math.round(toolProgress[toolId] ?? 0);
              return (
                <div key={toolId} className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-foreground/85">{toolNameById[toolId] ?? toolId}</span>
                    <span className="font-mono text-muted-foreground">{pct}%</span>
                  </div>
                  <Progress value={pct} className="h-1.5 bg-muted/50" />
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="relative h-[144px] overflow-hidden rounded-2xl border border-white/8 bg-black/40 p-4 font-mono text-[10px]">
        <div className="absolute right-3 top-3 opacity-45">
          <Terminal className="h-3.5 w-3.5" />
        </div>
        <div className="space-y-1.5 pr-4 opacity-85">
          {logs.slice(-6).map((log, index) => (
            <div key={`${log}-${index}`} className="flex items-center gap-2">
              <ChevronRight className="h-2.5 w-2.5 shrink-0 text-primary" />
              <span className="truncate">{log}</span>
            </div>
          ))}
          {logs.length === 0 && <span className="italic text-muted-foreground">{emptyLabel}</span>}
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-10 bg-linear-to-t from-black/40 to-transparent" />
      </div>
    </div>
  );
}
