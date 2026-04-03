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
        "border-border/65 bg-card/70 text-foreground/85 hover:border-border/85 hover:bg-card/90 dark:border-white/10 dark:bg-white/5 dark:hover:border-white/15 dark:hover:bg-white/10",
    },
    {
      id: "active" as const,
      label: "Active",
      count: activeCount,
      tone:
        "border-sky-500/25 bg-sky-500/12 text-sky-700 hover:border-sky-500/35 hover:bg-sky-500/18 dark:text-sky-300",
    },
    {
      id: "queued" as const,
      label: "Queued",
      count: queuedCount,
      tone:
        "border-yellow-500/25 bg-yellow-500/12 text-yellow-700 hover:border-yellow-500/35 hover:bg-yellow-500/18 dark:text-yellow-300",
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
        "border-emerald-500/25 bg-emerald-500/12 text-emerald-700 hover:border-emerald-500/35 hover:bg-emerald-500/18 dark:text-emerald-300",
    },
  ];

  return (
    <div className="flex flex-col gap-1.5 border-t border-border/50 pt-1.5 dark:border-white/6">
      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          <div className="flex h-7 items-center gap-1 rounded-full border border-border/60 bg-card/70 px-1.5 py-1 dark:border-white/8 dark:bg-white/5">
            <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
            <button
              type="button"
              onClick={() => onSortModeChange("newest")}
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors",
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
                "rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors",
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
              className="h-7 rounded-full border-destructive/25 px-3 text-[10px] font-semibold text-destructive gap-1.5 transition-all hover:bg-destructive/10 disabled:opacity-40"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Retry
            </MotionButton>
          )}
          {showStartQueue && (
            <MotionButton
              type="button"
              variant="default"
              size="sm"
              onClick={onStartQueue}
              className="h-7 rounded-full bg-linear-to-r from-primary/95 via-primary to-primary/85 px-3 text-[10px] font-semibold gap-1.5 shadow-md shadow-primary/20 transition-all hover:from-primary hover:to-primary"
            >
              <Play className="h-3.5 w-3.5" />
              Start Queue
            </MotionButton>
          )}
        </div>
      </div>

      <div className="flex min-w-0 flex-nowrap items-center gap-1.5 overflow-x-auto sm:pb-0 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {filters.map(({ id, label, count, tone }) => {
          const isActive = statusFilter === id;

          return (
            <button
              key={id}
              type="button"
              onClick={() => onStatusFilterChange(id)}
              className={cn(
                "group inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-[10px] font-semibold transition-all",
                tone,
                isActive && "shadow-[0_8px_30px_rgba(15,23,42,0.12)] ring-1 ring-border/60 dark:ring-white/10 dark:shadow-[0_8px_30px_rgba(0,0,0,0.18)]",
              )}
            >
              <span>{label}</span>
              <span className="rounded-full bg-foreground/[0.06] px-1.5 py-0.5 text-[10px] tabular-nums dark:bg-black/10">
                {count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
