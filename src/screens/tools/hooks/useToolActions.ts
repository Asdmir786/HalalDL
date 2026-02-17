import { useCallback, useEffect, useState } from "react";
import { useToolsStore, type Tool, type ToolChannel } from "@/store/tools";
import { useLogsStore } from "@/store/logs";
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
  upgradeYtDlpViaPip,
  listToolBackups,
  rollbackTool,
  cleanupToolBackup,
  cleanupAllBackups,
  updateToolAtPath,
  type ToolCheckResult,
} from "@/lib/commands";
import { toast } from "sonner";
import { relaunch } from "@tauri-apps/plugin-process";
import { getLatestTrackForTool, getLatestSourceForTool } from "../constants";
import type { ModalApi } from "./useDownloadProgressModal";

export function useToolActions(modalApi: ModalApi) {
  const { tools, updateTool } = useToolsStore();
  const addLog = useLogsStore((state) => state.addLog);
  const [busyTools, setBusyTools] = useState<Record<string, boolean>>({});
  const [isCheckingAll, setIsCheckingAll] = useState(false);

  const {
    beginTransferModal,
    pushModalLog,
    setModalProgress,
    setModalToolProgress,
    setModalDone,
    setModalCurrentStatus,
    setModalError,
    handleDismiss,
    transferLockRef,
  } = modalApi;

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

  useEffect(() => {
    void refreshBackups();
  }, [refreshBackups]);

  /* ── Per-tool: detect installed + check latest ── */
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
      // Best-effort
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

  /* ── pip upgrade ── */
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

  /* ── Switch channel ── */
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

  /* ── Update All ── */
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

  /* ── Manual path ── */
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

  /* ── Backup actions ── */
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

  const actionableCount = tools.filter(
    (t) => t.updateAvailable || t.status === "Missing"
  ).length;
  const anyBusy = Object.values(busyTools).some(Boolean);
  const hasAnyBackup = tools.some((t) => t.hasBackup);

  return {
    busyTools,
    isCheckingAll,
    actionableCount,
    anyBusy,
    hasAnyBackup,
    refreshTool,
    checkAll,
    installOrUpdate,
    handlePipUpgrade,
    handleUpdateOriginal,
    handleChannelChange,
    updateAll,
    handleManualPath,
    resetToAuto,
    handleRollback,
    handleCleanupBackup,
    handleCleanupAll,
  };
}
