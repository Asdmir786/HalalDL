import type { ReactNode } from "react";
import { AnimatePresence, motion, Variants } from "framer-motion";
import { CheckCircle2, Copy, Download, Layers, MoreHorizontal, Plus, RotateCcw, Settings, Sparkles, Upload, X } from "lucide-react";

import { DownloadItem } from "./DownloadItem";
import { MotionButton } from "@/components/motion/MotionButton";
import { FadeInItem } from "@/components/motion/StaggerContainer";
import { useNavigationStore } from "@/store/navigation";
import { type DownloadJob } from "@/store/downloads";
import { exportJobTemplate, importJobTemplate } from "@/lib/job-templates";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { DownloadStatusFilter } from "./DownloadStatsBar";

interface DownloadListProps {
  liveJobs: DownloadJob[];
  recentJobs: DownloadJob[];
  totalJobs: number;
  hasVisibleJobs: boolean;
  overflowCount: number;
  hasCompletedJobs: boolean;
  statusFilter: DownloadStatusFilter;
  onResetFilter: () => void;
  selectedIds: string[];
  onToggleSelection: (id: string) => void;
  onRetrySelected: () => void;
  canRetrySelected: boolean;
  selectedFailedCount: number;
  onCopySelected: () => void;
  canCopySelected: boolean;
  onRemoveSelected: () => void;
  onClearCompleted: () => void;
  onRemoveJob: (id: string) => void;
  onViewLogs: (id: string) => void;
  onRetryJob: (id: string) => void;
  queueMetaById: Map<string, { position: number; statusLabel: string; detail: string }>;
  itemVariants: Variants;
  formatRelativeTime: (ts: number) => string;
}

const FILTER_EMPTY_COPY: Record<DownloadStatusFilter, { title: string; body: string }> = {
  all: {
    title: "Nothing to show yet",
    body: "Add a URL above to start building your queue.",
  },
  active: {
    title: "No active downloads",
    body: "Queue something up or start waiting jobs to see live progress here.",
  },
  queued: {
    title: "No queued jobs",
    body: "Everything is either running already or has finished.",
  },
  failed: {
    title: "No failed jobs in view",
    body: "This queue is clean right now. Older failures still live in History.",
  },
  done: {
    title: "No finished jobs in view",
    body: "Completed results will appear here before they roll into History.",
  },
};

function SectionHeader({
  title,
  count,
  accentClassName,
  action,
}: {
  title: string;
  count: number;
  accentClassName: string;
  action?: ReactNode;
}) {
  return (
    <div className="sticky top-0 z-10 flex h-full items-center justify-between gap-3 rounded-2xl border border-white/8 bg-background/88 px-4 py-3 backdrop-blur-xl">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${accentClassName}`} />
          <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-foreground/90">
            {title}
          </h3>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-semibold tabular-nums text-muted-foreground">
          {count}
        </div>
        {action}
      </div>
    </div>
  );
}

export function DownloadList({
  liveJobs,
  recentJobs,
  totalJobs,
  hasVisibleJobs,
  overflowCount,
  hasCompletedJobs,
  statusFilter,
  onResetFilter,
  selectedIds,
  onToggleSelection,
  onRetrySelected,
  canRetrySelected,
  selectedFailedCount,
  onCopySelected,
  canCopySelected,
  onRemoveSelected,
  onClearCompleted,
  onRemoveJob,
  onViewLogs,
  onRetryJob,
  queueMetaById,
  itemVariants,
  formatRelativeTime,
}: DownloadListProps) {
  const { setScreen } = useNavigationStore();
  const filterEmptyCopy = FILTER_EMPTY_COPY[statusFilter];

  return (
    <FadeInItem className="flex min-h-0 flex-1 flex-col px-4 pb-6">
      <div className="relative flex min-h-[320px] flex-col rounded-[24px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.035),rgba(255,255,255,0.015))] shadow-[0_18px_60px_rgba(0,0,0,0.18)] backdrop-blur-xl">
        {totalJobs === 0 ? (
          <div className="relative flex min-h-[560px] min-w-0 flex-col items-center justify-center overflow-hidden px-8 py-12">
            <div className="absolute inset-0 bg-linear-to-b from-transparent via-background/45 to-background" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,var(--tw-gradient-stops))] from-primary/8 via-transparent to-transparent opacity-50 blur-3xl" />

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative z-10 flex max-w-md flex-col items-center text-center"
            >
              <div className="group relative mb-8 cursor-default">
                <div className="absolute -inset-4 rounded-full bg-primary/20 opacity-0 blur-xl transition-opacity duration-700 group-hover:opacity-100" />
                <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl border border-white/10 bg-background/50 shadow-2xl transition-all duration-500 group-hover:scale-105">
                  <Download className="h-8 w-8 text-primary/80" />
                </div>
                <div className="absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-background/50 shadow-lg">
                  <Sparkles className="h-4 w-4 text-yellow-500/80" />
                </div>
                <div className="absolute -bottom-2 -left-2 flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-background/50 shadow-lg">
                  <Layers className="h-4 w-4 text-blue-500/80" />
                </div>
              </div>

              <h3 className="mb-2 bg-linear-to-br from-foreground to-muted-foreground bg-clip-text text-2xl font-bold tracking-tight text-transparent">
                Queue is ready
              </h3>
              <p className="mb-8 text-sm leading-relaxed text-muted-foreground">
                Paste a URL above and this page turns into your live download control room. Live jobs stay pinned up top, and recent results remain close by for quick cleanup.
              </p>

              <div className="mb-4 grid w-full gap-2 text-left text-[11px] text-muted-foreground sm:grid-cols-3">
                <div className="rounded-xl border border-white/5 bg-white/5 p-3">
                  <div className="font-semibold text-foreground/90">Paste link</div>
                  <div className="mt-1 leading-5">Drop in a video, playlist, or supported direct media URL.</div>
                </div>
                <div className="rounded-xl border border-white/5 bg-white/5 p-3">
                  <div className="font-semibold text-foreground/90">Choose output</div>
                  <div className="mt-1 leading-5">Preset-first workflow with custom options when you need them.</div>
                </div>
                <div className="rounded-xl border border-white/5 bg-white/5 p-3">
                  <div className="font-semibold text-foreground/90">Track progress</div>
                  <div className="mt-1 leading-5">Running jobs, queue order, and recent results stay separated.</div>
                </div>
              </div>

              <div className="grid w-full grid-cols-2 gap-3">
                <button
                  type="button"
                  className="col-span-2 flex cursor-pointer items-center gap-3 rounded-xl border border-white/5 bg-white/5 p-3 text-left transition-colors hover:bg-white/10 active:scale-[0.98]"
                  onClick={() => document.getElementById("download-url-input")?.focus()}
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                    <Plus className="h-4 w-4 text-primary" />
                  </div>
                  <div className="text-left">
                    <div className="text-xs font-semibold">New Download</div>
                    <div className="text-[10px] text-muted-foreground">Focus the link box and start building the queue</div>
                  </div>
                </button>

                <button
                  type="button"
                  className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/5 bg-white/5 p-3 text-left transition-colors hover:bg-white/10 active:scale-[0.98]"
                  onClick={() => setScreen("presets")}
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/10">
                    <Layers className="h-4 w-4 text-purple-400" />
                  </div>
                  <div className="text-left">
                    <div className="text-xs font-semibold">Presets</div>
                    <div className="text-[10px] text-muted-foreground">Tune repeatable output profiles</div>
                  </div>
                </button>

                <button
                  type="button"
                  className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/5 bg-white/5 p-3 text-left transition-colors hover:bg-white/10 active:scale-[0.98]"
                  onClick={() => setScreen("tools")}
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10">
                    <Settings className="h-4 w-4 text-blue-400" />
                  </div>
                  <div className="text-left">
                    <div className="text-xs font-semibold">Tools</div>
                    <div className="text-[10px] text-muted-foreground">Check yt-dlp and FFmpeg setup</div>
                  </div>
                </button>
              </div>
            </motion.div>
          </div>
        ) : !hasVisibleJobs ? (
          <div className="flex min-h-[420px] min-w-0 flex-col items-center justify-center gap-3 px-8 py-10 text-center">
            <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Filter Active
            </div>
            <h3 className="text-xl font-semibold tracking-tight">{filterEmptyCopy.title}</h3>
            <p className="max-w-md text-sm text-muted-foreground">{filterEmptyCopy.body}</p>
            <MotionButton
              type="button"
              variant="outline"
              size="sm"
              className="rounded-full"
              onClick={onResetFilter}
            >
              Show all jobs
            </MotionButton>
          </div>
        ) : (
          <>
            <div className="sticky top-0 z-20 flex shrink-0 flex-wrap items-center justify-end gap-2 border-b border-white/6 bg-background/75 px-4 py-2 backdrop-blur-xl">
              <AnimatePresence>
                {selectedIds.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="flex flex-wrap items-center gap-2"
                  >
                    <div className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-foreground/85">
                      {selectedIds.length} selected
                    </div>
                    {selectedFailedCount > 0 && (
                      <MotionButton
                        type="button"
                        variant="secondary"
                        size="sm"
                      className="h-7 rounded-full border border-destructive/20 bg-destructive/10 px-3 text-[11px] text-destructive shadow-sm gap-1.5 hover:bg-destructive/20"
                        onClick={onRetrySelected}
                        disabled={!canRetrySelected}
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Retry Failed ({selectedFailedCount})
                      </MotionButton>
                    )}
                    <MotionButton
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="h-7 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 text-[11px] text-blue-300 shadow-sm gap-1.5 hover:bg-blue-500/20"
                      onClick={onCopySelected}
                      disabled={!canCopySelected}
                    >
                      <Copy className="h-3.5 w-3.5" />
                      Copy Files
                    </MotionButton>
                    <MotionButton
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 rounded-full border border-destructive/20 bg-destructive/5 px-3 text-[11px] text-destructive/90 gap-1.5 hover:bg-destructive/15 hover:text-destructive"
                      onClick={onRemoveSelected}
                    >
                      <X className="h-3.5 w-3.5" />
                      Remove
                    </MotionButton>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex-1" />

              <div className="text-[11px] text-muted-foreground">
                {liveJobs.length > 0 ? `${liveJobs.length} live` : `${recentJobs.length} recent`}
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <MotionButton
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 rounded-full border border-muted/60 bg-background/50 px-3 text-[11px] text-muted-foreground gap-1.5 transition-colors hover:border-muted hover:text-foreground"
                  >
                    <MoreHorizontal className="h-3.5 w-3.5" />
                    Actions
                  </MotionButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem onClick={() => void importJobTemplate()}>
                    <Upload className="mr-2 h-3.5 w-3.5" />
                    Import
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => void exportJobTemplate(selectedIds)}>
                    <Download className="mr-2 h-3.5 w-3.5" />
                    Export
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled={!hasCompletedJobs} onClick={onClearCompleted}>
                    <CheckCircle2 className="mr-2 h-3.5 w-3.5" />
                    Clear Completed
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

              <div className="flex min-h-full flex-col gap-2.5 px-4 pb-12 pt-2">
                {liveJobs.length > 0 && (
                  <section className="flex flex-col gap-1.5">
                    <SectionHeader
                      title="Live Queue"
                      count={liveJobs.length}
                      accentClassName="bg-sky-400 shadow-[0_0_16px_rgba(56,189,248,0.65)]"
                    />
                    <div className="flex flex-col gap-1.5">
                      <AnimatePresence mode="popLayout" initial={false}>
                        {liveJobs.map((job) => (
                          <DownloadItem
                            key={job.id}
                            job={job}
                            section="live"
                            isSelected={selectedIds.includes(job.id)}
                            onToggleSelection={onToggleSelection}
                            onRemove={onRemoveJob}
                            onViewLogs={onViewLogs}
                            onRetry={onRetryJob}
                            queueMeta={queueMetaById.get(job.id)}
                            itemVariants={itemVariants}
                            formatRelativeTime={formatRelativeTime}
                          />
                        ))}
                      </AnimatePresence>
                    </div>
                  </section>
                )}

                {recentJobs.length > 0 && (
                  <section className="flex flex-col gap-1.5">
                    <SectionHeader
                      title="Recent Results"
                      count={recentJobs.length}
                      accentClassName="bg-emerald-400 shadow-[0_0_16px_rgba(52,211,153,0.55)]"
                      action={
                        overflowCount > 0 ? (
                          <MotionButton
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-9 shrink-0 rounded-full border border-muted/60 bg-background/65 px-3 text-[11px] text-muted-foreground gap-1.5 transition-colors hover:border-muted hover:text-foreground"
                            onClick={() => setScreen("history")}
                          >
                            +{overflowCount} more in History
                          </MotionButton>
                        ) : undefined
                      }
                    />
                    <div className="flex flex-col gap-1.5">
                      <AnimatePresence mode="popLayout" initial={false}>
                        {recentJobs.map((job) => (
                          <DownloadItem
                            key={job.id}
                            job={job}
                            section="recent"
                            isSelected={selectedIds.includes(job.id)}
                            onToggleSelection={onToggleSelection}
                            onRemove={onRemoveJob}
                            onViewLogs={onViewLogs}
                            onRetry={onRetryJob}
                            queueMeta={queueMetaById.get(job.id)}
                            itemVariants={itemVariants}
                            formatRelativeTime={formatRelativeTime}
                          />
                        ))}
                      </AnimatePresence>
                    </div>
                  </section>
                )}
            </div>
          </>
        )}
      </div>
    </FadeInItem>
  );
}
