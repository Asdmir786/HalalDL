import { useState } from "react";
import { motion, Variants } from "framer-motion";
import {
  X, FolderOpen, Terminal,
  Copy, RotateCcw, Play,
  Link, Clock,
  ArrowUp, ArrowDown, Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DownloadJob } from "@/store/downloads";
import { useLogsStore } from "@/store/logs";
import { useDownloadsStore } from "@/store/downloads";
import { MotionButton } from "@/components/motion/MotionButton";
import { revealInExplorer, deleteFile, openFile, copyFilesToClipboard } from "@/lib/commands";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger, ContextMenuSeparator } from "@/components/ui/context-menu";
import { toast } from "sonner";
import { getJobTs } from "../utils";
import { getStatusMeta, PHASE_ORDER, type Phase } from "../constants";

interface DownloadItemProps {
  job: DownloadJob;
  section?: "live" | "recent";
  isSelected: boolean;
  onToggleSelection: (id: string) => void;
  onRemove: (id: string) => void;
  onViewLogs: (id: string) => void;
  onRetry: (id: string) => void;
  queueMeta?: {
    position: number;
    statusLabel: string;
    detail: string;
  };
  itemVariants: Variants;
  formatRelativeTime: (ts: number) => string;
}

export function DownloadItem({
  job,
  section = "live",
  isSelected,
  onToggleSelection,
  onRemove,
  onViewLogs,
  onRetry,
  queueMeta,
  itemVariants,
  formatRelativeTime
}: DownloadItemProps) {
  const { addLog } = useLogsStore();
  const moveJob = useDownloadsStore((s) => s.moveJob);
  const [thumbError, setThumbError] = useState(false);
  const ts = getJobTs(job);
  const relative = formatRelativeTime(ts);
  const absolute = new Date(ts).toLocaleString();

  const thumbnailLoading =
    !job.thumbnail && job.thumbnailStatus !== "failed" && job.thumbnailStatus !== "ready";

  const statusMeta = getStatusMeta(job.status);
  const StatusIcon = statusMeta.Icon;
  const phaseIndex = job.phase ? PHASE_ORDER.indexOf(job.phase as Phase) : -1;
  const statusLabel = job.status === "Queued" ? queueMeta?.statusLabel || "Queued" : job.status;
  const isActiveJob = job.status === "Downloading" || job.status === "Post-processing";
  const isQueuedJob = job.status === "Queued";
  const isRecentResult = section === "recent";
  const footerDetail = job.status === "Queued"
    ? queueMeta?.detail || job.statusDetail || ""
    : isRecentResult
      ? ""
      : job.statusDetail || "";
  const hasFfmpegProgress = job.phase === "Converting with FFmpeg" && job.ffmpegProgressKnown;
  const showFooterRow =
    job.status === "Queued" ||
    job.status === "Failed" ||
    footerDetail.length > 0;

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
            className={cn(
              "group relative flex gap-3 overflow-hidden rounded-2xl border py-3 pl-14 pr-3 backdrop-blur-md shadow-sm transition-all duration-300",
              isActiveJob &&
                "border-sky-400/15 bg-[linear-gradient(135deg,rgba(56,189,248,0.08),rgba(15,23,42,0.86)_45%,rgba(15,23,42,0.96))] shadow-[0_14px_45px_rgba(14,165,233,0.12)] hover:border-sky-300/25",
              isQueuedJob &&
                "border-yellow-400/12 bg-[linear-gradient(135deg,rgba(250,204,21,0.06),rgba(15,23,42,0.82)_40%,rgba(15,23,42,0.94))] hover:border-yellow-300/20",
              !isActiveJob &&
                !isQueuedJob &&
                !isRecentResult &&
                "border-white/6 bg-background/45 hover:border-white/12 hover:bg-background/60",
              isRecentResult &&
                "border-white/5 bg-background/28 opacity-[0.96] hover:border-white/10 hover:bg-background/40"
            )}
          >
            {isActiveJob && (
              <div className="pointer-events-none absolute inset-x-10 top-0 h-16 bg-sky-400/10 blur-3xl" />
            )}
            <button
              type="button"
              aria-label={isSelected ? "Deselect download" : "Select download"}
              aria-pressed={isSelected}
              onClick={(event) => {
                event.stopPropagation();
                onToggleSelection(job.id);
              }}
              className={cn(
                "absolute left-4 top-1/2 z-20 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border transition-all",
                isSelected
                  ? "border-primary/70 bg-primary text-primary-foreground"
                  : "border-white/12 bg-black/10 text-transparent hover:border-white/25 hover:bg-white/10"
              )}
            >
              <Check className="h-3.5 w-3.5" />
            </button>
            {/* Thumbnail Column */}
            <div className="relative z-10 flex items-center gap-3">
              <div className="relative aspect-video w-24 overflow-hidden rounded-lg bg-black/20 ring-1 ring-white/10 shadow-inner transition-all group-hover:shadow-md">
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
            <div className="relative z-10 flex min-w-0 flex-1 flex-col justify-between py-0.5">
              {/* Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex flex-col gap-1">
                    <h4 className="truncate pr-2 text-[15px] font-semibold leading-tight text-foreground/90 transition-colors group-hover:text-primary">
                    {job.title || job.url}
                    </h4>
                    <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-medium text-muted-foreground">
                        {isActiveJob && (
                            <>
                              <span className="whitespace-nowrap shrink-0 rounded-full border border-sky-400/20 bg-sky-400/10 px-1.5 py-0.5 text-[9px] font-semibold text-sky-200">
                                Live
                              </span>
                              <span className="w-0.5 h-0.5 rounded-full bg-muted-foreground/50" />
                            </>
                        )}
                        <span className="flex items-center gap-1 shrink-0 whitespace-nowrap" title={absolute}>
                            <Clock className="w-3 h-3 opacity-70" /> {relative}
                        </span>
                        {job.outputPath && <span className="w-0.5 h-0.5 rounded-full bg-muted-foreground/50" />}
                        {job.outputPath && (
                            <span className="truncate max-w-[220px] opacity-70" title={job.outputPath}>
                                {job.outputPath.split(/[/\\]/).pop()}
                            </span>
                        )}
                        {job.status === "Queued" && queueMeta && (
                            <>
                              <span className="w-0.5 h-0.5 rounded-full bg-muted-foreground/50" />
                              <span
                                className="whitespace-nowrap shrink-0 rounded-full border border-yellow-500/25 bg-yellow-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-yellow-300"
                                title={`Queue position ${queueMeta.position}`}
                              >
                                #{queueMeta.position} in queue
                              </span>
                            </>
                        )}
                    </div>
                </div>

                <div className={cn("flex shrink-0 items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border transition-colors", statusMeta.badgeClassName)}>
                    <StatusIcon className="w-3 h-3" />
                    <span>{statusLabel}</span>
                </div>
              </div>

              {/* Footer: Progress or Actions */}
              <div className="mt-1">
                {job.status === "Downloading" || job.status === "Post-processing" ? (
                  <div className="flex flex-col gap-1.5 w-full">
                    <div className="flex items-center justify-between w-full text-[10px] text-muted-foreground">
                      <span className="truncate">{job.phase || "Preparing"}</span>
                      <span className="truncate text-right">{job.statusDetail || "Working..."}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {PHASE_ORDER.map((phase, idx) => (
                        <div
                          key={phase}
                          className={cn(
                            "h-1 flex-1 rounded-full transition-colors",
                            idx <= phaseIndex ? "bg-primary/80" : "bg-muted/40"
                          )}
                        />
                      ))}
                    </div>
                    {hasFfmpegProgress ? (
                      <>
                        <div className="flex items-center justify-between w-full text-[10px] font-mono font-medium">
                          <span className="flex items-center gap-1.5 text-foreground">
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400" />
                            FFmpeg
                          </span>
                          <span className="text-muted-foreground">
                            {Math.round(job.progress)}%
                          </span>
                        </div>
                        <div className="flex items-center justify-between w-full text-[10px] font-mono font-medium text-muted-foreground">
                          <span>{job.speed || "FFmpeg"}</span>
                          <span className="opacity-70">{job.statusDetail || "Converting..."}</span>
                        </div>
                        <div className="w-full h-1.5 bg-muted/30 rounded-full overflow-hidden">
                          <motion.div
                            className="h-full rounded-full"
                            style={{
                              background: "linear-gradient(90deg, rgba(251,191,36,0.65), rgba(251,191,36,0.95))",
                            }}
                            initial={{ width: 0 }}
                            animate={{ width: `${job.progress}%` }}
                            transition={{ duration: 0.35, ease: "easeOut" }}
                          />
                        </div>
                      </>
                    ) : job.phase === "Converting with FFmpeg" ? (
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
                            Converting...
                          </motion.span>
                        </div>
                        <div className="flex items-center justify-between w-full text-[10px] font-mono font-medium text-muted-foreground">
                          <span>{job.speed || "FFmpeg"}</span>
                          <span className="opacity-70">{job.statusDetail || "Converting..."}</span>
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
                    ) : job.phase === "Merging streams" ? (
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
                            Merging...
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
                ) : showFooterRow ? (
                  <div className="flex items-center justify-between gap-2">
                    <div className="truncate text-[10px] text-muted-foreground">
                      {footerDetail}
                    </div>
                    <div className="flex items-center gap-1 opacity-100 transition-all duration-300 md:translate-x-4 md:opacity-0 md:group-hover:translate-x-0 md:group-hover:opacity-100">
                      {job.status === "Queued" && (
                        <>
                          <MotionButton
                            variant="ghost"
                            size="icon"
                            className="w-8 h-8 rounded-full hover:bg-primary/10 hover:text-primary transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              moveJob(job.id, "up");
                            }}
                            title="Move up"
                          >
                            <ArrowUp className="w-4 h-4" />
                          </MotionButton>
                          <MotionButton
                            variant="ghost"
                            size="icon"
                            className="w-8 h-8 rounded-full hover:bg-primary/10 hover:text-primary transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              moveJob(job.id, "down");
                            }}
                            title="Move down"
                          >
                            <ArrowDown className="w-4 h-4" />
                          </MotionButton>
                        </>
                      )}
                      <MotionButton
                        variant="ghost"
                        size="icon"
                        className="w-8 h-8 rounded-full hover:bg-primary/10 hover:text-primary transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopyLink(job.url);
                        }}
                        title="Copy URL"
                      >
                        <Link className="w-4 h-4" />
                      </MotionButton>
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

                      {job.status === "Failed" && (
                        <MotionButton
                          variant="ghost"
                          size="icon"
                          className="w-8 h-8 rounded-full border border-primary/20 bg-primary/5 hover:bg-primary/15 hover:text-primary transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            onRetry(job.id);
                          }}
                          title="Retry Download"
                        >
                          <RotateCcw className="w-4 h-4" />
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
                          title={job.status === "Queued" ? "Remove from queue" : "Remove"}
                        >
                          <X className="w-4 h-4" />
                        </MotionButton>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </ContextMenuTrigger>

        <ContextMenuContent className="w-48">
          {job.status === "Queued" && (
            <>
              <ContextMenuItem onClick={() => moveJob(job.id, "up")}>
                <ArrowUp className="mr-2 h-3.5 w-3.5" />
                Move Up
              </ContextMenuItem>
              <ContextMenuItem onClick={() => moveJob(job.id, "down")}>
                <ArrowDown className="mr-2 h-3.5 w-3.5" />
                Move Down
              </ContextMenuItem>
              <ContextMenuSeparator />
            </>
          )}
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
            <ContextMenuItem onClick={() => onRetry(job.id)}>
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
            {job.status === "Queued" ? "Remove from Queue" : "Remove from List"}
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </motion.div>
  );
}
