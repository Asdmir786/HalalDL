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

const FILTERS: Array<{
  id: DownloadStatusFilter;
  label: string;
  dot: string;
  active: string;
}> = [
  {
    id: "all",
    label: "All",
    dot: "bg-primary",
    active: "bg-primary text-primary-foreground border-primary",
  },
  {
    id: "active",
    label: "Active",
    dot: "bg-sky-400",
    active: "border-sky-400 bg-sky-400 text-[#081018]",
  },
  {
    id: "queued",
    label: "Queued",
    dot: "bg-amber-400",
    active: "border-amber-400 bg-amber-400 text-[#081018]",
  },
  {
    id: "failed",
    label: "Failed",
    dot: "bg-red-400",
    active: "border-red-400 bg-red-400 text-[#081018]",
  },
  {
    id: "done",
    label: "Done",
    dot: "bg-emerald-400",
    active: "border-emerald-400 bg-emerald-400 text-[#081018]",
  },
];

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
  const counts: Record<DownloadStatusFilter, number> = {
    all: queuedCount + activeCount + failedCount + doneCount,
    active: activeCount,
    queued: queuedCount,
    failed: failedCount,
    done: doneCount,
  };

  return (
    <div className="flex flex-col gap-2 border-t border-border/50 pt-2 dark:border-white/10">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex h-8 items-center gap-1 rounded-full border border-primary/25 bg-background px-1.5">
            <ArrowUpDown className="ml-1 h-3.5 w-3.5 text-primary" />
            <button
              type="button"
              onClick={() => onSortModeChange("newest")}
              className={cn(
                "rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors",
                sortMode === "newest"
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground/80 hover:bg-primary/15 hover:text-foreground"
              )}
            >
              Newest
            </button>
            <button
              type="button"
              onClick={() => onSortModeChange("status")}
              className={cn(
                "rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors",
                sortMode === "status"
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground/80 hover:bg-primary/15 hover:text-foreground"
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
              className="h-8 rounded-full border-red-400/50 bg-red-500/15 px-3 text-[11px] font-semibold text-red-300 hover:bg-red-500/25 hover:text-red-200 disabled:opacity-40"
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
              className="h-8 rounded-full px-3 text-[11px] font-semibold"
            >
              <Play className="h-3.5 w-3.5" />
              Start Queue
            </MotionButton>
          )}
        </div>
      </div>

      <div className="flex min-w-0 flex-nowrap items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {FILTERS.map(({ id, label, dot, active }) => {
          const isActive = statusFilter === id;
          const count = counts[id];

          return (
            <button
              key={id}
              type="button"
              onClick={() => onStatusFilterChange(id)}
              className={cn(
                "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-semibold transition-colors",
                isActive
                  ? active
                  : "border-primary/20 bg-background text-foreground hover:border-primary/40 hover:bg-primary/10"
              )}
            >
              <span className={cn("h-2 w-2 rounded-full", isActive ? "bg-current/40" : dot)} />
              <span>{label}</span>
              <span
                className={cn(
                  "tabular-nums",
                  isActive ? "opacity-90" : count > 0 ? "text-foreground" : "text-foreground/55"
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
