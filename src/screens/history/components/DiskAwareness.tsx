import { useMemo } from "react";
import { HardDrive, Trash2 } from "lucide-react";
import { type HistoryEntry } from "@/store/history";
import { deleteFile } from "@/lib/commands";
import { toast } from "sonner";

interface DiskAwarenessProps {
  entries: HistoryEntry[];
  fileExistsMap: Record<string, boolean>;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function DiskAwareness({ entries, fileExistsMap }: DiskAwarenessProps) {
  const stats = useMemo(() => {
    const completed = entries.filter((e) => e.status === "completed");
    const onDisk = completed.filter((e) => fileExistsMap[e.id] === true);
    const removed = completed.filter((e) => fileExistsMap[e.id] === false);
    const diskSize = onDisk.reduce((sum, e) => sum + (e.fileSize ?? 0), 0);

    // Largest files on disk (top 5)
    const largest = [...onDisk]
      .filter((e) => e.fileSize && e.fileSize > 0)
      .sort((a, b) => (b.fileSize ?? 0) - (a.fileSize ?? 0))
      .slice(0, 5);

    return { onDisk: onDisk.length, removed: removed.length, total: completed.length, diskSize, largest };
  }, [entries, fileExistsMap]);

  if (stats.total === 0) return null;

  return (
    <div className="rounded-xl border border-border/50 bg-card/30 backdrop-blur-sm p-4 space-y-3">
      <div className="flex items-center gap-2">
        <HardDrive className="w-4 h-4 text-blue-400" />
        <h4 className="text-sm font-semibold">Disk Usage</h4>
      </div>

      <div className="flex items-center gap-4 text-xs">
        <span>
          <span className="font-bold text-foreground">{stats.onDisk}</span>
          <span className="text-muted-foreground"> of {stats.total} files on disk</span>
        </span>
        <span className="w-px h-4 bg-border" />
        <span>
          <span className="font-bold text-foreground">{formatBytes(stats.diskSize)}</span>
          <span className="text-muted-foreground"> total</span>
        </span>
        {stats.removed > 0 && (
          <>
            <span className="w-px h-4 bg-border" />
            <span className="text-muted-foreground">
              {stats.removed} file{stats.removed !== 1 ? "s" : ""} removed
            </span>
          </>
        )}
      </div>

      {/* Size bar */}
      {stats.total > 0 && (
        <div className="h-2 rounded-full bg-muted/50 overflow-hidden">
          <div
            className="h-full rounded-full bg-blue-500/60 transition-all"
            style={{ width: `${Math.round((stats.onDisk / stats.total) * 100)}%` }}
          />
        </div>
      )}

      {/* Largest files */}
      {stats.largest.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Largest files</p>
          {stats.largest.map((entry) => (
            <div key={entry.id} className="flex items-center justify-between text-xs py-1">
              <span className="truncate max-w-[60%] text-muted-foreground">{entry.title}</span>
              <div className="flex items-center gap-2 shrink-0">
                <span className="font-mono text-[10px]">{formatBytes(entry.fileSize ?? 0)}</span>
                <button
                  onClick={async () => {
                    if (!entry.outputPath) return;
                    try {
                      await deleteFile(entry.outputPath);
                      toast.success("File deleted", { description: entry.title });
                    } catch (e) {
                      toast.error("Failed to delete", { description: String(e) });
                    }
                  }}
                  className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                  title="Delete file"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
