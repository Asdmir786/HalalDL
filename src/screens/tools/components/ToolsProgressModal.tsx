import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { MotionButton } from "@/components/motion/MotionButton";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ToolTransferStatus } from "@/components/tools/ToolTransferStatus";
import { ToolBatchSummary } from "@/components/tools/ToolBatchSummary";
import type { ToolBatchResult } from "@/lib/tools/tool-batch";

export interface ToolsProgressModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isDownloading: boolean;
  modalTitle: string;
  modalDone: boolean;
  modalError: string | null;
  modalBatchResult: ToolBatchResult | null;
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
  modalBatchResult,
  modalCurrentToolName,
  modalCurrentStatus,
  modalProgress,
  modalToolProgress,
  orderedModalToolIds,
  toolNameById,
  modalLogs,
  onDismiss,
}: ToolsProgressModalProps) {
  const showFooter = modalDone || Boolean(modalError);

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
          className="w-[calc(100%-1rem)] max-w-[560px] border-none bg-transparent p-0 shadow-2xl overflow-hidden"
          onInteractOutside={() => {
            void 0;
          }}
          onEscapeKeyDown={() => {
            void 0;
          }}
        >
          <div className="relative flex max-h-[min(720px,calc(100vh-1rem))] min-h-0 flex-col overflow-hidden rounded-xl border border-white/10 bg-background/90 backdrop-blur-2xl">
            <div className="absolute top-0 left-0 right-0 h-1 bg-linear-to-r from-primary via-purple-500 to-primary animate-gradient-x" />

            <div className="min-h-0 flex-1 overflow-y-auto p-4 pb-3 sm:p-6">
              <DialogHeader className="mb-4">
                <div className="flex items-start gap-3">
                  <div className="relative shrink-0">
                    <div className="absolute inset-0 bg-primary/20 blur-lg rounded-full animate-pulse" />
                    <div className="relative p-2.5 bg-primary/10 rounded-xl border border-primary/20">
                      <Sparkles className="w-5 h-5 text-primary" />
                    </div>
                  </div>
                  <div className="min-w-0">
                    <DialogTitle className="text-lg font-bold tracking-tight">
                      {modalTitle}
                    </DialogTitle>
                    <p className="mt-0.5 text-xs font-medium text-muted-foreground">
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
                    className="space-y-4"
                  >
                    <div className="flex items-start gap-3 rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
                      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                      <p>{modalError}</p>
                    </div>
                    {modalBatchResult && (
                      <ToolBatchSummary result={modalBatchResult} toolNameById={toolNameById} />
                    )}
                  </motion.div>
                ) : (
                  <motion.div
                    key="progress"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="min-h-0"
                  >
                    <ToolTransferStatus
                      progress={modalProgress}
                      currentToolName={modalCurrentToolName}
                      currentStatus={modalCurrentStatus}
                      orderedToolIds={orderedModalToolIds}
                      toolProgress={modalToolProgress}
                      toolNameById={toolNameById}
                      logs={modalLogs}
                      emptyLabel="Initializing transfer..."
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {showFooter && (
              <DialogFooter className="gap-2 bg-muted/5 p-4 pt-2 sm:flex-row sm:p-6 sm:pt-2">
                {modalDone && (
                  <div className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-green-500/20 bg-green-600/10 text-sm font-medium text-green-400">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Restarting...
                  </div>
                )}
                {modalError && (
                  <MotionButton
                    type="button"
                    variant="outline"
                    onClick={onDismiss}
                    className="h-11 w-full rounded-xl"
                  >
                    Dismiss
                  </MotionButton>
                )}
              </DialogFooter>
            )}
          </div>
        </DialogContent>
    </Dialog>
  );
}
