import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { relaunch } from "@tauri-apps/plugin-process";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { MotionButton } from "@/components/motion/MotionButton";
import { Sparkles, AlertCircle, Download, CheckCircle2 } from "lucide-react";
import { useToolsStore } from "@/store/tools";
import { useLogsStore } from "@/store/logs";
import { AnimatePresence, motion } from "framer-motion";
import { ToolTransferStatus } from "@/components/tools/ToolTransferStatus";
import { ToolBatchSummary } from "@/components/tools/ToolBatchSummary";
import { getAppMode, getStartupToolIds, isStartupRequiredTool } from "@/lib/tools/app-mode";
import { getMissingAppManagedToolIds } from "@/lib/tools/local-tools";
import {
  buildToolBatchErrorMessage,
  getFailedToolResults,
  getSuccessfulToolResults,
  type ToolBatchResult,
} from "@/lib/tools/tool-batch";
import { downloadTools } from "@/lib/commands";

interface DownloadProgress {
  tool: string;
  percentage: number;
  status: string;
}

const TOOL_SIZES: Record<string, number> = {
  "yt-dlp": 16,
  ffmpeg: 140,
  aria2: 5,
  deno: 31,
};

export function UpgradePrompt() {
  const appMode = getAppMode();
  const isFullMode = appMode === "FULL";

  const [isDownloading, setIsDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [batchResult, setBatchResult] = useState<ToolBatchResult | null>(null);
  const [operationToolIds, setOperationToolIds] = useState<string[]>([]);
  const [toolProgress, setToolProgress] = useState<Record<string, number>>({});
  const [currentToolId, setCurrentToolId] = useState<string | null>(null);
  const [currentStatus, setCurrentStatus] = useState("Preparing...");
  const [startupMissingToolIds, setStartupMissingToolIds] = useState<string[] | null>(
    isFullMode ? null : []
  );
  const [dismissedMissingKey, setDismissedMissingKey] = useState<string | null>(null);

  const activeToolIdsRef = useRef<string[]>([]);
  const autoInstallStartedRef = useRef(false);
  const lastLogRef = useRef<Record<string, { status: string; bucket: number }>>({});

  const { tools } = useToolsStore();
  const { addLog } = useLogsStore();
  const fullSwitchKey = "halaldl:fullSwitchAutoInstall";

  const toolNameById = useMemo(
    () => Object.fromEntries(tools.map((tool) => [tool.id, tool.name])) as Record<string, string>,
    [tools]
  );
  const allToolsChecked = tools.length > 0 && tools.every((tool) => tool.status !== "Checking");

  useEffect(() => {
    activeToolIdsRef.current = operationToolIds;
  }, [operationToolIds]);

  useEffect(() => {
    let cancelled = false;

    if (!isFullMode) return;

    void getMissingAppManagedToolIds(getStartupToolIds(appMode)).then(
      (ids) => {
        if (!cancelled) {
          setStartupMissingToolIds(ids);
        }
      },
      () => {
        if (!cancelled) {
          setStartupMissingToolIds(getStartupToolIds(appMode));
        }
      }
    );

    return () => {
      cancelled = true;
    };
  }, [appMode, isFullMode]);

  const checkedMissingIds = useMemo(() => {
    if (!allToolsChecked) return [];

    if (isFullMode) {
      return getStartupToolIds(appMode).filter(
        (toolId) => tools.find((tool) => tool.id === toolId)?.status === "Missing"
      );
    }

    return tools
      .filter((tool) => tool.status === "Missing" && isStartupRequiredTool(tool.id, appMode))
      .map((tool) => tool.id);
  }, [allToolsChecked, appMode, isFullMode, tools]);

  const missingIds = useMemo(
    () => Array.from(new Set([...(startupMissingToolIds ?? []), ...checkedMissingIds])),
    [checkedMissingIds, startupMissingToolIds]
  );
  const missingKey = missingIds.slice().sort().join("|");
  const startupReady = isFullMode ? startupMissingToolIds !== null : allToolsChecked;
  const promptToolIds = missingIds;
  const actionToolIds = error
    ? (operationToolIds.length > 0 ? operationToolIds : promptToolIds)
    : promptToolIds;
  const modalToolIds =
    isDownloading || error
      ? (operationToolIds.length > 0 ? operationToolIds : promptToolIds)
      : promptToolIds;
  const modalOpen =
    isDownloading ||
    Boolean(error) ||
    (startupReady && promptToolIds.length > 0 && dismissedMissingKey !== missingKey);
  const modalCurrentToolName = currentToolId ? toolNameById[currentToolId] ?? currentToolId : null;
  const totalSize = modalToolIds.reduce((acc, toolId) => acc + (TOOL_SIZES[toolId] || 0), 0);

  const resetProgressState = useCallback(() => {
    setProgress(0);
    setLogs([]);
    setToolProgress({});
    setCurrentToolId(null);
    setCurrentStatus("Preparing...");
    setBatchResult(null);
    lastLogRef.current = {};
  }, []);

  const appendLog = useCallback((message: string) => {
    const trimmed = message.trim();
    if (!trimmed) return;

    setLogs((prev) => {
      if (prev[prev.length - 1] === trimmed) return prev;
      return [...prev.slice(-79), trimmed];
    });
  }, []);

  const beginProgressRun = useCallback(
    (toolIds: string[]) => {
      resetProgressState();
      setOperationToolIds(toolIds);
      setToolProgress(
        Object.fromEntries(toolIds.map((toolId) => [toolId, 0])) as Record<string, number>
      );
      setCurrentToolId(toolIds[0] ?? null);
      setCurrentStatus("Preparing...");
      appendLog(`Queued ${toolIds.length} tool${toolIds.length === 1 ? "" : "s"} for setup`);
    },
    [appendLog, resetProgressState]
  );

  const handleUpgrade = useCallback(
    async (overrideTools?: string[]) => {
      const toolsToInstall = Array.from(new Set((overrideTools ?? actionToolIds).filter(Boolean)));
      if (toolsToInstall.length === 0) {
        setDismissedMissingKey(missingKey);
        return;
      }

      setDismissedMissingKey(null);
      setError(null);
      setIsDownloading(true);
      beginProgressRun(toolsToInstall);
      addLog({
        level: "info",
        message: `Starting startup tool sync: ${toolsToInstall.join(", ")}`,
      });

      try {
        const result = await downloadTools(toolsToInstall);
        setBatchResult(result);

        const succeeded = getSuccessfulToolResults(result);
        const failed = getFailedToolResults(result);

        if (succeeded.length > 0) {
          setToolProgress((prev) => ({
            ...prev,
            ...Object.fromEntries(succeeded.map((item) => [item.tool, 100])),
          }));
        }

        if (result.allSucceeded) {
          setProgress(100);
          setCurrentStatus("Restarting...");
          appendLog("Tool sync completed");

          try {
            await invoke("add_to_user_path");
          } catch (pathError) {
            addLog({
              level: "warn",
              message: `Failed to add tools to PATH: ${String(pathError)}`,
            });
          }

          try {
            await relaunch();
          } catch (restartError) {
            const message =
              restartError instanceof Error ? restartError.message : String(restartError);
            setError(`Tools installed, but restart failed: ${message}`);
            setCurrentStatus("Restart failed");
            setIsDownloading(false);
          }
        } else {
          const message = buildToolBatchErrorMessage(result, toolNameById);
          setError(message);
          setCurrentStatus("Needs attention");
          setIsDownloading(false);
          for (const item of succeeded) {
            appendLog(`[${toolNameById[item.tool] ?? item.tool}] ${item.message}`);
          }
          for (const item of failed) {
            appendLog(`[${toolNameById[item.tool] ?? item.tool}] Failed: ${item.message}`);
          }
        }
      } catch (installError) {
        const message =
          installError instanceof Error ? installError.message : String(installError);
        setError(message);
        setCurrentStatus("Needs attention");
        setIsDownloading(false);
        addLog({
          level: "error",
          message: `Startup tool sync failed: ${message}`,
        });
      }
    },
    [actionToolIds, addLog, appendLog, beginProgressRun, missingKey, toolNameById]
  );

  useEffect(() => {
    if (!startupReady || !isFullMode || missingIds.length === 0 || autoInstallStartedRef.current) {
      return;
    }

    let timer: number | undefined;
    try {
      if (localStorage.getItem(fullSwitchKey) !== "1") return;
      autoInstallStartedRef.current = true;
      localStorage.removeItem(fullSwitchKey);
      timer = window.setTimeout(() => {
        void handleUpgrade(missingIds);
      }, 0);
    } catch {
      void 0;
    }

    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [fullSwitchKey, handleUpgrade, isFullMode, missingIds, startupReady]);

  useEffect(() => {
    let disposed = false;
    let cleanup: (() => void) | null = null;

    void listen<DownloadProgress>("download-progress", (event) => {
      if (disposed || !isDownloading) return;

      const toolId = event.payload.tool;
      const targets = activeToolIdsRef.current;
      if (targets.length > 0 && !targets.includes(toolId)) return;

      const clamped = Math.max(0, Math.min(100, event.payload.percentage));
      const status = event.payload.status?.trim() || "Working...";

      setCurrentToolId(toolId);
      setCurrentStatus(status);

      setToolProgress((prev) => {
        const next = { ...prev, [toolId]: clamped };
        const effectiveTargets = targets.length > 0 ? targets : Object.keys(next);
        const total = effectiveTargets.reduce((acc, id) => acc + (next[id] ?? 0), 0);
        setProgress(effectiveTargets.length > 0 ? total / effectiveTargets.length : clamped);
        return next;
      });

      const bucket = Math.floor(clamped / 10) * 10;
      const last = lastLogRef.current[toolId];
      if (!(last && last.status === status && last.bucket === bucket)) {
        lastLogRef.current[toolId] = { status, bucket };
        appendLog(`[${toolNameById[toolId] ?? toolId}] ${status} (${Math.round(clamped)}%)`);
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
  }, [appendLog, isDownloading, toolNameById]);

  const selectionSubtitle = isFullMode
    ? "Full mode manages its own local toolset. Missing app-managed binaries will be installed now."
    : "Lite mode only requires yt-dlp to be available before downloads can start.";

  const handleClose = (nextOpen: boolean) => {
    if (isDownloading && !nextOpen) return;
    if (!nextOpen) {
      setError(null);
      setOperationToolIds([]);
      setDismissedMissingKey(missingKey);
      return;
    }
  };

  return (
    <Dialog open={modalOpen} onOpenChange={handleClose}>
      <DialogContent
        className="sm:max-w-[480px] border-none bg-transparent p-0 shadow-2xl overflow-hidden"
        onInteractOutside={(event) => {
          if (isDownloading) event.preventDefault();
        }}
        onEscapeKeyDown={(event) => {
          if (isDownloading) event.preventDefault();
        }}
      >
        <div className="relative overflow-hidden rounded-xl border border-white/10 bg-background/90 backdrop-blur-2xl">
          <div className="absolute left-0 right-0 top-0 h-1 bg-linear-to-r from-primary via-purple-500 to-primary animate-gradient-x" />

          <div className="p-6 pb-3">
            <DialogHeader className="mb-4">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="absolute inset-0 rounded-full bg-primary/20 blur-lg animate-pulse" />
                  <div className="relative rounded-xl border border-primary/20 bg-primary/10 p-2.5">
                    <Sparkles className="h-5 w-5 text-primary" />
                  </div>
                </div>
                <div>
                  <DialogTitle className="text-lg font-bold tracking-tight">
                    {isDownloading ? "Setting Up Tools" : isFullMode ? "Full Mode Setup" : "Setup Required"}
                  </DialogTitle>
                  <p className="mt-0.5 text-xs font-medium text-muted-foreground">
                    {isDownloading ? "Installing your local tool bundle..." : selectionSubtitle}
                  </p>
                </div>
              </div>
            </DialogHeader>

            <AnimatePresence mode="wait">
              {isDownloading ? (
                <motion.div
                  key="progress"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  <ToolTransferStatus
                    progress={progress}
                    currentToolName={modalCurrentToolName}
                    currentStatus={currentStatus}
                    orderedToolIds={modalToolIds}
                    toolProgress={toolProgress}
                    toolNameById={toolNameById}
                    logs={logs}
                    emptyLabel="Waiting for tool download events..."
                  />
                </motion.div>
              ) : error ? (
                <motion.div
                  key="error"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-4 rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive"
                >
                  <div className="flex items-start gap-3">
                    <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                    <div className="space-y-2">
                      <p>{error}</p>
                      <p className="text-xs text-destructive/80">
                        Retry when ready. The setup modal will stay single-run; it will not spawn extra success dialogs after restart.
                      </p>
                    </div>
                  </div>
                  {batchResult && (
                    <ToolBatchSummary result={batchResult} toolNameById={toolNameById} />
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key="selection"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4"
                >
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                          Pending Tools
                        </div>
                        <div className="mt-1 text-sm font-medium">
                          {promptToolIds.length} tool{promptToolIds.length === 1 ? "" : "s"} need local setup
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                          Download Size
                        </div>
                        <div className="mt-1 text-xl font-semibold tabular-nums">{totalSize}MB</div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-2">
                    {tools.map((tool) => {
                      const isSelected = promptToolIds.includes(tool.id);
                      return (
                        <div
                          key={tool.id}
                          className={`rounded-xl border p-3 transition-colors ${
                            isSelected
                              ? "border-primary/20 bg-primary/5 shadow-[0_0_10px_rgba(var(--primary),0.06)]"
                              : "border-white/8 bg-muted/15 opacity-60"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2 text-sm font-semibold">
                                {tool.name}
                                {!isSelected && <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />}
                              </div>
                              <div className="mt-1 text-[11px] text-muted-foreground">
                                {TOOL_SIZES[tool.id]}MB · {isSelected ? "Queued for app-managed install" : tool.version || "Already available"}
                              </div>
                            </div>
                            <div
                              className={`h-2.5 w-2.5 rounded-full ${
                                isSelected
                                  ? "bg-primary shadow-[0_0_8px_rgba(var(--primary),0.8)]"
                                  : "bg-green-500"
                              }`}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <DialogFooter className="gap-2 bg-muted/5 p-6 pt-2">
            {!isDownloading && (
              <>
                <MotionButton
                  type="button"
                  variant="ghost"
                  onClick={() => handleClose(false)}
                  className="h-11 flex-1 rounded-xl text-muted-foreground hover:text-foreground"
                >
                  Close
                </MotionButton>
                <MotionButton
                  type="button"
                  onClick={() => void handleUpgrade()}
                  disabled={actionToolIds.length === 0 || !startupReady}
                  className="h-11 flex-1 gap-2 rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90"
                >
                  <Download className="h-4 w-4" />
                  {error ? "Retry Install" : `Install (${totalSize}MB)`}
                </MotionButton>
              </>
            )}
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
