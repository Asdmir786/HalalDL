import { motion, Variants } from "framer-motion";
import { 
  X, FolderOpen, Download, Terminal, 
  Copy, RotateCcw, Play, Clock, 
  CheckCircle2, AlertTriangle, Link 
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DownloadJob } from "@/store/downloads";
import { MotionButton } from "@/components/motion/MotionButton";
import { revealInExplorer, deleteFile, openFile, copyFilesToClipboard } from "@/lib/commands";
import { startDownload } from "@/lib/downloader";
import { Checkbox } from "@/components/ui/checkbox";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger, ContextMenuSeparator } from "@/components/ui/context-menu";
import { toast } from "sonner";
import { getJobTs } from "../utils";

interface DownloadItemProps {
  job: DownloadJob;
  isSelected: boolean;
  onToggleSelection: (id: string) => void;
  onRemove: (id: string) => void;
  onViewLogs: (id: string) => void;
  itemVariants: Variants;
  formatRelativeTime: (ts: number) => string;
}

export function DownloadItem({
  job,
  isSelected,
  onToggleSelection,
  onRemove,
  onViewLogs,
  itemVariants,
  formatRelativeTime
}: DownloadItemProps) {
  const ts = getJobTs(job);
  const relative = formatRelativeTime(ts);
  const absolute = new Date(ts).toLocaleString();

  const statusIcon =
    job.status === "Queued"
      ? Clock
      : job.status === "Failed"
        ? AlertTriangle
      : job.status === "Done"
        ? CheckCircle2
        : Download;

  const statusColor =
    job.status === "Queued"
      ? "text-yellow-500 border-yellow-500/20 bg-yellow-500/10"
      : job.status === "Failed"
        ? "text-destructive border-destructive/20 bg-destructive/10"
      : job.status === "Done"
        ? "text-emerald-500 border-emerald-500/20 bg-emerald-500/10"
        : "text-blue-500 border-blue-500/20 bg-blue-500/10";

  const StatusIcon = statusIcon;

  const handleCopyLink = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success("Link copied to clipboard");
  };

  const handleCopyFile = async (path: string) => {
    try {
      await copyFilesToClipboard([path]);
      toast.success("File copied to clipboard");
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      toast.error(`Failed to copy file: ${message}`);
    }
  };

  const handleDeleteFile = async (jobId: string, path?: string) => {
    if (path) {
      try {
        await deleteFile(path);
        toast.success("File deleted from disk");
      } catch (e) {
        toast.error("Failed to delete file");
        console.error(e);
      }
    }
    onRemove(jobId);
  };

  return (
    <motion.div
      layout
      key={job.id}
      initial="initial"
      animate="animate"
      exit="exit"
      whileHover="hover"
      variants={itemVariants}
      className="w-full"
    >
      <ContextMenu>
        <ContextMenuTrigger>
          <div className="group relative flex gap-4 p-3 rounded-xl border border-white/5 bg-background/40 hover:bg-background/60 hover:border-white/10 backdrop-blur-md shadow-sm transition-all duration-300">
            {/* Selection & Thumbnail Column */}
            <div className="flex items-start gap-3">
              <div className="pt-1">
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => onToggleSelection(job.id)}
                  className="border-white/20 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                />
              </div>

              <div className="relative w-28 aspect-video rounded-lg overflow-hidden bg-black/20 ring-1 ring-white/10 shadow-inner group-hover:shadow-md transition-all">
                {job.thumbnail ? (
                  <img
                    src={job.thumbnail}
                    alt="Thumbnail"
                    className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground/20">
                    <Play className="w-6 h-6" />
                  </div>
                )}
              </div>
            </div>

            {/* Content Column */}
            <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
              {/* Header */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex flex-col gap-0.5 min-w-0">
                    <h4 className="font-semibold text-sm leading-tight text-foreground/90 truncate pr-2 group-hover:text-primary transition-colors">
                    {job.title || job.url}
                    </h4>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-medium">
                        <span className="flex items-center gap-1" title={absolute}>
                            <Clock className="w-3 h-3 opacity-70" /> {relative}
                        </span>
                        {job.outputPath && <span className="w-0.5 h-0.5 rounded-full bg-muted-foreground/50" />}
                        {job.outputPath && (
                            <span className="truncate max-w-[200px] opacity-70" title={job.outputPath}>
                                {job.outputPath.split(/[/\\]/).pop()}
                            </span>
                        )}
                    </div>
                </div>

                <div className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold border shadow-sm backdrop-blur-sm transition-colors", statusColor)}>
                    <StatusIcon className="w-3 h-3" />
                    <span>{job.status}</span>
                </div>
              </div>

              {/* Footer: Progress or Actions */}
              <div className="mt-2">
                {job.status === "Downloading" || job.status === "Post-processing" ? (
                  <div className="flex flex-col gap-1.5 w-full">
                    <div className="flex items-center justify-between w-full text-[10px] font-mono font-medium text-muted-foreground">
                      <span className="text-foreground">{job.speed || "0 KB/s"}</span>
                      <span className="opacity-70">{job.eta || "--:--"}</span>
                    </div>
                    <div className="w-full h-1.5 bg-muted/50 rounded-full overflow-hidden">
                      <motion.div 
                        className="h-full bg-gradient-to-r from-primary/80 to-primary rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${job.progress}%` }}
                        transition={{ duration: 0.5, ease: "easeOut" }}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-end gap-1">
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-4 group-hover:translate-x-0">
                      {job.status === "Done" && (
                        <MotionButton
                          variant="ghost"
                          size="icon"
                          className="w-8 h-8 rounded-full hover:bg-primary/10 hover:text-primary transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            revealInExplorer(job.outputPath || "");
                          }}
                          title="Show in Explorer"
                        >
                          <FolderOpen className="w-4 h-4" />
                        </MotionButton>
                      )}

                      {(job.status === "Queued" || job.status === "Failed") && (
                        <MotionButton
                          variant="ghost"
                          size="icon"
                          className="w-8 h-8 rounded-full hover:bg-primary/10 hover:text-primary transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            startDownload(job.id);
                          }}
                          title="Start Download"
                        >
                          <Download className="w-4 h-4" />
                        </MotionButton>
                      )}

                      <MotionButton
                        variant="ghost"
                        size="icon"
                        className="w-8 h-8 rounded-full hover:bg-destructive/10 hover:text-destructive transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemove(job.id);
                        }}
                        title="Remove"
                      >
                        <X className="w-4 h-4" />
                      </MotionButton>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </ContextMenuTrigger>

        <ContextMenuContent className="w-48">
          {job.status === "Done" && job.outputPath && (
            <>
              <ContextMenuItem onClick={() => openFile(job.outputPath!)}>
                <Play className="mr-2 h-3.5 w-3.5" />
                Open File
              </ContextMenuItem>
              <ContextMenuItem onClick={() => revealInExplorer(job.outputPath!)}>
                <FolderOpen className="mr-2 h-3.5 w-3.5" />
                Show in Explorer
              </ContextMenuItem>
              <ContextMenuItem onClick={() => handleCopyFile(job.outputPath!)}>
                <Copy className="mr-2 h-3.5 w-3.5" />
                Copy File
              </ContextMenuItem>
              <ContextMenuSeparator />
            </>
          )}
          <ContextMenuItem onClick={() => handleCopyLink(job.url)}>
            <Link className="mr-2 h-3.5 w-3.5" />
            Copy Link
          </ContextMenuItem>
          {job.status === "Failed" && (
            <ContextMenuItem onClick={() => startDownload(job.id)}>
              <RotateCcw className="mr-2 h-3.5 w-3.5" />
              Retry
            </ContextMenuItem>
          )}
          <ContextMenuSeparator />
          <ContextMenuItem onClick={() => onViewLogs(job.id)}>
            <Terminal className="mr-2 h-3.5 w-3.5" />
            View Logs
          </ContextMenuItem>
          <ContextMenuItem
            onClick={() => {
              navigator.clipboard.writeText(JSON.stringify(job, null, 2));
              toast.success("Job details copied");
            }}
          >
            <Copy className="mr-2 h-3.5 w-3.5" />
            Copy Debug Info
          </ContextMenuItem>
          <ContextMenuSeparator />
          {job.status === "Done" && job.outputPath && (
            <ContextMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => handleDeleteFile(job.id, job.outputPath)}
            >
              <X className="mr-2 h-3.5 w-3.5" />
              Delete File
            </ContextMenuItem>
          )}
          <ContextMenuItem onClick={() => onRemove(job.id)}>
            <X className="mr-2 h-3.5 w-3.5" />
            Remove from List
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </motion.div>
  );
}
