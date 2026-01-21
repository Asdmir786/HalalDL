import { Download } from "lucide-react";
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
      <div className="flex items-center gap-4 text-[11px] text-muted-foreground font-medium">
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-yellow-500/60" />
          {queuedCount} queued
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-blue-500/60" />
          {activeCount} active
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-destructive/70" />
          {failedCount} failed
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500/50" />
          {doneCount} done
        </div>
      </div>

      <MotionButton
        type="button"
        variant="ghost"
        size="sm"
        onClick={onStartAll}
        disabled={!canStartAll}
        className="h-8 text-xs hover:bg-background hover:shadow-sm transition-all"
      >
        <Download className="w-3.5 h-3.5 mr-2" />
        Start All Pending
      </MotionButton>
    </div>
  );
}
