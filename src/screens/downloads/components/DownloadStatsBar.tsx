import { AlertTriangle, CheckCircle2, Clock3, Download, Play, RotateCcw, ArrowUpDown } from "lucide-react";
import { MotionButton } from "@/components/motion/MotionButton";

interface DownloadStatsBarProps {
  queuedCount: number;
  activeCount: number;
  failedCount: number;
  doneCount: number;
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
  onStartQueue,
  showStartQueue,
  onRetryFailed,
  canRetryFailed,
  sortMode,
  onSortModeChange
}: DownloadStatsBarProps) {
  const stats = [
    {
      id: "queued",
      label: `${queuedCount} ${activeCount > 0 ? "waiting" : "queued"}`,
      Icon: Clock3,
      className:
        "border-yellow-500/20 bg-yellow-500/10 text-yellow-300",
    },
    {
      id: "active",
      label: `${activeCount} active`,
      Icon: Download,
      className:
        "border-blue-500/20 bg-blue-500/10 text-blue-300",
    },
    {
      id: "failed",
      label: `${failedCount} failed`,
      Icon: AlertTriangle,
      className:
        "border-destructive/20 bg-destructive/10 text-destructive",
    },
    {
      id: "done",
      label: `${doneCount} done`,
      Icon: CheckCircle2,
      className:
        "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
    },
  ];

  return (
    <div className="flex items-center justify-between pt-2 border-t border-muted/50 gap-3 flex-wrap">
      <div className="flex items-center gap-2 text-[11px] font-semibold tabular-nums flex-wrap">
        {stats.map(({ id, label, Icon, className }) => (
          <div
            key={id}
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 backdrop-blur-sm transition-colors ${className}`}
          >
            <Icon className="w-3 h-3" />
            <span>{label}</span>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 flex-wrap justify-end">
        <div className="flex items-center gap-1.5 rounded-full border border-border/50 bg-muted/20 px-2 py-1">
          <ArrowUpDown className="w-3 h-3 text-muted-foreground" />
          <button
            type="button"
            onClick={() => onSortModeChange("newest")}
            className={`px-2 py-0.5 rounded-full text-[11px] font-medium transition-colors ${
              sortMode === "newest"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Newest
          </button>
          <button
            type="button"
            onClick={() => onSortModeChange("status")}
            className={`px-2 py-0.5 rounded-full text-[11px] font-medium transition-colors ${
              sortMode === "status"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Status
          </button>
        </div>

        <MotionButton
          type="button"
          variant="outline"
          size="sm"
          onClick={onRetryFailed}
          disabled={!canRetryFailed}
          className="h-8 px-3 text-xs font-semibold gap-1.5 rounded-full border-destructive/30 text-destructive hover:bg-destructive/10 disabled:opacity-40 transition-all"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Retry Failed
        </MotionButton>
        {showStartQueue && (
          <MotionButton
            type="button"
            variant="default"
            size="sm"
            onClick={onStartQueue}
            className="h-8 px-4 text-xs font-semibold gap-1.5 rounded-full bg-linear-to-r from-primary/95 via-primary to-primary/85 hover:from-primary hover:to-primary shadow-md shadow-primary/20 transition-all"
          >
            <Play className="w-3.5 h-3.5" />
            Start Queue
          </MotionButton>
        )}
      </div>
    </div>
  );
}
