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
import {
  buildToolBatchErrorMessage,
  getFailedToolResults,
  getSuccessfulToolResults,
} from "@/lib/tools/tool-batch";
import { notifyUser } from "@/lib/notifications";

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
    setModalToolVersions,
    setModalDone,
    setModalCurrentStatus,
    setModalError,
    setModalBatchResult,
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

  const fetchTargetVersion = useCallback(async (tool: Tool): Promise<string | null> => {
    if (tool.latestVersion) return tool.latestVersion;

    switch (tool.id) {
      case "yt-dlp":
        return fetchLatestYtDlpVersion(tool.channel);
      case "ffmpeg":
        return fetchLatestFfmpegVersion(tool.channel);
      case "aria2":
        return fetchLatestAria2Version();
      case "deno":
        return fetchLatestDenoVersion();
      default:
        return null;
    }
  }, []);

  const resolveTargetVersions = useCallback(async (selectedTools: Tool[]) => {
    const versions: Record<string, string> = {};

    await Promise.all(selectedTools.map(async (selectedTool) => {
      const version = await fetchTargetVersion(selectedTool).catch(() => null);
      if (version) versions[selectedTool.id] = version;
    }));

    return versions;
  }, [fetchTargetVersion]);

  const formatToolTarget = useCallback((tool: Tool, targetVersions: Record<string, string>) => {
    const version = targetVersions[tool.id];
    return version ? `${tool.name} v${version}` : `${tool.name} latest`;
  }, []);

  /* ── Per-tool: detect installed + check latest ── */
  const refreshTool = useCallback(async (id: string) => {
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
  }, [addLog, updateTool]);

  const refreshToolIds = useCallback(
    async (ids: string[]) => {
      const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
      if (uniqueIds.length === 0) return;
      await Promise.all(uniqueIds.map((id) => refreshTool(id)));
      await refreshBackups();
    },
    [refreshBackups, refreshTool]
  );

  const checkAll = async () => {
    setIsCheckingAll(true);
    try {
      await Promise.all(tools.map((t) => refreshTool(t.id)));
    } finally {
      setIsCheckingAll(false);
    }
  };

  /* ── Auto-restart after successful update ── */
  const autoRestartAfterUpdate = async (summary: string) => {
    setModalDone(true);
    setModalCurrentStatus("Restarting...");
    pushModalLog("Restarting app to apply changes...");
    await notifyUser("Tool update finished", summary, "success", {
      screen: "tools",
      reason: "tool-update-finished",
      actionLabel: "Open Tools",
    });

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

    const actionLabel = tool.status === "Missing" ? "Installing" : "Updating";
    const knownTargetVersions = tool.latestVersion ? { [tool.id]: tool.latestVersion } : {};

    if (!beginTransferModal(
      `${actionLabel} ${tool.name}${tool.latestVersion ? ` v${tool.latestVersion}` : ""}`,
      [tool.id],
      [
        tool.latestVersion
          ? `Queued ${tool.name} v${tool.latestVersion} (${tool.channel})`
          : `Queued ${tool.name} (${tool.channel})`,
      ],
      knownTargetVersions
    )) {
      toast.info("Wait for the current download to finish.");
      return;
    }
    setModalCurrentStatus(
      tool.latestVersion ? `Preparing v${tool.latestVersion}...` : "Checking target version..."
    );
    pushModalLog(
      `[${tool.name}] Starting ${tool.status === "Missing" ? "install" : "update"} on ${tool.channel} track`
    );
    setBusyTools((prev) => ({ ...prev, [tool.id]: true }));

    try {
      const targetVersions = await resolveTargetVersions([tool]);
      setModalToolVersions(targetVersions);
      pushModalLog(`[${tool.name}] Target: ${formatToolTarget(tool, targetVersions)}`);
      setModalCurrentStatus(
        targetVersions[tool.id]
          ? `${actionLabel} v${targetVersions[tool.id]}...`
          : `${actionLabel} latest version...`
      );

      const ch = tool.channel !== "stable" ? { [tool.id]: tool.channel } : undefined;
      const result = await downloadTools([tool.id], ch);
      setModalBatchResult(result);

      if (result.allSucceeded) {
        setModalProgress(100);
        setModalToolProgress({ [tool.id]: 100 });
        pushModalLog(`[${tool.name}] Installed ${formatToolTarget(tool, targetVersions)}`);
        addLog({ level: "info", message: `${tool.id} installed/updated (${tool.channel})` });
        await refreshToolIds([tool.id]);
        await autoRestartAfterUpdate(`${tool.name} was updated successfully. HalalDL will restart now.`);
      } else {
        const message = buildToolBatchErrorMessage(result, { [tool.id]: tool.name });
        setModalError(message);
        for (const item of getSuccessfulToolResults(result)) {
          pushModalLog(`[${tool.name}] ${item.message}`);
        }
        for (const item of getFailedToolResults(result)) {
          pushModalLog(`[${tool.name}] Failed: ${item.message}`);
        }
        await refreshToolIds([tool.id]);
      }
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

    const knownTargetVersions = tool.latestVersion ? { [tool.id]: tool.latestVersion } : {};

    if (!beginTransferModal(
      `Upgrading yt-dlp via pip${tool.latestVersion ? ` to v${tool.latestVersion}` : ""}`,
      [tool.id],
      [
        tool.latestVersion
          ? `Preparing pip upgrade to yt-dlp v${tool.latestVersion}...`
          : "Preparing pip upgrade...",
        "Running pip install --upgrade yt-dlp...",
      ],
      knownTargetVersions
    )) {
      toast.info("Wait for the current download to finish.");
      return;
    }
    setBusyTools((prev) => ({ ...prev, [tool.id]: true }));
    setModalCurrentStatus(
      tool.latestVersion ? `Running pip command for v${tool.latestVersion}` : "Checking target version..."
    );
    setModalProgress(15);
    setModalToolProgress({ [tool.id]: 15 });

    try {
      const targetVersions = await resolveTargetVersions([tool]);
      setModalToolVersions(targetVersions);
      pushModalLog(`[yt-dlp] Target: ${formatToolTarget(tool, targetVersions)}`);
      setModalCurrentStatus(
        targetVersions[tool.id]
          ? `Running pip command for v${targetVersions[tool.id]}`
          : "Running pip command for latest version"
      );

      const ok = await upgradeYtDlpViaPip();
      if (ok) {
        setModalProgress(100);
        setModalToolProgress({ [tool.id]: 100 });
        pushModalLog(`[yt-dlp] pip upgrade completed for ${formatToolTarget(tool, targetVersions)}`);
        await autoRestartAfterUpdate("yt-dlp was updated successfully. HalalDL will restart now.");
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
    const knownTargetVersions = tool.latestVersion ? { [tool.id]: tool.latestVersion } : {};

    if (!beginTransferModal(
      `Updating ${tool.name}${tool.latestVersion ? ` v${tool.latestVersion}` : ""} at original location`,
      [tool.id],
      [
        tool.latestVersion
          ? `Queued in-place update for ${tool.name} v${tool.latestVersion}`
          : `Queued in-place update for ${tool.name}`,
      ],
      knownTargetVersions
    )) {
      toast.info("Wait for the current download to finish.");
      return;
    }
    pushModalLog(`[${tool.name}] Updating original location: ${destDir}`);
    setModalCurrentStatus(
      tool.latestVersion ? `Preparing v${tool.latestVersion}...` : "Checking target version..."
    );
    setBusyTools((prev) => ({ ...prev, [tool.id]: true }));

    try {
      const targetVersions = await resolveTargetVersions([tool]);
      setModalToolVersions(targetVersions);
      pushModalLog(`[${tool.name}] Target: ${formatToolTarget(tool, targetVersions)}`);
      setModalCurrentStatus(
        targetVersions[tool.id]
          ? `Updating v${targetVersions[tool.id]}...`
          : "Updating latest version..."
      );

      await updateToolAtPath(tool.id, destDir, tool.variant, tool.channel);
      setModalProgress(100);
      setModalToolProgress({ [tool.id]: 100 });
      pushModalLog(`[${tool.name}] In-place update completed for ${formatToolTarget(tool, targetVersions)}`);
      addLog({ level: "info", message: `${tool.id} updated at ${destDir}` });
      await refreshToolIds([tool.id]);
      await autoRestartAfterUpdate(`${tool.name} was updated successfully. HalalDL will restart now.`);
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
    const knownTargetVersions = Object.fromEntries(
      toUpdate
        .filter((t) => Boolean(t.latestVersion))
        .map((t) => [t.id, t.latestVersion!])
    ) as Record<string, string>;

    if (!beginTransferModal(
      `Updating ${toUpdate.length} tool${toUpdate.length > 1 ? "s" : ""}`,
      ids,
      [
        `Queued: ${toUpdate
          .map((t) => (t.latestVersion ? `${t.name} v${t.latestVersion}` : t.name))
          .join(", ")}`,
      ],
      knownTargetVersions
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
      setModalCurrentStatus("Checking target versions...");
      const targetVersions = await resolveTargetVersions(toUpdate);
      setModalToolVersions(targetVersions);
      for (const t of toUpdate) {
        pushModalLog(`[${t.name}] Target: ${formatToolTarget(t, targetVersions)}`);
      }
      setModalCurrentStatus("Downloading selected versions...");

      const ch: Record<string, string> = {};
      for (const t of toUpdate) {
        if (t.channel !== "stable") ch[t.id] = t.channel;
      }
      const result = await downloadTools(ids, Object.keys(ch).length > 0 ? ch : undefined);
      setModalBatchResult(result);

      const succeeded = getSuccessfulToolResults(result);
      const failed = getFailedToolResults(result);

      if (succeeded.length > 0) {
        setModalToolProgress((prev) => ({
          ...prev,
          ...Object.fromEntries(succeeded.map((item) => [item.tool, 100])),
        }));
      }

      if (result.allSucceeded) {
        setModalProgress(100);
        pushModalLog("All selected tool updates completed.");
        await refreshToolIds(ids);
        await autoRestartAfterUpdate(`${toUpdate.length} tool updates completed. HalalDL will restart now.`);
      } else {
        const toolNameById = Object.fromEntries(tools.map((tool) => [tool.id, tool.name])) as Record<string, string>;
        setModalError(buildToolBatchErrorMessage(result, toolNameById));
        for (const item of succeeded) {
          pushModalLog(`[${toolNameById[item.tool] ?? item.tool}] ${item.message}`);
        }
        for (const item of failed) {
          pushModalLog(`[${toolNameById[item.tool] ?? item.tool}] Failed: ${item.message}`);
        }
        await refreshToolIds(ids);
      }
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
