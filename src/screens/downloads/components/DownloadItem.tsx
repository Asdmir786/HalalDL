import { useState } from "react";
import { motion, Variants } from "framer-motion";
import { 
  X, FolderOpen, Terminal, 
  Copy, RotateCcw, Play, Clock, 
  CheckCircle2, AlertTriangle, Link, Loader2, Sparkles 
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DownloadJob } from "@/store/downloads";
import { useLogsStore } from "@/store/logs";
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
  const { addLog } = useLogsStore();
  const [thumbError, setThumbError] = useState(false);
  const ts = getJobTs(job);
  const relative = formatRelativeTime(ts);
  const absolute = new Date(ts).toLocaleString();

  const thumbnailLoading =
    !job.thumbnail && job.thumbnailStatus !== "failed" && job.thumbnailStatus !== "ready";

  const statusMeta =
    job.status === "Queued"
      ? {
          Icon: Clock,
          badgeClassName:
            "text-yellow-300 border-yellow-500/20 bg-yellow-500/10 shadow-[0_0_0_1px_rgba(234,179,8,0.12)]",
        }
      : job.status === "Failed"
        ? {
            Icon: AlertTriangle,
            badgeClassName:
              "text-destructive border-destructive/25 bg-destructive/10 shadow-[0_0_0_1px_rgba(239,68,68,0.14)]",
          }
        : job.status === "Done"
          ? {
              Icon: CheckCircle2,
              badgeClassName:
                "text-emerald-300 border-emerald-500/20 bg-emerald-500/10 shadow-[0_0_0_1px_rgba(16,185,129,0.14)]",
            }
          : job.status === "Post-processing"
            ? {
                Icon: Sparkles,
                badgeClassName:
                  "text-violet-300 border-violet-500/20 bg-violet-500/10 shadow-[0_0_0_1px_rgba(139,92,246,0.14)]",
              }
            : {
                Icon: Loader2,
                iconClassName: "animate-spin",
                badgeClassName:
                  "text-blue-300 border-blue-500/20 bg-blue-500/10 shadow-[0_0_0_1px_rgba(59,130,246,0.14)]",
              };

  const StatusIcon = statusMeta.Icon;
  const phaseOrder = [
    "Resolving formats",
    "Downloading streams",
    "Merging streams",
    "Converting with FFmpeg",
    "Generating thumbnail",
  ] as const;
  const phaseIndex = job.phase ? phaseOrder.indexOf(job.phase as (typeof phaseOrder)[number]) : -1;

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
      addLog({ level: "error", message: `Copy file failed: ${message}` });
    }
  };

  const handleDeleteFile = async (jobId: string, path?: string) => {
    if (path) {
      try {
        await deleteFile(path);
        toast.success("File deleted from disk");
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        toast.error(`Failed to delete file: ${message}`);
        addLog({ level: "error", message: `Delete file failed: ${message}` });
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
          <div
            onDoubleClick={() => {
              if (job.status === "Done" && job.outputPath) {
                openFile(job.outputPath);
              }
            }}
            className="group relative flex gap-4 p-3 rounded-xl border border-white/5 bg-background/40 hover:bg-background/60 hover:border-white/10 backdrop-blur-md shadow-sm transition-all duration-300"
          >
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
                {job.thumbnail && !thumbError ? (
                  <img
                    src={job.thumbnail}
                    alt="Thumbnail"
                    className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
                    onError={() => setThumbError(true)}
                  />
                ) : thumbnailLoading ? (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="w-4 h-4 border-2 border-muted-foreground/20 border-t-muted-foreground/60 rounded-full animate-spin" />
                  </div>
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
                        {job.fallbackUsed && (
                            <>
                              <span className="w-0.5 h-0.5 rounded-full bg-muted-foreground/50" />
                              <span
                                className="rounded-full border border-blue-500/30 bg-blue-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-blue-300"
                                title={job.fallbackFormat ? `Fallback format: ${job.fallbackFormat}` : "Adaptive fallback used"}
                              >
                                Adaptive fallback
                              </span>
                            </>
                        )}
                        {job.outputPath && <span className="w-0.5 h-0.5 rounded-full bg-muted-foreground/50" />}
                        {job.outputPath && (
                            <span className="truncate max-w-[200px] opacity-70" title={job.outputPath}>
                                {job.outputPath.split(/[/\\]/).pop()}
                            </span>
                        )}
                    </div>
                </div>

                <div className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold border shadow-sm backdrop-blur-sm transition-colors", statusMeta.badgeClassName)}>
                    <StatusIcon className={cn("w-3 h-3", statusMeta.iconClassName)} />
                    <span>{job.status}</span>
                </div>
              </div>

              {/* Footer: Progress or Actions */}
              <div className="mt-2">
                {job.status === "Downloading" || job.status === "Post-processing" ? (
                  <div className="flex flex-col gap-1.5 w-full">
                    <div className="flex items-center justify-between w-full text-[10px] text-muted-foreground">
                      <span className="truncate">{job.phase || "Preparing"}</span>
                      <span className="truncate text-right">{job.statusDetail || "Working..."}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {phaseOrder.map((phase, idx) => (
                        <div
                          key={phase}
                          className={cn(
                            "h-1 flex-1 rounded-full transition-colors",
                            idx <= phaseIndex ? "bg-primary/80" : "bg-muted/40"
                          )}
                        />
                      ))}
                    </div>
                    {job.phase === "Converting with FFmpeg" || job.phase === "Merging streams" ? (
                      <>
                        <div className="flex items-center justify-between w-full text-[10px] font-mono font-medium">
                          <span className="flex items-center gap-1.5 text-foreground">
                            <motion.span
                              className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400"
                              animate={{ opacity: [1, 0.3, 1], scale: [1, 0.8, 1] }}
                              transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
                            />
                            FFmpeg
                          </span>
                          <motion.span
                            className="text-muted-foreground"
                            animate={{ opacity: [0.5, 1, 0.5] }}
                            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                          >
                            {job.phase === "Merging streams" ? "Merging..." : "Converting..."}
                          </motion.span>
                        </div>
                        <div className="relative w-full h-1.5 bg-muted/30 rounded-full overflow-hidden">
                          <motion.div
                            className="absolute inset-0 rounded-full"
                            style={{
                              background: "linear-gradient(90deg, transparent, rgba(251,191,36,0.15), transparent)",
                            }}
                            animate={{ x: ["-100%", "100%"] }}
                            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                          />
                          <motion.div
                            className="absolute h-full rounded-full"
                            style={{
                              background: "linear-gradient(90deg, rgba(251,191,36,0.6), rgba(251,191,36,0.9), rgba(251,191,36,0.6))",
                              width: "40%",
                            }}
                            animate={{ left: ["-40%", "100%"] }}
                            transition={{ duration: 1.8, repeat: Infinity, ease: [0.4, 0, 0.2, 1] }}
                          />
                          <motion.div
                            className="absolute h-full rounded-full"
                            style={{
                              background: "linear-gradient(90deg, transparent, rgba(251,191,36,0.4), transparent)",
                              width: "25%",
                            }}
                            animate={{ left: ["-25%", "100%"] }}
                            transition={{ duration: 1.8, repeat: Infinity, ease: [0.4, 0, 0.2, 1], delay: 0.6 }}
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center justify-between w-full text-[10px] font-mono font-medium text-muted-foreground">
                          <span className="text-foreground">{job.speed || "0 KB/s"}</span>
                          <span className="opacity-70">{job.eta || "--:--"}</span>
                        </div>
                        <div className="w-full h-1.5 bg-muted/50 rounded-full overflow-hidden">
                          <motion.div 
                            className="h-full bg-linear-to-r from-primary/80 to-primary rounded-full"
                            initial={{ width: 0 }}
                            animate={{ width: `${job.progress}%` }}
                            transition={{ duration: 0.5, ease: "easeOut" }}
                          />
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[10px] text-muted-foreground truncate">
                      {job.statusDetail || ""}
                    </div>
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
                          className="w-8 h-8 rounded-full border border-primary/20 bg-primary/5 hover:bg-primary/15 hover:text-primary transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            startDownload(job.id);
                          }}
                          title="Start Download"
                        >
                          <Play className="w-4 h-4 fill-current" />
                        </MotionButton>
                      )}

                      <MotionButton
                        variant="ghost"
                        size="icon"
                        className="w-8 h-8 rounded-full border border-destructive/20 bg-destructive/5 hover:bg-destructive/15 hover:text-destructive transition-colors"
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
