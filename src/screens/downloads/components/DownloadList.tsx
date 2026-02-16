import { AnimatePresence, motion, Variants } from "framer-motion";
import { useLayoutEffect, useRef, type UIEvent } from "react";
import { DownloadItem } from "./DownloadItem";
import { DownloadJob } from "@/store/downloads";
import { MotionButton } from "@/components/motion/MotionButton";
import { CheckCircle2, Download, Layers, Play, Plus, Settings, Sparkles, X } from "lucide-react";
import { FadeInItem } from "@/components/motion/StaggerContainer";
import { useNavigationStore } from "@/store/navigation";

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
  const { setScreen } = useNavigationStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollTopRef = useRef(0);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = scrollTopRef.current;
  });

  const handleScroll = (event: UIEvent<HTMLDivElement>) => {
    scrollTopRef.current = event.currentTarget.scrollTop;
  };

  return (
    <FadeInItem className="flex-1 overflow-hidden flex flex-col px-8 pb-8">
      <div className="bg-black/5 rounded-2xl border border-white/5 flex-1 flex flex-col overflow-hidden shadow-inner backdrop-blur-sm relative">
        {jobs.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 relative overflow-hidden min-h-[400px]">
              {/* Background Effects */}
              <div className="absolute inset-0 bg-linear-to-b from-transparent via-background/50 to-background z-10" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent opacity-40 blur-3xl" />
          
              {/* Content */}
              <motion.div 
                  initial={{ opacity: 0, y: 20 }} 
                  animate={{ opacity: 1, y: 0 }} 
                  className="relative z-20 flex flex-col items-center text-center max-w-md"
              >
                  {/* Icon Cluster */}
                  <div className="relative mb-8 group cursor-default">
                      <div className="absolute -inset-4 bg-primary/20 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                      <div className="relative w-20 h-20 bg-background/50 backdrop-blur-xl border border-white/10 rounded-2xl flex items-center justify-center shadow-2xl transform group-hover:scale-105 transition-all duration-500">
                          <Download className="w-8 h-8 text-primary/80" />
                      </div>
                      {/* Floating decorative icons */}
                      <div className="absolute -top-2 -right-2 w-8 h-8 bg-background/50 backdrop-blur-md border border-white/10 rounded-lg flex items-center justify-center shadow-lg animate-bounce delay-75">
                          <Sparkles className="w-4 h-4 text-yellow-500/80" />
                      </div>
                       <div className="absolute -bottom-2 -left-2 w-8 h-8 bg-background/50 backdrop-blur-md border border-white/10 rounded-lg flex items-center justify-center shadow-lg animate-bounce delay-150">
                          <Layers className="w-4 h-4 text-blue-500/80" />
                      </div>
                  </div>
          
                  <h3 className="text-2xl font-bold tracking-tight mb-2 bg-clip-text text-transparent bg-linear-to-br from-foreground to-muted-foreground">
                      Ready to Download
                  </h3>
                  <p className="text-muted-foreground text-sm mb-8 leading-relaxed">
                      Your queue is currently empty. Add a URL above to start downloading instantly.
                  </p>
          
                  {/* Quick Actions Grid */}
                  <div className="grid grid-cols-2 gap-3 w-full">
                       <div 
                         className="col-span-2 p-3 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 transition-colors cursor-pointer flex items-center gap-3 group active:scale-[0.98]" 
                         onClick={() => document.querySelector('input')?.focus()}
                       >
                          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                              <Plus className="w-4 h-4 text-primary" />
                          </div>
                          <div className="text-left">
                              <div className="text-xs font-semibold">New Download</div>
                              <div className="text-[10px] text-muted-foreground">Paste a URL to begin</div>
                          </div>
                       </div>
                       
                       <div 
                         className="p-3 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 transition-colors cursor-pointer flex items-center gap-3 group active:scale-[0.98]"
                         onClick={() => setScreen("presets")}
                       >
                          <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center group-hover:bg-purple-500/20 transition-colors">
                              <Layers className="w-4 h-4 text-purple-400" />
                          </div>
                          <div className="text-left">
                              <div className="text-xs font-semibold">Presets</div>
                              <div className="text-[10px] text-muted-foreground">Manage formats</div>
                          </div>
                       </div>

                       <div 
                         className="p-3 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 transition-colors cursor-pointer flex items-center gap-3 group active:scale-[0.98]"
                         onClick={() => setScreen("tools")}
                       >
                          <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
                              <Settings className="w-4 h-4 text-blue-400" />
                          </div>
                          <div className="text-left">
                              <div className="text-xs font-semibold">Tools</div>
                              <div className="text-[10px] text-muted-foreground">Check status</div>
                          </div>
                       </div>
                  </div>
              </motion.div>
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
                              className="h-8 px-3.5 text-xs rounded-full shadow-sm border border-primary/20 bg-primary/10 text-primary hover:bg-primary/20 gap-1.5"
                              onClick={onStartSelected}
                          >
                              <Play className="w-3.5 h-3.5" />
                              Start Selected
                          </MotionButton>
                          <MotionButton
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 px-3.5 text-xs rounded-full border border-destructive/20 bg-destructive/5 text-destructive/90 hover:bg-destructive/15 hover:text-destructive gap-1.5"
                              onClick={onRemoveSelected}
                          >
                              <X className="w-3.5 h-3.5" />
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
                  className="h-8 px-3.5 text-xs rounded-full text-muted-foreground border border-muted/60 bg-background/50 hover:text-foreground hover:border-muted transition-colors gap-1.5"
                  disabled={!hasCompleted}
                  onClick={onClearCompleted}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Clear Completed
                </MotionButton>
            </div>
            <div
              ref={scrollRef}
              onScroll={handleScroll}
              className="flex-1 overflow-auto p-4 pt-0"
            >
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
