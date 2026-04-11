import { useEffect, useMemo, useState } from "react";
import { History, FolderOpen, X } from "lucide-react";
import { useHistoryStore } from "@/store/history";
import { exists } from "@tauri-apps/plugin-fs";
import { openFile } from "@/lib/commands";
import { cn } from "@/lib/utils";
import { formatBytes } from "../utils";

interface DuplicateWarningProps {
  url: string;
  onDismiss: () => void;
}

function formatRelative(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}

/**
 * Key this component on `url` from the parent so it remounts when URL changes,
 * avoiding ref/effect state-reset issues.
 */
export function DuplicateWarning({ url, onDismiss }: DuplicateWarningProps) {
  const findByUrl = useHistoryStore((s) => s.findByUrl);
  const [fileExists, setFileExists] = useState<boolean | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const matches = useMemo(() => {
    if (!url.trim()) return [];
    return findByUrl(url.trim());
  }, [url, findByUrl]);

  const latest = matches.length > 0 ? matches[0] : null;

  useEffect(() => {
    if (!latest?.outputPath) return;
    let cancelled = false;
    exists(latest.outputPath).then((ex) => {
      if (!cancelled) setFileExists(ex);
    }).catch(() => {
      if (!cancelled) setFileExists(false);
    });
    return () => { cancelled = true; };
  }, [latest?.outputPath]);

  if (!latest || dismissed) return null;

  const sizeStr = formatBytes(latest.fileSize);

  return (
    <div className={cn(
      "flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm animate-in fade-in slide-in-from-top-2 duration-200",
      "border-blue-500/20 bg-blue-500/5"
    )}>
      <History className="w-4 h-4 text-blue-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-blue-400">
          Downloaded before
          {matches.length > 1 && ` (${matches.length} times)`}
        </p>
        <p className="text-[11px] text-muted-foreground truncate">
          {formatRelative(latest.downloadedAt)}
          {latest.format && ` · ${latest.format.toUpperCase()}`}
          {sizeStr && ` · ${sizeStr}`}
          {fileExists === true && " · File exists"}
          {fileExists === false && " · File removed"}
        </p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {fileExists && latest.outputPath && (
          <button
            onClick={() => openFile(latest.outputPath!)}
            className="px-2 py-1 rounded-md text-[10px] font-semibold bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors"
          >
            <FolderOpen className="w-3 h-3 inline mr-1" />
            Open
          </button>
        )}
        <button
          onClick={() => { setDismissed(true); onDismiss(); }}
          className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          title="Dismiss"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
