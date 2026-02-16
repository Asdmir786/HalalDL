import { AlertTriangle, CheckCircle2, Clock3, Download, Play } from "lucide-react";
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
  const stats = [
    {
      id: "queued",
      label: `${queuedCount} queued`,
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
    <div className="flex items-center justify-between pt-2 border-t border-muted/50 gap-3">
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

      <MotionButton
        type="button"
        variant="default"
        size="sm"
        onClick={onStartAll}
        disabled={!canStartAll}
        className="h-8 px-4 text-xs font-semibold gap-1.5 rounded-full bg-linear-to-r from-primary/95 via-primary to-primary/85 hover:from-primary hover:to-primary shadow-md shadow-primary/20 disabled:opacity-40 transition-all"
      >
        <Play className="w-3.5 h-3.5" />
        Start All
      </MotionButton>
    </div>
  );
}
