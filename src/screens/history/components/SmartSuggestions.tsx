import { useMemo, useState } from "react";
import { Globe, AlertTriangle, RotateCcw } from "lucide-react";
import { type HistoryEntry } from "@/store/history";
import { useDownloadsStore } from "@/store/downloads";
import { useNavigationStore } from "@/store/navigation";
import { toast } from "sonner";

interface SmartSuggestionsProps {
  entries: HistoryEntry[];
}

export function SmartSuggestions({ entries }: SmartSuggestionsProps) {
  const addJob = useDownloadsStore((s) => s.addJob);
  const setScreen = useNavigationStore((s) => s.setScreen);

  const [now] = useState(() => Date.now());

  const suggestions = useMemo(() => {
    // Frequent domains
    const domainCounts: Record<string, number> = {};
    for (const e of entries) {
      domainCounts[e.domain] = (domainCounts[e.domain] ?? 0) + 1;
    }
    const frequentDomains = Object.entries(domainCounts)
      .filter(([, count]) => count >= 3)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([domain, count]) => ({ domain, count }));

    // Recent failures (last 7 days)
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const recentFailures = entries.filter(
      (e) => e.status === "failed" && e.downloadedAt > weekAgo
    );

    return { frequentDomains, recentFailures };
  }, [entries, now]);

  const handleRetryAll = () => {
    for (const entry of suggestions.recentFailures) {
      addJob(entry.url, entry.presetId, entry.overrides);
    }
    setScreen("downloads");
    toast.success(`Queued ${suggestions.recentFailures.length} re-download${suggestions.recentFailures.length !== 1 ? "s" : ""}`);
  };

  const hasContent = suggestions.frequentDomains.length > 0 || suggestions.recentFailures.length > 0;
  if (!hasContent) return null;

  return (
    <div className="space-y-3">
      {/* Frequent sources */}
      {suggestions.frequentDomains.length > 0 && (
        <div className="rounded-xl border border-border/50 bg-card/30 backdrop-blur-sm p-4 space-y-2">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-primary" />
            <h4 className="text-sm font-semibold">Frequent Sources</h4>
          </div>
          <div className="flex flex-wrap gap-2">
            {suggestions.frequentDomains.map(({ domain, count }) => (
              <div
                key={domain}
                className="inline-flex items-center gap-1.5 rounded-full border border-border/30 bg-muted/30 px-3 py-1.5 text-xs"
              >
                <Globe className="w-3 h-3 text-muted-foreground" />
                <span className="font-medium">{domain}</span>
                <span className="text-muted-foreground">{count} downloads</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent failures */}
      {suggestions.recentFailures.length > 0 && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 backdrop-blur-sm p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-destructive" />
              <h4 className="text-sm font-semibold">
                {suggestions.recentFailures.length} failed download{suggestions.recentFailures.length !== 1 ? "s" : ""} this week
              </h4>
            </div>
            <button
              onClick={handleRetryAll}
              className="flex items-center gap-1.5 rounded-full bg-destructive/10 hover:bg-destructive/20 px-3 py-1.5 text-xs font-semibold text-destructive transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              Retry All
            </button>
          </div>
          <div className="space-y-1 max-h-32 overflow-auto">
            {suggestions.recentFailures.map((entry) => (
              <p key={entry.id} className="text-xs text-muted-foreground truncate">
                {entry.title}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
