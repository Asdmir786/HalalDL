import { AnimatePresence, motion, Variants } from "framer-motion";
import { DownloadItem } from "./DownloadItem";
import { DownloadJob } from "@/store/downloads";
import { MotionButton } from "@/components/motion/MotionButton";
import { Download } from "lucide-react";
import { FadeInItem } from "@/components/motion/StaggerContainer";

interface DownloadListProps {
  jobs: DownloadJob[];
  selectedIds: string[];
  onToggleSelection: (id: string) => void;
  onStartSelected: () => void;
  onRemoveSelected: () => void;
  onClearCompleted: () => void;
  onRemoveJob: (id: string) => void;
  onViewLogs: (id: string) => void;
  itemVariants: Variants;
  formatRelativeTime: (ts: number) => string;
}

export function DownloadList({
  jobs,
  selectedIds,
  onToggleSelection,
  onStartSelected,
  onRemoveSelected,
  onClearCompleted,
  onRemoveJob,
  onViewLogs,
  itemVariants,
  formatRelativeTime
}: DownloadListProps) {
  const hasCompleted = jobs.some((job) => job.status === "Done" || job.status === "Failed");

  return (
    <FadeInItem className="flex-1 overflow-hidden flex flex-col px-8 pb-8">
      <div className="bg-black/5 rounded-2xl border border-white/5 flex-1 flex flex-col overflow-hidden shadow-inner backdrop-blur-sm">
        {jobs.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8 text-center">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5 }}
              className="w-24 h-24 bg-gradient-to-tr from-primary/20 to-secondary/20 rounded-full flex items-center justify-center mb-6 shadow-lg border border-white/10 backdrop-blur-md"
            >
              <Download className="w-10 h-10 text-primary/50" />
            </motion.div>
            <h3 className="text-xl font-bold text-foreground/90 mb-2 tracking-tight">Your Queue is Empty</h3>
            <p className="text-sm max-w-[280px] text-muted-foreground/80 leading-relaxed">
              Paste a URL above to start downloading. We support YouTube, Twitch, TikTok, and thousands more.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-end px-4 pt-4 pb-2 gap-2">
                <AnimatePresence>
                  {selectedIds.length > 0 && (
                      <motion.div
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 20 }}
                          className="flex gap-2"
                      >
                          <MotionButton
                              type="button"
                              variant="secondary"
                              size="sm"
                              className="h-7 px-3 text-xs rounded-full shadow-sm"
                              onClick={onStartSelected}
                          >
                              Start Selected
                          </MotionButton>
                          <MotionButton
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 px-3 text-xs rounded-full hover:bg-destructive/10 hover:text-destructive"
                              onClick={onRemoveSelected}
                          >
                              Remove
                          </MotionButton>
                      </motion.div>
                  )}
                </AnimatePresence>
                
                <div className="flex-1" />

                <MotionButton
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-3 text-xs rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  disabled={!hasCompleted}
                  onClick={onClearCompleted}
                >
                  Clear Completed
                </MotionButton>
            </div>
            <div className="flex-1 overflow-auto p-4 pt-0">
              <div className="flex flex-col gap-2 relative">
                <AnimatePresence mode="popLayout" initial={false}>
                  {jobs.map((job) => (
                    <DownloadItem
                      key={job.id}
                      job={job}
                      isSelected={selectedIds.includes(job.id)}
                      onToggleSelection={onToggleSelection}
                      onRemove={onRemoveJob}
                      onViewLogs={onViewLogs}
                      itemVariants={itemVariants}
                      formatRelativeTime={formatRelativeTime}
                    />
                  ))}
                </AnimatePresence>
            </div>
            </div>
          </>
        )}
      </div>
    </FadeInItem>
  );
}
