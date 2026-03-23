import { ArrowUpDown, Play, RotateCcw } from "lucide-react";
import { MotionButton } from "@/components/motion/MotionButton";
import { cn } from "@/lib/utils";

export type DownloadStatusFilter = "all" | "active" | "queued" | "failed" | "done";

interface DownloadStatsBarProps {
  queuedCount: number;
  activeCount: number;
  failedCount: number;
  doneCount: number;
  statusFilter: DownloadStatusFilter;
  onStatusFilterChange: (filter: DownloadStatusFilter) => void;
  onStartQueue: () => void;
  showStartQueue: boolean;
  onRetryFailed: () => void;
  canRetryFailed: boolean;
  sortMode: "newest" | "status";
  onSortModeChange: (mode: "newest" | "status") => void;
}

export function DownloadStatsBar({
  queuedCount,
  activeCount,
  failedCount,
  doneCount,
  statusFilter,
  onStatusFilterChange,
  onStartQueue,
  showStartQueue,
  onRetryFailed,
  canRetryFailed,
  sortMode,
  onSortModeChange,
}: DownloadStatsBarProps) {
  const totalCount = queuedCount + activeCount + failedCount + doneCount;
  const filters = [
    {
      id: "all" as const,
      label: "All",
      count: totalCount,
      tone:
        "border-white/10 bg-white/5 text-foreground/85 hover:border-white/15 hover:bg-white/10",
    },
    {
      id: "active" as const,
      label: "Active",
      count: activeCount,
      tone:
        "border-sky-500/20 bg-sky-500/10 text-sky-300 hover:border-sky-400/30 hover:bg-sky-500/15",
    },
    {
      id: "queued" as const,
      label: "Queued",
      count: queuedCount,
      tone:
        "border-yellow-500/20 bg-yellow-500/10 text-yellow-300 hover:border-yellow-400/30 hover:bg-yellow-500/15",
    },
    {
      id: "failed" as const,
      label: "Failed",
      count: failedCount,
      tone:
        "border-destructive/20 bg-destructive/10 text-destructive hover:border-destructive/30 hover:bg-destructive/15",
    },
    {
      id: "done" as const,
      label: "Done",
      count: doneCount,
      tone:
        "border-emerald-500/20 bg-emerald-500/10 text-emerald-300 hover:border-emerald-400/30 hover:bg-emerald-500/15",
    },
  ];

  return (
    <div className="flex flex-col gap-2 border-t border-white/10 pt-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <div className="flex h-8 items-center gap-1 rounded-full border border-border/50 bg-muted/20 px-1.5 py-1">
            <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
            <button
              type="button"
              onClick={() => onSortModeChange("newest")}
              className={cn(
                "rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors",
                sortMode === "newest"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Newest
            </button>
            <button
              type="button"
              onClick={() => onSortModeChange("status")}
              className={cn(
                "rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors",
                sortMode === "status"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Status
            </button>
          </div>

          {failedCount > 0 && (
            <MotionButton
              type="button"
              variant="outline"
              size="sm"
              onClick={onRetryFailed}
              disabled={!canRetryFailed}
              className="h-8 rounded-full border-destructive/30 px-3 text-xs font-semibold text-destructive gap-1.5 transition-all hover:bg-destructive/10 disabled:opacity-40"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Retry Failed
            </MotionButton>
          )}
          {showStartQueue && (
            <MotionButton
              type="button"
              variant="default"
              size="sm"
              onClick={onStartQueue}
              className="h-8 rounded-full bg-linear-to-r from-primary/95 via-primary to-primary/85 px-4 text-xs font-semibold gap-1.5 shadow-md shadow-primary/20 transition-all hover:from-primary hover:to-primary"
            >
              <Play className="h-3.5 w-3.5" />
              Start Queue
            </MotionButton>
          )}
        </div>
      </div>

      <div className="flex min-w-0 flex-nowrap items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {filters.map(({ id, label, count, tone }) => {
          const isActive = statusFilter === id;

          return (
            <button
              key={id}
              type="button"
              onClick={() => onStatusFilterChange(id)}
              className={cn(
                "group inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-semibold transition-all",
                tone,
                isActive && "shadow-[0_8px_30px_rgba(0,0,0,0.18)] ring-1 ring-white/10",
              )}
            >
              <span>{label}</span>
              <span className="rounded-full bg-black/10 px-1.5 py-0.5 text-[10px] tabular-nums">
                {count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
