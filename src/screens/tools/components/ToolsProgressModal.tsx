import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { MotionButton } from "@/components/motion/MotionButton";
import { AnimatePresence, motion } from "framer-motion";
import {
  Sparkles,
  AlertCircle,
  Terminal,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

export interface ToolsProgressModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isDownloading: boolean;
  modalTitle: string;
  modalDone: boolean;
  modalError: string | null;
  modalCurrentToolName: string | null;
  modalCurrentStatus: string;
  modalProgress: number;
  modalToolProgress: Record<string, number>;
  orderedModalToolIds: string[];
  toolNameById: Record<string, string>;
  modalLogs: string[];
  onDismiss: () => void;
}

export function ToolsProgressModal({
  open,
  onOpenChange,
  isDownloading,
  modalTitle,
  modalDone,
  modalError,
  modalCurrentToolName,
  modalCurrentStatus,
  modalProgress,
  modalToolProgress,
  orderedModalToolIds,
  toolNameById,
  modalLogs,
  onDismiss,
}: ToolsProgressModalProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(val) => {
        if (!val) {
          if (isDownloading) {
            onOpenChange(false);
            toast.info("Update is still running in background.");
            return;
          }
          onDismiss();
          return;
        }
        onOpenChange(true);
      }}
    >
      <DialogContent
        className="sm:max-w-[440px] border-none bg-transparent shadow-2xl p-0 overflow-hidden"
        onInteractOutside={() => {
          void 0;
        }}
        onEscapeKeyDown={() => {
          void 0;
        }}
      >
        <div className="relative bg-background/90 backdrop-blur-2xl border border-white/10 rounded-xl overflow-hidden">
          {/* Gradient top accent */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-linear-to-r from-primary via-purple-500 to-primary animate-gradient-x" />

          <div className="p-6 pb-2">
            <DialogHeader className="mb-4">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="absolute inset-0 bg-primary/20 blur-lg rounded-full animate-pulse" />
                  <div className="relative p-2.5 bg-primary/10 rounded-xl border border-primary/20">
                    <Sparkles className="w-5 h-5 text-primary" />
                  </div>
                </div>
                <div>
                  <DialogTitle className="text-lg font-bold tracking-tight">
                    {modalTitle}
                  </DialogTitle>
                  <p className="text-xs text-muted-foreground font-medium mt-0.5">
                    {modalDone
                      ? "Download complete — restart to apply"
                      : modalError
                        ? "Something went wrong"
                        : modalCurrentToolName
                          ? `${modalCurrentToolName}: ${modalCurrentStatus}`
                          : "Preparing transfer..."}
                  </p>
                </div>
              </div>
            </DialogHeader>

            <AnimatePresence mode="wait">
              {modalError ? (
                <motion.div
                  key="error"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-start gap-3 p-4 rounded-xl bg-destructive/5 border border-destructive/20 text-destructive text-sm"
                >
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  <p>{modalError}</p>
                </motion.div>
              ) : (
                <motion.div
                  key="progress"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-6 py-2"
                >
                  {/* Progress bar */}
                  <div className="relative pt-2">
                    <div className="flex justify-between items-end mb-2">
                      <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
                        Progress
                      </span>
                      <span className="text-2xl font-bold tabular-nums tracking-tight">
                        {Math.round(modalProgress)}%
                      </span>
                    </div>
                    <Progress
                      value={modalProgress}
                      className="h-1.5 bg-muted/50"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="rounded-lg border border-white/10 bg-muted/20 px-3 py-2">
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        Current Tool
                      </div>
                      <div className="truncate font-medium text-foreground/90">
                        {modalCurrentToolName || "Waiting..."}
                      </div>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-muted/20 px-3 py-2">
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        Stage
                      </div>
                      <div className="truncate font-medium text-foreground/90">
                        {modalCurrentStatus}
                      </div>
                    </div>
                  </div>

                  {orderedModalToolIds.length > 1 && (
                    <div className="rounded-lg border border-white/10 bg-muted/15 p-3 space-y-2">
                      {orderedModalToolIds.map((toolId) => {
                        const pct = Math.round(modalToolProgress[toolId] ?? 0);
                        return (
                          <div key={toolId} className="space-y-1">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="text-foreground/85">
                                {toolNameById[toolId] ?? toolId}
                              </span>
                              <span className="font-mono text-muted-foreground">
                                {pct}%
                              </span>
                            </div>
                            <Progress value={pct} className="h-1 bg-muted/50" />
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Log output */}
                  <div className="bg-black/40 rounded-lg border border-white/5 p-4 font-mono text-[10px] space-y-2 h-[120px] overflow-hidden relative">
                    <div className="absolute top-2 right-2 opacity-50">
                      <Terminal className="w-3 h-3" />
                    </div>
                    <div className="space-y-1.5 opacity-80">
                      {modalLogs.slice(-4).map((log, i) => (
                        <motion.div
                          key={`${log}-${i}`}
                          initial={{ opacity: 0, x: -5 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="flex gap-2 items-center"
                        >
                          <ChevronRight className="w-2.5 h-2.5 text-primary shrink-0" />
                          <span className="truncate">{log}</span>
                        </motion.div>
                      ))}
                      {modalLogs.length === 0 && (
                        <span className="text-muted-foreground italic">
                          Initializing download...
                        </span>
                      )}
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 h-8 bg-linear-to-t from-black/40 to-transparent" />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <DialogFooter className="p-6 pt-2 flex-col sm:flex-row gap-2 bg-muted/5">
            {modalDone && (
              <div className="w-full flex items-center justify-center gap-2 h-12 rounded-xl bg-green-600/10 border border-green-500/20 text-green-400 text-sm font-medium">
                <Loader2 className="w-4 h-4 animate-spin" />
                Restarting...
              </div>
            )}
            {modalError && (
              <MotionButton
                type="button"
                variant="outline"
                onClick={onDismiss}
                className="w-full h-11 rounded-xl"
              >
                Dismiss
              </MotionButton>
            )}
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
