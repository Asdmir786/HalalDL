import {
  RotateCcw, FolderOpen, Copy, Link, Trash2,
  FileText, CheckCircle2, XCircle, Clock, Play,
  Star, FileMinus,
  Pencil
} from "lucide-react";
import { cn } from "@/lib/utils";
import { type HistoryEntry, useHistoryStore } from "@/store/history";
import {
  ContextMenu, ContextMenuContent, ContextMenuItem,
  ContextMenuTrigger, ContextMenuSeparator,
} from "@/components/ui/context-menu";
import { revealInExplorer, openFile, copyFilesToClipboard, deleteFile } from "@/lib/commands";
import { useDownloadsStore } from "@/store/downloads";
import { useNavigationStore } from "@/store/navigation";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { HistoryDetails } from "./HistoryDetails";
import { useState } from "react";
import { getExplicitOutputPaths } from "@/lib/output-paths";

interface HistoryGridProps {
  entry: HistoryEntry;
  onRemove: (id: string) => void;
  fileExists: boolean | null;
  formatRelativeTime: (ts: number) => string;
  isSelected: boolean;
  onToggleSelection: (id: string) => void;
}

function formatBytes(bytes: number | undefined): string {
  if (!bytes || bytes === 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function HistoryGrid({
  entry,
  onRemove,
  fileExists,
  formatRelativeTime,
  isSelected,
  onToggleSelection
}: HistoryGridProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const addJob = useDownloadsStore((s) => s.addJob);
  const setScreen = useNavigationStore((s) => s.setScreen);
  const toggleFavorite = useHistoryStore((s) => s.toggleFavorite);
  const explicitOutputPaths = getExplicitOutputPaths(entry);

  const handleRedownload = () => {
    addJob(entry.url, entry.presetId, entry.overrides);
    setScreen("downloads");
    toast.success("Re-download queued", { description: entry.title });
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(entry.url);
    toast.success("URL copied");
  };

  const handleCopyPath = () => {
    if (entry.outputPath) {
      navigator.clipboard.writeText(entry.outputPath);
      toast.success("Path copied");
    }
  };

  const handleOpen = () => {
    if (entry.outputPath && fileExists) openFile(entry.outputPath);
  };

  const handleReveal = () => {
    if (entry.outputPath) revealInExplorer(entry.outputPath);
  };

  const handleCopyFile = () => {
    if (explicitOutputPaths.length > 0 && fileExists) {
      copyFilesToClipboard(explicitOutputPaths);
      toast.success(
        `${explicitOutputPaths.length} file${explicitOutputPaths.length === 1 ? "" : "s"} copied to clipboard`
      );
    }
  };

  const handleDeleteFile = async () => {
    if (!entry.outputPath || !fileExists) return;
    if (!await confirm(`Are you sure you want to permanently delete "${entry.title}" from your disk? This cannot be undone.`)) return;
    
    try {
      await deleteFile(entry.outputPath);
      onRemove(entry.id);
      toast.success("File deleted from disk");
    } catch (e) {
      toast.error("Failed to delete file");
      console.error(e);
    }
  };

  const isCompleted = entry.status === "completed";
  const relative = formatRelativeTime(entry.downloadedAt);
  const sizeStr = formatBytes(entry.fileSize);

  return (
    <>
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          className={cn(
            "group relative flex flex-col rounded-xl border border-transparent overflow-hidden",
            "bg-card/30 backdrop-blur-sm transition-all duration-200",
            "hover:bg-card/60 hover:border-border/50 hover:shadow-sm cursor-default"
          )}
          onDoubleClick={() => isCompleted && fileExists && handleOpen()}
        >
            {/* Thumbnail */}
            <div className="relative aspect-video w-full bg-muted/50 overflow-hidden flex items-center justify-center">
                {entry.thumbnail ? (
                    <img
                        src={entry.thumbnail}
                        alt=""
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        loading="lazy"
                    />
                ) : (
                    <FileText className="w-8 h-8 text-muted-foreground/50" />
                )}
                
                {/* Checkbox overlay */}
                <div className="absolute top-2 left-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity data-[checked=true]:opacity-100" data-checked={isSelected}>
                    <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => onToggleSelection(entry.id)}
                        className="border-white/50 bg-black/20 data-[state=checked]:bg-primary data-[state=checked]:border-primary backdrop-blur-sm"
                    />
                </div>

                {/* Status icon overlay */}
                <div className="absolute bottom-2 right-2 z-10">
                    {isCompleted ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500 drop-shadow-md bg-black/20 rounded-full" />
                    ) : (
                        <XCircle className="w-4 h-4 text-destructive drop-shadow-md bg-black/20 rounded-full" />
                    )}
                </div>

                {/* Play button overlay */}
                {isCompleted && fileExists && (
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20 backdrop-blur-[1px]">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleOpen();
                            }}
                            className="p-3 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-md transition-transform hover:scale-110"
                        >
                            <Play className="w-6 h-6 fill-current" />
                        </button>
                    </div>
                )}
            </div>

            {/* Content */}
            <div className="p-3 flex flex-col gap-1.5">
                <div className="flex items-start justify-between gap-2">
                    <h4 className="text-sm font-medium line-clamp-2 leading-tight cursor-pointer hover:underline decoration-muted-foreground/50" title={entry.title} onClick={() => setDetailsOpen(true)}>
                        {entry.title}
                    </h4>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            toggleFavorite(entry.id);
                        }}
                        className={cn(
                            "shrink-0 p-0.5 transition-colors",
                            entry.isFavorite ? "text-yellow-500" : "text-muted-foreground/30 hover:text-yellow-500"
                        )}
                    >
                        <Star className={cn("w-4 h-4", entry.isFavorite && "fill-current")} />
                    </button>
                </div>
                
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-auto">
                    <span className="flex items-center gap-1 shrink-0 whitespace-nowrap">
                        <Clock className="w-3 h-3 opacity-70" /> {relative}
                    </span>
                    <span className="w-0.5 h-0.5 rounded-full bg-muted-foreground/50" />
                    {sizeStr && (
                        <span className="shrink-0">{sizeStr}</span>
                    )}
                </div>
            </div>
        </div>
      </ContextMenuTrigger>

      <ContextMenuContent>
        <ContextMenuItem onClick={handleRedownload}>
          <RotateCcw className="w-3.5 h-3.5 mr-2" /> Re-download
        </ContextMenuItem>
        <ContextMenuSeparator />
        {isCompleted && entry.outputPath && fileExists && (
          <ContextMenuItem onClick={handleOpen}>
            <Play className="w-3.5 h-3.5 mr-2" /> Play / Open
          </ContextMenuItem>
        )}
        {entry.outputPath && (
          <ContextMenuItem onClick={handleReveal}>
            <FolderOpen className="w-3.5 h-3.5 mr-2" /> Show in Explorer
          </ContextMenuItem>
        )}
        {isCompleted && entry.outputPath && fileExists && (
            <ContextMenuItem onClick={handleCopyFile}>
              <Copy className="w-3.5 h-3.5 mr-2" /> {explicitOutputPaths.length > 1 ? "Copy Files" : "Copy File"}
            </ContextMenuItem>
        )}
        <ContextMenuSeparator />
        <ContextMenuItem onClick={handleCopyUrl}>
          <Link className="w-3.5 h-3.5 mr-2" /> Copy URL
        </ContextMenuItem>
        {entry.outputPath && (
          <ContextMenuItem onClick={handleCopyPath}>
            <Copy className="w-3.5 h-3.5 mr-2" /> Copy File Path
          </ContextMenuItem>
        )}
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => setDetailsOpen(true)}>
          <Pencil className="w-3.5 h-3.5 mr-2" /> Details & Notes
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => toggleFavorite(entry.id)}>
          <Star className={cn("w-3.5 h-3.5 mr-2", entry.isFavorite && "fill-current text-yellow-500")} />
          {entry.isFavorite ? "Unfavorite" : "Favorite"}
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onRemove(entry.id)} className="text-destructive">
          <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete from History
        </ContextMenuItem>
        {isCompleted && entry.outputPath && fileExists && (
          <ContextMenuItem onClick={handleDeleteFile} className="text-destructive focus:text-destructive">
            <FileMinus className="w-3.5 h-3.5 mr-2" /> Delete File from Disk
          </ContextMenuItem>
        )}
      </ContextMenuContent>
    </ContextMenu>
    {detailsOpen && (
      <HistoryDetails
        entry={entry}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        fileExists={fileExists}
      />
    )}
    </>
  );
}
