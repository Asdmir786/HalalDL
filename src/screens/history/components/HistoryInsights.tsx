import { useMemo } from "react";
import {
  BarChart3, CheckCircle2, XCircle,
  HardDrive, Globe, TrendingUp, ChevronDown, ChevronUp,
} from "lucide-react";
import { type HistoryEntry } from "@/store/history";
import { cn } from "@/lib/utils";

interface HistoryInsightsProps {
  entries: HistoryEntry[];
  expanded: boolean;
  onToggle: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function HistoryInsights({ entries, expanded, onToggle }: HistoryInsightsProps) {
  const stats = useMemo(() => {
    const completed = entries.filter((e) => e.status === "completed");
    const failed = entries.filter((e) => e.status === "failed");
    const totalSize = completed.reduce((sum, e) => sum + (e.fileSize ?? 0), 0);
    const successRate = entries.length > 0 ? Math.round((completed.length / entries.length) * 100) : 0;

    // Domain breakdown (top 5)
    const domainCounts: Record<string, number> = {};
    for (const e of entries) {
      domainCounts[e.domain] = (domainCounts[e.domain] ?? 0) + 1;
    }
    const topDomains = Object.entries(domainCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([domain, count]) => ({
        domain,
        count,
        pct: Math.round((count / entries.length) * 100),
      }));

    // Format breakdown
    const formatCounts = { video: 0, audio: 0, other: 0 };
    const audioFormats = new Set(["mp3", "m4a", "flac", "wav", "aac", "ogg", "opus", "alac", "wma"]);
    const videoFormats = new Set(["mp4", "mkv", "webm", "avi", "mov", "flv", "wmv", "m4v"]);
    for (const e of completed) {
      const fmt = (e.format ?? e.overrides?.format ?? "").toLowerCase();
      if (audioFormats.has(fmt)) formatCounts.audio++;
      else if (videoFormats.has(fmt) || !fmt) formatCounts.video++;
      else formatCounts.other++;
    }

    // Average duration
    const durationsMs = entries.filter((e) => e.duration && e.duration > 0).map((e) => e.duration!);
    const avgDuration = durationsMs.length > 0
      ? Math.round(durationsMs.reduce((a, b) => a + b, 0) / durationsMs.length / 1000)
      : null;

    return { completed: completed.length, failed: failed.length, totalSize, successRate, topDomains, formatCounts, avgDuration };
  }, [entries]);

  if (entries.length === 0) return null;

  return (
    <div className="rounded-xl border border-border/50 bg-card/30 backdrop-blur-sm overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-card/50 transition-colors cursor-pointer"
      >
        <span className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-primary" />
          Insights
        </span>
        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
          {/* Stat cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard icon={CheckCircle2} label="Completed" value={String(stats.completed)} color="text-green-500" />
            <StatCard icon={XCircle} label="Failed" value={String(stats.failed)} color="text-destructive" />
            <StatCard icon={HardDrive} label="Total Size" value={formatBytes(stats.totalSize)} color="text-blue-400" />
            <StatCard icon={TrendingUp} label="Success Rate" value={`${stats.successRate}%`} color="text-primary" />
          </div>

          {/* Domain breakdown */}
          {stats.topDomains.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Globe className="w-3 h-3" /> Top Sources
              </h4>
              <div className="space-y-1.5">
                {stats.topDomains.map((d) => (
                  <div key={d.domain} className="flex items-center gap-2">
                    <span className="text-xs font-medium min-w-[120px] truncate">{d.domain}</span>
                    <div className="flex-1 h-1.5 rounded-full bg-muted/50 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary/60 transition-all"
                        style={{ width: `${d.pct}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground font-mono shrink-0 w-12 text-right">
                      {d.count} ({d.pct}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Format breakdown */}
          <div className="flex items-center gap-4 text-xs">
            <span className="text-muted-foreground font-semibold uppercase tracking-wider">Format:</span>
            <FormatPill label="Video" count={stats.formatCounts.video} />
            <FormatPill label="Audio" count={stats.formatCounts.audio} />
            <FormatPill label="Other" count={stats.formatCounts.other} />
            {stats.avgDuration !== null && (
              <>
                <span className="w-px h-4 bg-border" />
                <span className="text-muted-foreground">Avg download: <span className="text-foreground font-medium">{stats.avgDuration}s</span></span>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-border/30 bg-muted/20 px-3 py-2.5">
      <Icon className={cn("w-4 h-4 shrink-0", color)} />
      <div>
        <p className="text-sm font-bold leading-tight">{value}</p>
        <p className="text-[10px] text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function FormatPill({ label, count }: { label: string; count: number }) {
  if (count === 0) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted/50 px-2 py-0.5 text-[10px] font-medium">
      {label} <span className="text-muted-foreground">{count}</span>
    </span>
  );
}
