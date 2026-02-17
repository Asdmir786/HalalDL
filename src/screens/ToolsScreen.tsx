import { useToolsStore, NIGHTLY_CAPABLE_TOOLS, type Tool, type ToolChannel } from "@/store/tools";
import { MotionButton } from "@/components/motion/MotionButton";
import { FadeInStagger, FadeInItem } from "@/components/motion/StaggerContainer";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import {
  CheckCircle2,
  RefreshCcw,
  ExternalLink,
  FolderOpen,
  Wrench,
  Loader2,
  MoreHorizontal,
  Download,
  ArrowRight,
  Search,
  Info,
  RotateCcw,
  Terminal,
  ChevronRight,
  Sparkles,
  AlertCircle,
  Undo2,
  Trash2,
  MapPin,
  Moon,
  Sun,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { open as openUrl } from "@tauri-apps/plugin-shell";
import { listen } from "@tauri-apps/api/event";
import { relaunch } from "@tauri-apps/plugin-process";
import {
  downloadTools,
  fetchLatestAria2Version,
  fetchLatestDenoVersion,
  fetchLatestFfmpegVersion,
  fetchLatestYtDlpVersion,
  isUpdateAvailable,
  pickFile,
  checkYtDlpVersion,
  checkFfmpegVersion,
  checkAria2Version,
  checkDenoVersion,
  stageManualTool,
  revealToolInExplorer,
  upgradeYtDlpViaPip,
  listToolBackups,
  rollbackTool,
  cleanupToolBackup,
  cleanupAllBackups,
  updateToolAtPath,
  type ToolCheckResult,
} from "@/lib/commands";
import { toast } from "sonner";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type UIEvent,
} from "react";
import { useLogsStore } from "@/store/logs";
import { AnimatePresence, motion } from "framer-motion";

/* ── Constants ── */

const TOOL_URLS: Record<string, string> = {
  "yt-dlp": "https://github.com/yt-dlp/yt-dlp",
  ffmpeg: "https://ffmpeg.org/",
  aria2: "https://aria2.github.io/",
  deno: "https://deno.land/",
};

const TOOL_DESCRIPTIONS: Record<string, string> = {
  "yt-dlp": "Core media downloader engine",
  ffmpeg: "Audio & video processing",
  aria2: "Multi-connection downloads",
  deno: "JavaScript runtime for challenges",
};

function getLatestTrackForTool(toolId: string, channel: ToolChannel): ToolChannel | "stable" {
  return (NIGHTLY_CAPABLE_TOOLS as readonly string[]).includes(toolId)
    ? channel
    : "stable";
}

function getLatestSourceForTool(toolId: string, track: ToolChannel | "stable"): string {
  switch (toolId) {
    case "yt-dlp":
      return track === "nightly"
        ? "https://api.github.com/repos/yt-dlp/yt-dlp-nightly-builds/releases/latest"
        : "https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest";
    case "ffmpeg":
      return track === "nightly"
        ? "https://www.gyan.dev/ffmpeg/builds/git-version"
        : "https://www.gyan.dev/ffmpeg/builds/release-version";
    case "aria2":
      return "https://api.github.com/repos/aria2/aria2/releases/latest";
    case "deno":
      return "https://dl.deno.land/release-latest.txt";
    default:
      return "unknown source";
  }
}

interface DownloadProgress {
  tool: string;
  percentage: number;
  status: string;
}

/* ── Component ── */

export function ToolsScreen() {
  const { tools, updateTool } = useToolsStore();
  const addLog = useLogsStore((state) => state.addLog);
  const isLite = import.meta.env.VITE_APP_MODE !== "FULL";
  const [busyTools, setBusyTools] = useState<Record<string, boolean>>({});
  const [isCheckingAll, setIsCheckingAll] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollTopRef = useRef(0);

  /* ── Progress modal state ── */
  const [modalOpen, setModalOpen] = useState(false);
  const [modalProgress, setModalProgress] = useState(0);
  const [modalLogs, setModalLogs] = useState<string[]>([]);
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalDone, setModalDone] = useState(false);
  const [modalTitle, setModalTitle] = useState("Updating Tools");
  const [isTransferRunning, setIsTransferRunning] = useState(false);
  const [modalTargetToolIds, setModalTargetToolIds] = useState<string[]>([]);
  const [modalToolProgress, setModalToolProgress] = useState<Record<string, number>>({});
  const [modalCurrentToolId, setModalCurrentToolId] = useState<string | null>(null);
  const [modalCurrentStatus, setModalCurrentStatus] = useState("Preparing...");
  const isTransferActive = isTransferRunning && !modalDone && !modalError;
  const transferLockRef = useRef(false);
  const modalTargetToolIdsRef = useRef<string[]>([]);
  const modalLastLogRef = useRef<Record<string, { status: string; bucket: number }>>({});
  const modalClosedNoticeRef = useRef<{ done: boolean; error: string | null }>({
    done: false,
    error: null,
  });

  const toolNameById = useMemo(
    () => Object.fromEntries(tools.map((t) => [t.id, t.name])) as Record<string, string>,
    [tools]
  );

  useEffect(() => {
    modalTargetToolIdsRef.current = modalTargetToolIds;
  }, [modalTargetToolIds]);

  useEffect(() => {
    if (transferLockRef.current && (modalDone || Boolean(modalError))) {
      transferLockRef.current = false;
    }
    if (isTransferRunning && (modalDone || Boolean(modalError))) {
      setIsTransferRunning(false);
    }
  }, [isTransferRunning, modalDone, modalError]);

  useEffect(() => {
    if (modalOpen) {
      modalClosedNoticeRef.current = { done: false, error: null };
      return;
    }

    if (modalError && modalClosedNoticeRef.current.error !== modalError) {
      toast.error(`Background update failed: ${modalError}`);
      modalClosedNoticeRef.current.error = modalError;
    }
  }, [modalOpen, modalError]);

  const resetModal = useCallback(() => {
    setModalProgress(0);
    setModalLogs([]);
    setModalError(null);
    setModalDone(false);
    setModalTargetToolIds([]);
    setModalToolProgress({});
    setModalCurrentToolId(null);
    setModalCurrentStatus("Preparing...");
    modalLastLogRef.current = {};
  }, []);

  const pushModalLog = useCallback((message: string) => {
    const trimmed = message.trim();
    if (!trimmed) return;
    setModalLogs((prev) => {
      if (prev[prev.length - 1] === trimmed) return prev;
      return [...prev.slice(-79), trimmed];
    });
  }, []);

  const beginTransferModal = useCallback(
    (title: string, toolIds: string[], initialLogs: string[] = []): boolean => {
      if (transferLockRef.current) return false;
      transferLockRef.current = true;
      resetModal();
      setModalTitle(title);
      setModalTargetToolIds(toolIds);
      setModalToolProgress(
        Object.fromEntries(toolIds.map((id) => [id, 0])) as Record<string, number>
      );
      setModalCurrentToolId(toolIds[0] ?? null);
      setModalCurrentStatus("Preparing...");
      setModalLogs(initialLogs);
      setIsTransferRunning(true);
      setModalOpen(true);
      return true;
    },
    [resetModal]
  );

  /* ── Listen to download-progress events ── */
  useEffect(() => {
    let disposed = false;
    let cleanup: (() => void) | null = null;

    void listen<DownloadProgress>("download-progress", (event) => {
      if (disposed) return;
      const toolId = event.payload.tool;
      const targets = modalTargetToolIdsRef.current;
      if (targets.length > 0 && !targets.includes(toolId)) return;

      const clamped = Math.max(0, Math.min(100, event.payload.percentage));
      const status = event.payload.status?.trim() || "Working...";

      setModalCurrentToolId(toolId);
      setModalCurrentStatus(status);

      setModalToolProgress((prev) => {
        const next = { ...prev, [toolId]: clamped };
        const effectiveTargets =
          targets.length > 0 ? targets : Object.keys(next);
        if (effectiveTargets.length > 0) {
          const total = effectiveTargets.reduce(
            (acc, id) => acc + (next[id] ?? 0),
            0
          );
          setModalProgress(total / effectiveTargets.length);
        } else {
          setModalProgress(clamped);
        }
        return next;
      });

      const bucket = Math.floor(clamped / 10) * 10;
      const last = modalLastLogRef.current[toolId];
      if (!(last && last.status === status && last.bucket === bucket)) {
        modalLastLogRef.current[toolId] = { status, bucket };
        pushModalLog(
          `[${toolNameById[toolId] ?? toolId}] ${status} (${Math.round(clamped)}%)`
        );
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
  }, [pushModalLog, toolNameById]);

  /* ── Scroll preservation ── */
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = scrollTopRef.current;
  });

  const handleScroll = (event: UIEvent<HTMLDivElement>) => {
    scrollTopRef.current = event.currentTarget.scrollTop;
  };

  /* ── Per-tool: detect installed + check latest in one go ── */
  const refreshTool = async (id: string) => {
    setBusyTools((prev) => ({ ...prev, [id]: true }));
    updateTool(id, { status: "Checking" });
    try {
      let result: ToolCheckResult | null = null;
      switch (id) {
        case "yt-dlp":
          result = await checkYtDlpVersion();
          break;
        case "ffmpeg":
          result = await checkFfmpegVersion();
          break;
        case "aria2":
          result = await checkAria2Version();
          break;
        case "deno":
          result = await checkDenoVersion();
          break;
      }
      updateTool(id, {
        status: result ? "Detected" : "Missing",
        version: result?.version,
        variant: result?.variant,
        systemPath: result?.systemPath,
      });

      const toolChannel = useToolsStore.getState().tools.find((t) => t.id === id)?.channel ?? "stable";
      const latestTrack = getLatestTrackForTool(id, toolChannel);
      const latestSource = getLatestSourceForTool(id, latestTrack);
      addLog({
        level: "debug",
        message: `Checking latest ${id} on ${latestTrack} track via ${latestSource}`,
      });
      let latest: string | null = null;
      switch (id) {
        case "yt-dlp":
          latest = await fetchLatestYtDlpVersion(toolChannel);
          break;
        case "ffmpeg":
          latest = await fetchLatestFfmpegVersion(toolChannel);
          break;
        case "aria2":
          latest = await fetchLatestAria2Version();
          break;
        case "deno":
          latest = await fetchLatestDenoVersion();
          break;
      }
      const current = useToolsStore.getState().tools.find((t) => t.id === id);
      updateTool(id, {
        latestVersion: latest || undefined,
        updateAvailable: isUpdateAvailable(
          current?.version,
          latest || undefined
        ),
        latestCheckedAt: Date.now(),
      });
      addLog({
        level: "info",
        message: `Latest ${id} (${latestTrack}) is ${latest ?? "unknown"} [${latestSource}]`,
      });
    } catch (e) {
      addLog({
        level: "error",
        message: `Refresh failed (${id}): ${e instanceof Error ? e.message : String(e)}`,
      });
      updateTool(id, { status: "Missing" });
      toast.error(`Error refreshing ${id}`);
    } finally {
      setBusyTools((prev) => ({ ...prev, [id]: false }));
    }
  };

  const checkAll = async () => {
    setIsCheckingAll(true);
    try {
      await Promise.all(tools.map((t) => refreshTool(t.id)));
    } finally {
      setIsCheckingAll(false);
    }
  };

  /* ── Install / Update (with progress modal) ── */
  const installOrUpdate = async (tool: Tool) => {
    if (transferLockRef.current) {
      toast.info("Wait for the current download to finish.");
      return;
    }

    if (!beginTransferModal(
      tool.status === "Missing"
        ? `Installing ${tool.name}`
        : `Updating ${tool.name}`,
      [tool.id],
      [`Queued ${tool.name} (${tool.channel})`]
    )) {
      toast.info("Wait for the current download to finish.");
      return;
    }
    pushModalLog(
      `[${tool.name}] Starting ${tool.status === "Missing" ? "install" : "update"} on ${tool.channel} track`
    );
    setBusyTools((prev) => ({ ...prev, [tool.id]: true }));

    try {
      const ch = tool.channel !== "stable" ? { [tool.id]: tool.channel } : undefined;
      await downloadTools([tool.id], ch);
      setModalProgress(100);
      setModalToolProgress({ [tool.id]: 100 });
      pushModalLog(`[${tool.name}] Completed successfully`);
      addLog({ level: "info", message: `${tool.id} installed/updated (${tool.channel})` });
      void refreshBackups();
      await autoRestartAfterUpdate([tool.id]);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setModalError(message);
      pushModalLog(`[${tool.name}] Failed: ${message}`);
      addLog({
        level: "error",
        message: `Install failed (${tool.id}): ${message}`,
      });
    } finally {
      setBusyTools((prev) => ({ ...prev, [tool.id]: false }));
    }
  };

  /* ── pip upgrade for yt-dlp (with progress modal) ── */
  const handlePipUpgrade = async (tool: Tool) => {
    if (transferLockRef.current) {
      toast.info("Wait for the current download to finish.");
      return;
    }

    if (!beginTransferModal("Upgrading yt-dlp via pip", [tool.id], [
      "Preparing pip upgrade...",
      "Running pip install --upgrade yt-dlp...",
    ])) {
      toast.info("Wait for the current download to finish.");
      return;
    }
    setBusyTools((prev) => ({ ...prev, [tool.id]: true }));
    setModalCurrentStatus("Running pip command");
    setModalProgress(15);
    setModalToolProgress({ [tool.id]: 15 });

    try {
      const ok = await upgradeYtDlpViaPip();
      if (ok) {
        setModalProgress(100);
        setModalToolProgress({ [tool.id]: 100 });
        pushModalLog("[yt-dlp] pip upgrade completed");
        await autoRestartAfterUpdate([tool.id]);
      } else {
        setModalError("pip upgrade failed — check logs for details");
        pushModalLog("[yt-dlp] pip upgrade failed");
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setModalError(`pip upgrade error: ${message}`);
      pushModalLog(`[yt-dlp] pip upgrade error: ${message}`);
    } finally {
      setBusyTools((prev) => ({ ...prev, [tool.id]: false }));
    }
  };

  /* ── Update at original (system) location ── */
  const handleUpdateOriginal = async (tool: Tool) => {
    if (transferLockRef.current) {
      toast.info("Wait for the current download to finish.");
      return;
    }

    if (!tool.systemPath) return;
    const destDir = tool.systemPath.replace(/[/\\][^/\\]+$/, "");

    if (!beginTransferModal(
      `Updating ${tool.name} at original location`,
      [tool.id],
      [`Queued in-place update for ${tool.name}`]
    )) {
      toast.info("Wait for the current download to finish.");
      return;
    }
    pushModalLog(`[${tool.name}] Updating original location: ${destDir}`);
    setBusyTools((prev) => ({ ...prev, [tool.id]: true }));

    try {
      await updateToolAtPath(tool.id, destDir, tool.variant, tool.channel);
      setModalProgress(100);
      setModalToolProgress({ [tool.id]: 100 });
      pushModalLog(`[${tool.name}] In-place update completed`);
      addLog({ level: "info", message: `${tool.id} updated at ${destDir}` });
      void refreshBackups();
      await autoRestartAfterUpdate([tool.id]);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setModalError(message);
      pushModalLog(`[${tool.name}] In-place update failed: ${message}`);
      addLog({
        level: "error",
        message: `In-place update failed (${tool.id}): ${message}`,
      });
    } finally {
      setBusyTools((prev) => ({ ...prev, [tool.id]: false }));
    }
  };

  /* ── Switch channel (Stable / Nightly) ── */
  const handleChannelChange = async (tool: Tool, newChannel: ToolChannel) => {
    if (tool.channel === newChannel) return;
    updateTool(tool.id, {
      channel: newChannel,
      latestVersion: undefined,
      updateAvailable: undefined,
      latestCheckedAt: undefined,
    });
    toast.success(`${tool.name} switched to ${newChannel} channel`);
    await refreshTool(tool.id);
  };

  /* ── Update All (with progress modal) ── */
  const updateAll = async () => {
    if (transferLockRef.current) {
      toast.info("Wait for the current download to finish.");
      return;
    }

    const toUpdate = tools.filter(
      (t) => t.updateAvailable || t.status === "Missing"
    );
    if (toUpdate.length === 0) return;

    const ids = toUpdate.map((t) => t.id);
    if (!beginTransferModal(
      `Updating ${toUpdate.length} tool${toUpdate.length > 1 ? "s" : ""}`,
      ids,
      [`Queued: ${toUpdate.map((t) => t.name).join(", ")}`]
    )) {
      toast.info("Wait for the current download to finish.");
      return;
    }
    for (const t of toUpdate) {
      pushModalLog(`[${t.name}] Queued on ${t.channel} track`);
    }
    setBusyTools((prev) => {
      const next = { ...prev };
      for (const id of ids) next[id] = true;
      return next;
    });

    try {
      const ch: Record<string, string> = {};
      for (const t of toUpdate) {
        if (t.channel !== "stable") ch[t.id] = t.channel;
      }
      await downloadTools(ids, Object.keys(ch).length > 0 ? ch : undefined);
      setModalProgress(100);
      setModalToolProgress(
        Object.fromEntries(ids.map((id) => [id, 100])) as Record<string, number>
      );
      pushModalLog("All selected tool updates completed.");
      void refreshBackups();
      await autoRestartAfterUpdate(ids);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setModalError(`Update failed: ${message}`);
      pushModalLog(`Batch update failed: ${message}`);
    } finally {
      setBusyTools((prev) => {
        const next = { ...prev };
        for (const id of ids) next[id] = false;
        return next;
      });
    }
  };

  /* ── Auto-restart after successful update ── */
  const autoRestartAfterUpdate = async (toolIds: string[]) => {
    setModalDone(true);
    setModalCurrentStatus("Restarting...");
    pushModalLog("Restarting app to apply changes...");

    try {
      const existing = (() => {
        try {
          const raw = localStorage.getItem("halaldl:pendingToolCongrats");
          if (!raw) return [];
          const parsed = JSON.parse(raw);
          return Array.isArray(parsed) ? parsed.filter((x: unknown) => typeof x === "string") : [];
        } catch { return []; }
      })();
      const merged = Array.from(new Set([...existing, ...toolIds]));
      localStorage.setItem("halaldl:pendingToolCongrats", JSON.stringify(merged));
    } catch {
      // Best-effort — congrats just won't show
    }

    try {
      await relaunch();
    } catch (e) {
      toast.error(
        `Restart failed: ${e instanceof Error ? e.message : String(e)}`
      );
      handleDismiss();
      toast.info("Refreshing tool status...");
      await checkAll();
    }
  };

  /* ── Modal: dismiss on error/completion ── */
  const handleDismiss = () => {
    setModalOpen(false);
    resetModal();
  };

  /* ── Manual path (file picker) ── */
  const handleManualPath = async (tool: Tool) => {
    const path = await pickFile();
    if (!path) return;
    try {
      const stagedPath = await stageManualTool(tool.id, path);
      updateTool(tool.id, { path: stagedPath, mode: "Manual" });
      addLog({ level: "info", message: `${tool.id} path set manually` });
      toast.success(`${tool.id} path updated`);
    } catch (e) {
      toast.error(
        `Failed: ${e instanceof Error ? e.message : String(e)}`
      );
    }
  };

  const resetToAuto = (tool: Tool) => {
    updateTool(tool.id, { mode: "Auto", path: undefined });
    toast.success(`${tool.name} reset to auto-detect`);
  };

  /* ── Backup helpers ── */
  const refreshBackups = useCallback(async () => {
    try {
      const ids = await listToolBackups();
      const { tools: current, updateTool: update } = useToolsStore.getState();
      for (const t of current) {
        update(t.id, { hasBackup: ids.includes(t.id) });
      }
    } catch (e) {
      addLog({
        level: "warn",
        message: `Failed to list backups: ${e instanceof Error ? e.message : String(e)}`,
      });
    }
  }, [addLog]);

  const handleRollback = async (tool: Tool) => {
    setBusyTools((prev) => ({ ...prev, [tool.id]: true }));
    try {
      const result = await rollbackTool(tool.id);
      toast.success(`Reverted ${tool.name}: ${result}`);
      addLog({ level: "info", message: `Rolled back ${tool.id}: ${result}` });
      await refreshTool(tool.id);
      await refreshBackups();
    } catch (e) {
      toast.error(
        `Rollback failed: ${e instanceof Error ? e.message : String(e)}`
      );
    } finally {
      setBusyTools((prev) => ({ ...prev, [tool.id]: false }));
    }
  };

  const handleCleanupBackup = async (tool: Tool) => {
    try {
      const result = await cleanupToolBackup(tool.id);
      toast.success(`Old ${tool.name} removed: ${result}`);
      addLog({ level: "info", message: `Cleaned backup ${tool.id}: ${result}` });
      await refreshBackups();
    } catch (e) {
      toast.error(
        `Cleanup failed: ${e instanceof Error ? e.message : String(e)}`
      );
    }
  };

  const handleCleanupAll = async () => {
    try {
      const result = await cleanupAllBackups();
      toast.success(result);
      addLog({ level: "info", message: `Cleanup all: ${result}` });
      await refreshBackups();
    } catch (e) {
      toast.error(
        `Cleanup failed: ${e instanceof Error ? e.message : String(e)}`
      );
    }
  };

  /* Refresh backup flags on mount */
  useEffect(() => {
    void refreshBackups();
  }, [refreshBackups]);

  /* ── Derived state ── */
  const actionableCount = tools.filter(
    (t) => t.updateAvailable || t.status === "Missing"
  ).length;
  const anyBusy = Object.values(busyTools).some(Boolean);
  const hasAnyBackup = tools.some((t) => t.hasBackup);

  /* ── Tool Row ── */
  const ToolRow = ({ tool, isLast }: { tool: Tool; isLast: boolean }) => {
    const isBusy = busyTools[tool.id];
    const isPip = tool.variant === "pip";
    const disableUpgradeActions = isTransferActive;

    return (
      <div
        className={cn(
          "flex items-center gap-4 px-5 py-4 transition-colors hover:bg-muted/30",
          !isLast && "border-b border-white/4"
        )}
      >
        {/* Status indicator + info */}
        <div className="flex items-center gap-3.5 flex-1 min-w-0">
          <div
            className={cn(
              "w-2.5 h-2.5 rounded-full shrink-0 ring-4 transition-colors",
              tool.status === "Detected"
                ? "bg-green-500 ring-green-500/10"
                : tool.status === "Checking"
                  ? "bg-yellow-500 ring-yellow-500/10 animate-pulse"
                  : "bg-red-500 ring-red-500/10"
            )}
          />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm">{tool.name}</span>
              {tool.required && (
                <Badge
                  variant="secondary"
                  className="text-[9px] uppercase h-4 px-1.5 font-bold"
                >
                  Required
                </Badge>
              )}
              {tool.variant && tool.status === "Detected" && (
                <Badge
                  variant="outline"
                  className="text-[9px] h-4 px-1.5 font-medium text-muted-foreground border-white/10"
                >
                  {tool.variant}
                </Badge>
              )}
              {tool.channel === "nightly" && (
                <Badge
                  variant="outline"
                  className="text-[9px] h-4 px-1.5 font-medium text-amber-400 border-amber-400/20 bg-amber-400/5"
                >
                  <Moon className="w-2.5 h-2.5 mr-0.5" />
                  Nightly
                </Badge>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground truncate" title={tool.systemPath || tool.path || ""}>
              {tool.mode === "Manual" && tool.path
                ? tool.path
                : tool.systemPath
                  ? tool.systemPath
                  : TOOL_DESCRIPTIONS[tool.id]}
            </p>
          </div>
        </div>

        {/* Version info */}
        <div className="hidden sm:flex flex-col items-end gap-0.5 text-xs font-mono shrink-0 min-w-[170px]">
          {tool.version ? (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">{tool.version}</span>
              {tool.updateAvailable && tool.latestVersion && (
                <>
                  <ArrowRight className="w-3 h-3 text-primary" />
                  <span className="text-primary font-semibold">
                    {tool.latestVersion}
                  </span>
                </>
              )}
            </div>
          ) : tool.status === "Checking" ? (
            <span className="text-muted-foreground/50 text-[11px]">
              Checking...
            </span>
          ) : (
            <span className="text-muted-foreground/40 italic text-[11px]">
              Not installed
            </span>
          )}
          {tool.latestCheckedAt && (
            <span
              className="text-[10px] text-muted-foreground/70"
              title={`Latest source: ${getLatestSourceForTool(
                tool.id,
                getLatestTrackForTool(tool.id, tool.channel)
              )}`}
            >
              Latest track: {getLatestTrackForTool(tool.id, tool.channel)}
            </span>
          )}
        </div>

        {/* Primary action + overflow */}
        <div className="flex items-center gap-1.5 shrink-0">
          {isBusy ? (
            <MotionButton
              variant="outline"
              size="sm"
              className="h-8 px-3 text-xs"
              disabled
            >
              <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
              Working
            </MotionButton>
          ) : tool.status === "Missing" ? (
            <MotionButton
              size="sm"
              className="h-8 px-3 text-xs"
              onClick={() => installOrUpdate(tool)}
              disabled={disableUpgradeActions}
            >
              <Download className="w-3.5 h-3.5 mr-1.5" />
              Install
            </MotionButton>
          ) : tool.updateAvailable ? (
            <MotionButton
              size="sm"
              className="h-8 px-3 text-xs"
              onClick={() =>
                isPip ? handlePipUpgrade(tool) : installOrUpdate(tool)
              }
              disabled={disableUpgradeActions}
            >
              <RefreshCcw className="w-3.5 h-3.5 mr-1.5" />
              {isPip ? "pip upgrade" : "Update"}
            </MotionButton>
          ) : (
            <Badge
              variant="outline"
              className="h-7 px-2.5 gap-1.5 text-[11px] font-medium text-green-500 border-green-500/20 bg-green-500/5"
            >
              <CheckCircle2 className="w-3 h-3" />
              Ready
            </Badge>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <MotionButton variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="w-4 h-4" />
              </MotionButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem
                onClick={() => refreshTool(tool.id)}
                disabled={isBusy}
              >
                <RefreshCcw className="w-3.5 h-3.5 mr-2" />
                Refresh status
              </DropdownMenuItem>
              {isPip && tool.id === "yt-dlp" && tool.status === "Detected" && (
                <DropdownMenuItem
                  onClick={() => installOrUpdate(tool)}
                  disabled={isBusy || disableUpgradeActions}
                >
                  <Download className="w-3.5 h-3.5 mr-2" />
                  Switch to GitHub standalone
                </DropdownMenuItem>
              )}
              {!isPip && tool.id === "yt-dlp" && tool.updateAvailable && (
                <DropdownMenuItem
                  onClick={() => handlePipUpgrade(tool)}
                  disabled={isBusy || disableUpgradeActions}
                >
                  <RefreshCcw className="w-3.5 h-3.5 mr-2" />
                  Update via pip
                </DropdownMenuItem>
              )}
              {tool.systemPath && !isPip && tool.variant !== "Bundled" && tool.variant !== "Bundled (Full)" && tool.updateAvailable && (
                <DropdownMenuItem
                  onClick={() => handleUpdateOriginal(tool)}
                  disabled={isBusy || disableUpgradeActions}
                >
                  <MapPin className="w-3.5 h-3.5 mr-2" />
                  Update at original location
                </DropdownMenuItem>
              )}
              {(NIGHTLY_CAPABLE_TOOLS as readonly string[]).includes(tool.id) && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => handleChannelChange(tool, tool.channel === "nightly" ? "stable" : "nightly")}
                    disabled={isBusy}
                  >
                    {tool.channel === "nightly" ? (
                      <>
                        <Sun className="w-3.5 h-3.5 mr-2" />
                        Switch to Stable
                      </>
                    ) : (
                      <>
                        <Moon className="w-3.5 h-3.5 mr-2" />
                        Switch to Nightly
                      </>
                    )}
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => openUrl(TOOL_URLS[tool.id])}>
                <ExternalLink className="w-3.5 h-3.5 mr-2" />
                Visit website
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => revealToolInExplorer(tool.id, tool.path)}
              >
                <FolderOpen className="w-3.5 h-3.5 mr-2" />
                Open in Explorer
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleManualPath(tool)}>
                <Search className="w-3.5 h-3.5 mr-2" />
                Set custom path...
              </DropdownMenuItem>
              {tool.mode === "Manual" && (
                <DropdownMenuItem onClick={() => resetToAuto(tool)}>
                  <RotateCcw className="w-3.5 h-3.5 mr-2" />
                  Reset to auto-detect
                </DropdownMenuItem>
              )}
              {tool.hasBackup && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => handleRollback(tool)}
                    disabled={isBusy}
                  >
                    <Undo2 className="w-3.5 h-3.5 mr-2" />
                    Revert to previous
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleCleanupBackup(tool)}
                    disabled={isBusy}
                    className="text-muted-foreground"
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-2" />
                    Delete old version
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    );
  };

  /* ── Progress Modal ── */
  const isDownloading = isTransferActive;
  const modalCurrentToolName = modalCurrentToolId
    ? toolNameById[modalCurrentToolId] ?? modalCurrentToolId
    : null;
  const orderedModalToolIds =
    modalTargetToolIds.length > 0
      ? modalTargetToolIds
      : Object.keys(modalToolProgress);

  return (
    <div
      className="flex flex-col h-full bg-background max-w-6xl mx-auto w-full"
      role="main"
    >
      <FadeInStagger className="flex flex-col h-full">
        {/* ── Header ── */}
        <FadeInItem>
          <header className="p-8 pb-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                  <Wrench className="w-8 h-8 text-primary" />
                  Tools
                </h2>
                <p className="text-muted-foreground text-sm">
                  External binaries for downloading and processing media.
                </p>
              </div>
              <div className="flex items-center gap-2">
                {hasAnyBackup && (
                  <MotionButton
                    variant="ghost"
                    size="sm"
                    onClick={handleCleanupAll}
                    disabled={anyBusy}
                    className="h-9 text-muted-foreground hover:text-foreground"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Clean up backups
                  </MotionButton>
                )}
                <MotionButton
                  variant="outline"
                  size="sm"
                  onClick={checkAll}
                  disabled={isCheckingAll || anyBusy}
                  className="h-9"
                >
                  {isCheckingAll ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCcw className="w-4 h-4 mr-2" />
                  )}
                  Check All
                </MotionButton>
                {actionableCount > 0 && (
                  <MotionButton
                    size="sm"
                    onClick={updateAll}
                    disabled={anyBusy || isTransferActive}
                    className="h-9"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Update All
                  </MotionButton>
                )}
              </div>
            </div>
          </header>
        </FadeInItem>

        {/* ── Tool list ── */}
        <FadeInItem className="flex-1 min-h-0">
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="h-full overflow-auto px-8 pb-8"
          >
            <div className="space-y-4">
              <div className="rounded-xl border border-white/6 bg-background/40 backdrop-blur-sm overflow-hidden shadow-sm">
                {tools.map((tool, i) => (
                  <ToolRow
                    key={tool.id}
                    tool={tool}
                    isLast={i === tools.length - 1}
                  />
                ))}
              </div>

              {isLite && (
                <div className="rounded-xl border border-muted/40 bg-muted/10 p-4 flex items-center gap-3 text-xs text-muted-foreground">
                  <Info className="w-4 h-4 shrink-0 text-primary" />
                  <span>
                    <strong className="text-foreground">Lite Mode</strong>{" "}
                    &mdash; Tools are downloaded to the app directory. Use the
                    overflow menu to set custom paths or visit tool websites.
                  </span>
                </div>
              )}
            </div>
          </div>
        </FadeInItem>
      </FadeInStagger>

      {/* ── Download Progress Modal ── */}
      <Dialog
        open={modalOpen}
        onOpenChange={(val) => {
          if (!val) {
            if (isDownloading) {
              setModalOpen(false);
              toast.info("Update is still running in background.");
              return;
            }
            handleDismiss();
            return;
          }
          setModalOpen(true);
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
                  onClick={handleDismiss}
                  className="w-full h-11 rounded-xl"
                >
                  Dismiss
                </MotionButton>
              )}
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
