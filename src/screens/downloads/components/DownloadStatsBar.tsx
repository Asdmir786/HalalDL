import { Play } from "lucide-react";
import { MotionButton } from "@/components/motion/MotionButton";

interface DownloadStatsBarProps {
  queuedCount: number;
  activeCount: number;
  failedCount: number;
  doneCount: number;
  onStartAll: () => void;
  canStartAll: boolean;
}

export function DownloadStatsBar({
  queuedCount,
  activeCount,
  failedCount,
  doneCount,
  onStartAll,
  canStartAll
}: DownloadStatsBarProps) {
  return (
    <div className="flex items-center justify-between pt-2 border-t border-muted/50">
      <div className="flex items-center gap-3 text-[11px] text-muted-foreground font-medium tabular-nums">
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-yellow-500/70 shadow-[0_0_4px_rgba(234,179,8,0.3)]" />
          <span>{queuedCount} queued</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-blue-500/70 shadow-[0_0_4px_rgba(59,130,246,0.3)]" />
          <span>{activeCount} active</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-destructive/80 shadow-[0_0_4px_rgba(239,68,68,0.3)]" />
          <span>{failedCount} failed</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500/60 shadow-[0_0_4px_rgba(34,197,94,0.25)]" />
          <span>{doneCount} done</span>
        </div>
      </div>

      <MotionButton
        type="button"
        variant="default"
        size="sm"
        onClick={onStartAll}
        disabled={!canStartAll}
        className="h-8 px-4 text-xs font-semibold gap-1.5 bg-primary/90 hover:bg-primary shadow-sm disabled:opacity-40 transition-all"
      >
        <Play className="w-3 h-3 fill-current" />
        Start All
      </MotionButton>
    </div>
  );
}
