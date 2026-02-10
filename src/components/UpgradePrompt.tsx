import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { relaunch } from "@tauri-apps/plugin-process";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import { MotionButton } from "@/components/motion/MotionButton";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Download, CheckCircle2, AlertCircle, Terminal, Sparkles, ChevronRight, Loader2 } from "lucide-react";
import { useToolsStore } from "@/store/tools";
import { useLogsStore } from "@/store/logs";
import { AnimatePresence, motion } from "framer-motion";

interface DownloadProgress {
  tool: string;
  percentage: number;
  status: string;
}

const TOOL_SIZES: Record<string, number> = {
  "yt-dlp": 16,
  "ffmpeg": 35,
  "aria2": 5,
  "deno": 31
};

import { 
  checkYtDlpVersion, 
  checkFfmpegVersion, 
  checkAria2Version, 
  checkDenoVersion 
} from "@/lib/commands";

export function UpgradePrompt() {
  const [open, setOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadComplete, setDownloadComplete] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [hasShownFullReadyPrompt, setHasShownFullReadyPrompt] = useState(false);
  
  // Track which tools are selected for download
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  
  const { tools, updateTool } = useToolsStore();
  const { addLog } = useLogsStore();
  const isFullMode = import.meta.env.VITE_APP_MODE === 'FULL';
  
  const missingTools = tools.filter((t) => t.status === "Missing");
  const hasMissingRequired = missingTools.some((t) => t.required);
  const allToolsChecked = tools.length > 0 && tools.every((t) => t.status !== "Checking");
  const hasMissingForMode = isFullMode ? missingTools.length > 0 : hasMissingRequired;
  const isMandatory = hasMissingForMode;
  const showFullModeReadyState =
    isFullMode &&
    allToolsChecked &&
    !hasMissingForMode &&
    !isDownloading &&
    !downloadComplete &&
    !error;

  const totalSize = selectedTools.reduce((acc, id) => acc + (TOOL_SIZES[id] || 0), 0);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      const timer = setTimeout(() => {
        setIsDownloading(false);
        setDownloadComplete(false);
        setProgress(0);
        setLogs([]);
        setError(null);
      }, 300); // Wait for exit animation
      return () => clearTimeout(timer);
    }
  }, [open]);

  useEffect(() => {
    if (!allToolsChecked) return;

    if (missingTools.length > 0) {
       const timer = setTimeout(() => {
         const missingIds = missingTools.map((t) => t.id);
         setSelectedTools((prev) => {
           if (prev.length === 0) return missingIds;
           // Keep previous user picks only if still missing; add any newly-missing required tools.
           const stillMissing = prev.filter((id) => missingIds.includes(id));
           const requiredMissing = missingTools.filter((t) => t.required).map((t) => t.id);
           return Array.from(new Set([...stillMissing, ...requiredMissing]));
         });
         setOpen(true);
       }, 2500);
       return () => clearTimeout(timer);
    }

    if (isFullMode && !hasShownFullReadyPrompt) {
      const timer = setTimeout(() => {
        setSelectedTools([]);
        setOpen(true);
        setHasShownFullReadyPrompt(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [allToolsChecked, hasShownFullReadyPrompt, isFullMode, missingTools]);

  useEffect(() => {
    let disposed = false;
    let cleanup: (() => void) | null = null;

    void listen<DownloadProgress>("download-progress", (event) => {
      if (disposed) return;
      setProgress(event.payload.percentage);
      
      if (event.payload.status && event.payload.status !== "Downloading...") {
        setLogs(prev => {
          const newLog = `[${event.payload.tool}] ${event.payload.status}`;
          if (prev[prev.length - 1] === newLog) return prev;
          return [...prev, newLog];
        });
        addLog({
          level: "info",
          message: `[${event.payload.tool}] ${event.payload.status}`,
        });
      }
    }).then((fn) => {
      if (disposed) {
        fn();
      } else {
        cleanup = fn;
      }
    });

    return () => {
      disposed = true;
      if (cleanup) cleanup();
    };
  }, [addLog]);

  const handleFinish = async () => {
    setIsFinishing(true);
    try {
      const checkTool = async (id: string, checkFn: () => Promise<string | null>) => {
        const version = await checkFn();
        if (version) {
          updateTool(id, { status: "Detected", version });
          return true;
        }
        return false;
      };

      const results = await Promise.all([
        checkTool("yt-dlp", checkYtDlpVersion),
        checkTool("ffmpeg", checkFfmpegVersion),
        checkTool("aria2", checkAria2Version),
        checkTool("deno", checkDenoVersion),
      ]);
      try {
        await invoke("add_to_user_path");
      } catch (error) {
        addLog({ level: "warn", message: `Failed to add to PATH: ${String(error)}` });
      }
      if (results.some(Boolean)) {
        try {
          localStorage.setItem("halaldl:pendingToolCongrats", JSON.stringify(selectedTools));
        } catch (e) {
          addLog({ level: "warn", message: `Failed to persist pending tool congrats: ${String(e)}` });
        }
      }
      setOpen(false);
      await relaunch();
    } catch (error) {
      addLog({ level: "error", message: `Failed to finish setup: ${String(error)}` });
      window.location.reload();
    } finally {
      setIsFinishing(false);
    }
  };

  const handleUpgrade = async () => {
    if (selectedTools.length === 0) {
      if (!isMandatory) {
        setOpen(false);
      }
      return;
    }

    setIsDownloading(true);
    setDownloadComplete(false);
    setError(null);
    try {
      await invoke("download_tools", { tools: selectedTools });
      setProgress(100);
      setDownloadComplete(true);
      addLog({
        level: "info",
        message: "All selected tools downloaded and ready",
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : String(error);
      setError(message);
      setIsDownloading(false);
      setDownloadComplete(false);
      addLog({
        level: "error",
        message: `Tool download failed: ${message}`,
      });
    }
  };

  const handleStartNow = () => {
    setOpen(false);
  };

  const toggleTool = (id: string) => {
    const tool = tools.find((t) => t.id === id);
    if (tool?.required && tool.status === "Missing") return;

    setSelectedTools(prev =>
      prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
    );
  };

  return (
    <Dialog 
      open={open} 
      onOpenChange={(val) => {
        // Prevent closing if mandatory or downloading
        if ((isMandatory || isDownloading) && !val) return;
        setOpen(val);
      }}
    >
      <DialogContent 
        className="sm:max-w-[440px] border-none bg-transparent shadow-2xl p-0 overflow-hidden" 
        onInteractOutside={(e) => {
          if (isMandatory || isDownloading) e.preventDefault();
        }} 
        onEscapeKeyDown={(e) => {
          if (isMandatory || isDownloading) e.preventDefault();
        }}
      >
        <div className="relative bg-background/90 backdrop-blur-2xl border border-white/10 rounded-xl overflow-hidden">
          {/* Animated Gradient Border Top */}
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
                    {isDownloading ? "Installing Components" : showFullModeReadyState ? "Setup Complete" : "Setup Required"}
                  </DialogTitle>
                  <p className="text-xs text-muted-foreground font-medium mt-0.5">
                    {isDownloading
                      ? "Optimizing your environment..."
                      : showFullModeReadyState
                        ? "All required tools are already available"
                        : "Missing dependencies detected"}
                  </p>
                </div>
              </div>
            </DialogHeader>

            <AnimatePresence mode="wait">
              {isDownloading ? (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-6 py-2"
                >
                  <div className="relative pt-2">
                     <div className="flex justify-between items-end mb-2">
                        <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Progress</span>
                        <span className="text-2xl font-bold tabular-nums tracking-tight">{Math.round(progress)}%</span>
                     </div>
                     <Progress value={progress} className="h-1.5 bg-muted/50" />
                  </div>

                  <div className="bg-black/40 rounded-lg border border-white/5 p-4 font-mono text-[10px] space-y-2 h-[120px] overflow-hidden relative">
                    <div className="absolute top-2 right-2 opacity-50">
                      <Terminal className="w-3 h-3" />
                    </div>
                    <div className="space-y-1.5 opacity-80">
                      {logs.slice(-4).map((log, i) => (
                        <motion.div 
                          key={i}
                          initial={{ opacity: 0, x: -5 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="flex gap-2 items-center"
                        >
                          <ChevronRight className="w-2.5 h-2.5 text-primary shrink-0" />
                          <span className="truncate">{log}</span>
                        </motion.div>
                      ))}
                      {logs.length === 0 && (
                        <span className="text-muted-foreground italic">Initializing downloader...</span>
                      )}
                    </div>
                    {/* Fade out bottom */}
                    <div className="absolute bottom-0 left-0 right-0 h-8 bg-linear-to-t from-black/40 to-transparent" />
                  </div>
                </motion.div>
              ) : error ? (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-start gap-3 p-4 rounded-xl bg-destructive/5 border border-destructive/20 text-destructive text-sm"
                >
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <p>{error}</p>
                </motion.div>
              ) : (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-4"
                >
                  {showFullModeReadyState ? (
                    <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-4">
                      <div className="mb-3 flex items-center gap-2 text-green-400">
                        <CheckCircle2 className="h-4 w-4" />
                        <span className="text-sm font-semibold">All components are already installed</span>
                      </div>
                      <p className="mb-3 text-xs text-muted-foreground">
                        No downloads are needed. You can start using the app immediately.
                      </p>
                      <div className="grid grid-cols-1 gap-2">
                        {tools.map((tool) => (
                          <div
                            key={tool.id}
                            className="flex items-center justify-between rounded-lg border border-white/10 bg-muted/20 px-3 py-2 text-xs"
                          >
                            <span className="font-medium">{tool.name}</span>
                            <span className="text-muted-foreground">{tool.version || "Detected"}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-2">
                      {tools.map(tool => {
                        const isMissing = tool.status === "Missing";
                        const isSelected = selectedTools.includes(tool.id);
                        const isRequiredMissing = isMissing && tool.required;
                        
                        return (
                          <div 
                            key={tool.id} 
                            className={`group flex items-center justify-between p-3 rounded-xl border transition-all duration-300 ${
                              isSelected 
                                ? "bg-primary/5 border-primary/20 shadow-[0_0_10px_rgba(var(--primary),0.05)]" 
                                : "bg-muted/20 border-white/5 opacity-60"
                            } ${
                              !isMissing
                                ? "opacity-50 pointer-events-none grayscale"
                                : isRequiredMissing
                                  ? "cursor-not-allowed"
                                  : "cursor-pointer hover:bg-muted/40"
                            }`}
                            onClick={() => isMissing && !isRequiredMissing && toggleTool(tool.id)}
                          >
                            <div className="flex items-center gap-3">
                              <Checkbox 
                                checked={!isMissing ? true : isSelected}
                                disabled={isRequiredMissing}
                                className="border-white/20 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                              />
                              <div className="flex flex-col">
                                <span className="font-semibold text-sm flex items-center gap-2">
                                  {tool.name}
                                  {!isMissing && <CheckCircle2 className="w-3 h-3 text-green-500" />}
                                </span>
                                <span className="text-[10px] text-muted-foreground">
                                  {TOOL_SIZES[tool.id]}MB • {tool.id === "yt-dlp" ? "Core" : "Extension"}
                                </span>
                              </div>
                            </div>
                            
                            {isMissing && (
                               <div className={`w-2 h-2 rounded-full ${isSelected ? "bg-primary shadow-[0_0_8px_rgba(var(--primary),0.8)]" : "bg-muted-foreground/30"}`} />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <DialogFooter className="p-6 pt-2 flex-col sm:flex-row gap-2 bg-muted/5">
            {!isDownloading && (
              <>
                {!isMandatory && (
                  <MotionButton type="button" variant="ghost" onClick={() => setOpen(false)} className="flex-1 h-11 rounded-xl text-muted-foreground hover:text-foreground">
                    Skip
                  </MotionButton>
                )}
                {showFullModeReadyState ? (
                  <MotionButton
                    type="button"
                    onClick={handleStartNow}
                    className="flex-1 gap-2 h-11 rounded-xl bg-green-600 text-white hover:bg-green-700 shadow-lg shadow-green-500/20"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Start Now
                  </MotionButton>
                ) : (
                  <MotionButton 
                    type="button" 
                    onClick={handleUpgrade} 
                    disabled={selectedTools.length === 0} 
                    className="flex-1 gap-2 h-11 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20"
                  >
                    <Download className="w-4 h-4" />
                    Install ({totalSize}MB)
                  </MotionButton>
                )}
              </>
            )}
            {isDownloading && downloadComplete && (
              <MotionButton 
                type="button" 
                onClick={handleFinish} 
                disabled={isFinishing}
                className="w-full gap-2 h-12 rounded-xl bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-500/20"
              >
                {isFinishing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                {isFinishing ? "Finalizing Setup..." : "Complete Setup"}
              </MotionButton>
            )}
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
