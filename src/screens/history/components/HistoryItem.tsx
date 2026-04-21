import {
  RotateCcw, FolderOpen, Copy, Link, Trash2,
  FileText, CheckCircle2, XCircle, Clock, Globe, Play,
  Star, Pencil, FileMinus, Images
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { HistoryDetails } from "./HistoryDetails";
import { useState } from "react";
import { getExplicitOutputPaths, getPreferredThumbnailSource } from "@/lib/output-paths";

interface HistoryItemProps {
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

export function HistoryItem({
  entry,
  onRemove,
  fileExists,
  formatRelativeTime,
  isSelected,
  onToggleSelection
}: HistoryItemProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
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

  const handleCopyFile = async () => {
    if (explicitOutputPaths.length > 0 && fileExists) {
      try {
        await copyFilesToClipboard(explicitOutputPaths);
        toast.success("Copied to clipboard");
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        toast.error(`Failed to copy: ${message}`);
      }
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
  const displayThumbnail = getPreferredThumbnailSource(entry);
  const hasThumbnailSheet = Boolean(entry.thumbnailSheet);

  return (
    <>
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          className={cn(
            "group relative flex items-center gap-3 rounded-xl border border-border/50 px-4 py-3",
            "bg-card/72 backdrop-blur-sm transition-all duration-200 dark:border-transparent dark:bg-card/30",
            "hover:bg-card/92 hover:border-border/80 hover:shadow-sm cursor-default dark:hover:bg-card/60 dark:hover:border-border/50"
          )}
          onDoubleClick={() => isCompleted && fileExists && handleOpen()}
        >
          <div className="pt-1">
            <Checkbox
              checked={isSelected}
              onCheckedChange={() => onToggleSelection(entry.id)}
              className="border-border/65 data-[state=checked]:bg-primary data-[state=checked]:border-primary dark:border-white/20"
            />
          </div>
          {/* Thumbnail */}
          <div className="relative w-14 h-10 rounded-md overflow-hidden bg-muted/50 shrink-0 flex items-center justify-center">
            {displayThumbnail ? (
              <img
                src={displayThumbnail}
                alt=""
                className="w-full h-full object-cover"
                loading="lazy"
              />
            ) : (
              <FileText className="w-5 h-5 text-muted-foreground/50" />
            )}
            <div className="absolute bottom-0.5 right-0.5">
              {isCompleted ? (
                <CheckCircle2 className="w-3 h-3 text-green-500 drop-shadow-sm" />
              ) : (
                <XCircle className="w-3 h-3 text-destructive drop-shadow-sm" />
              )}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-medium truncate">{entry.title}</h4>
              {entry.isFavorite && <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />}
            </div>
            <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1 shrink-0 whitespace-nowrap">
                <Clock className="w-3 h-3 opacity-70" /> {relative}
              </span>
              <span className="w-0.5 h-0.5 rounded-full bg-muted-foreground/50" />
              <span className="flex items-center gap-1 shrink-0 whitespace-nowrap">
                <Globe className="w-3 h-3 opacity-70" /> {entry.domain}
              </span>
              {sizeStr && (
                <>
                  <span className="w-0.5 h-0.5 rounded-full bg-muted-foreground/50" />
                  <span className="shrink-0">{sizeStr}</span>
                </>
              )}
              {entry.format && (
                <>
                  <span className="w-0.5 h-0.5 rounded-full bg-muted-foreground/50" />
                  <span className="shrink-0 uppercase font-semibold">{entry.format}</span>
                </>
              )}
              {entry.outputPath && fileExists !== null && (
                <>
                  <span className="w-0.5 h-0.5 rounded-full bg-muted-foreground/50" />
                  <span className={cn(
                    "flex items-center gap-0.5 shrink-0",
                    fileExists ? "text-green-500/80" : "text-muted-foreground/50"
                  )}>
                    <span className={cn("w-1.5 h-1.5 rounded-full", fileExists ? "bg-green-500" : "bg-muted-foreground/40")} />
                    {fileExists ? "On disk" : "File removed"}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Quick actions on hover */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            {isCompleted && entry.outputPath && fileExists && (
              <button
                onClick={handleOpen}
                className="p-1.5 rounded-md hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                title="Play / Open File"
              >
                <Play className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={() => toggleFavorite(entry.id)}
              className={cn(
                "p-1.5 rounded-md transition-colors",
                entry.isFavorite
                  ? "text-yellow-500 hover:bg-yellow-500/10"
                  : "hover:bg-primary/10 text-muted-foreground hover:text-primary"
              )}
              title={entry.isFavorite ? "Remove from favorites" : "Add to favorites"}
            >
              <Star className={cn("w-3.5 h-3.5", entry.isFavorite && "fill-current")} />
            </button>
            <button
              onClick={handleRedownload}
              className="p-1.5 rounded-md hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
              title="Re-download"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            {isCompleted && entry.outputPath && fileExists && (
              <button
                onClick={handleReveal}
                className="p-1.5 rounded-md hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                title="Show in Explorer"
              >
                <FolderOpen className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={() => setDetailsOpen(true)}
              className="p-1.5 rounded-md hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
              title="Details & Notes"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onRemove(entry.id)}
              className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
              title="Remove from history"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
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
            <ContextMenuItem onClick={() => void handleCopyFile()}>
              <Copy className="w-3.5 h-3.5 mr-2" /> Copy
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
        {hasThumbnailSheet && (
          <ContextMenuItem onClick={() => setSheetOpen(true)}>
            <Images className="w-3.5 h-3.5 mr-2" /> View Contact Sheet
          </ContextMenuItem>
        )}
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
    <Dialog open={sheetOpen} onOpenChange={setSheetOpen}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Contact Sheet</DialogTitle>
        </DialogHeader>
        {entry.thumbnailSheet && (
          <img
            src={entry.thumbnailSheet}
            alt="Thumbnail contact sheet"
            className="w-full rounded-lg border border-border/60 bg-muted/30"
          />
        )}
      </DialogContent>
    </Dialog>
    </>
  );
}
