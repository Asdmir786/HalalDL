import { useEffect, useRef, type MutableRefObject } from "react";
import { downloadDir } from "@tauri-apps/api/path";
import {
  useSettingsStore,
  type Settings,
  DEFAULT_SETTINGS,
} from "@/store/settings";
import {
  usePresetsStore,
  BUILT_IN_PRESETS,
  type Preset,
} from "@/store/presets";
import { useToolsStore, type Tool } from "@/store/tools";
import { useLogsStore } from "@/store/logs";
import { useDownloadsStore, type DownloadJob } from "@/store/downloads";
import { useHistoryStore, type HistoryEntry } from "@/store/history";
import { useRuntimeStore } from "@/store/runtime";
import { storage } from "@/lib/storage";
import { canonicalizePresetId } from "@/lib/preset-display";
import { invoke } from "@tauri-apps/api/core";
import { createId } from "@/lib/id";
import {
  checkYtDlpVersion,
  checkFfmpegVersion,
  checkAria2Version,
  checkDenoVersion,
  listToolBackups,
  isAutostartEnabled,
} from "@/lib/commands";
import { toast } from "sonner";
import { getAppMode } from "@/lib/tools/app-mode";
import { startQueuedJobs } from "@/lib/downloader";
import { isDemoModeEnabled, seedMarketingDemoState } from "@/lib/demo-mode";
import {
  getAddModeDefaultMigrated,
  getLastAppMode,
  setAddModeDefaultMigrated,
  setFullSwitchAutoInstall,
  setLastAppMode,
} from "@/lib/runtime-flags";
import { markStartup } from "@/lib/startup-metrics";

export function usePersistenceInit(): MutableRefObject<boolean> {
  const { setSettings } = useSettingsStore();
  const { setPresets } = usePresetsStore();
  const { updateTool, setTools } = useToolsStore();
  const { addLog } = useLogsStore();

  const initialized = useRef(false);

  useEffect(() => {
    const scheduleDeferred = (work: () => void) => {
      const run = () => window.setTimeout(work, 0);
      const requestIdleCallback = (
        window as Window & {
          requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
        }
      ).requestIdleCallback;
      if (typeof requestIdleCallback === "function") {
        requestIdleCallback(run, { timeout: 1000 });
      } else {
        window.setTimeout(run, 0);
      }
    };

    const checkTools = async () => {
      markStartup("tools-check-start");
      addLog({ level: "debug", message: "Checking tools..." });

      const checkAndNotify = async (
        id: string,
        checkFn: () => Promise<{
          version: string;
          variant?: string;
          systemPath?: string;
        } | null>
      ) => {
        const result = await checkFn();
        updateTool(id, {
          status: result?.version ? "Detected" : "Missing",
          version: result?.version || undefined,
          variant: result?.variant,
          systemPath: result?.systemPath,
          updateAvailable: undefined,
          latestVersion: undefined,
          latestCheckedAt: undefined,
        });
      };

      await Promise.allSettled([
        checkAndNotify("yt-dlp", checkYtDlpVersion),
        checkAndNotify("ffmpeg", checkFfmpegVersion),
        checkAndNotify("aria2", checkAria2Version),
        checkAndNotify("deno", checkDenoVersion),
      ]);
      markStartup("tools-check-ready");
    };

    const init = async () => {
      if (initialized.current) return;

      try {
        markStartup("persistence-start");
        if (isDemoModeEnabled()) {
          seedMarketingDemoState();
          useRuntimeStore.getState().setPersistenceReady(true);
          initialized.current = true;
          markStartup("persistence-demo-ready");
          addLog({ level: "info", message: "Marketing demo mode seeded" });
          return;
        }

        await storage.init();
        addLog({ level: "debug", message: "Storage initialized" });

        const savedSettings = await storage.getSettings<Settings>();
        if (savedSettings) {
          const mergedSettings = { ...DEFAULT_SETTINGS, ...savedSettings };
          mergedSettings.downloadsSelectedPreset = canonicalizePresetId(mergedSettings.downloadsSelectedPreset);
          mergedSettings.quickDefaultPreset = canonicalizePresetId(mergedSettings.quickDefaultPreset);
          setSettings(mergedSettings);
          addLog({ level: "info", message: "Settings loaded" });
        }

        const savedUserPresets = await storage.getPresets<Preset[]>();
        if (savedUserPresets && Array.isArray(savedUserPresets)) {
          const userOnly = savedUserPresets
            .filter((p) => !p.isBuiltIn)
            .map((preset) => ({
              ...preset,
              group: preset.group ?? "custom",
            }));
          const merged = [...BUILT_IN_PRESETS, ...userOnly];
          setPresets(merged);
          addLog({
            level: "info",
            message: `Presets loaded (${merged.length})`,
          });
        }

        const savedDownloads = await storage.getDownloads<DownloadJob[]>();
        if (savedDownloads && Array.isArray(savedDownloads)) {
          const normalizedDownloads = savedDownloads.map((job) => {
            const canonicalPresetId = canonicalizePresetId(job.presetId);
            if (
              job.status === "Downloading" ||
              job.status === "Post-processing"
            ) {
              return {
                ...job,
                presetId: canonicalPresetId,
                status: "Queued" as const,
                phase: "Resolving formats" as const,
                statusDetail: "Recovered after restart",
                progress: 0,
                speed: undefined,
                eta: undefined,
                statusChangedAt: Date.now(),
              };
            }
            return {
              ...job,
              presetId: canonicalPresetId,
            };
          });
          const uuidRe =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          const needsMigration = normalizedDownloads.some((j) => !uuidRe.test(j.id));

          if (!needsMigration) {
            useDownloadsStore.setState({ jobs: normalizedDownloads });
            addLog({
              level: "info",
              message: `Downloads loaded (${normalizedDownloads.length})`,
            });
          } else {
            const idMap = new Map<string, string>();
            const migratedDownloads: DownloadJob[] = normalizedDownloads.map(
              (job) => {
                const nextId = createId();
                idMap.set(job.id, nextId);
                return {
                  ...job,
                  id: nextId,
                  thumbnail: undefined,
                  thumbnailStatus: "pending" as const,
                  thumbnailError: undefined,
                };
              }
            );

            useDownloadsStore.setState({ jobs: migratedDownloads });
            addLog({
              level: "info",
              message: `Downloads loaded (${migratedDownloads.length})`,
            });

            const logsState = useLogsStore.getState();
            const migratedLogs = logsState.logs.map((l) => {
              if (!l.jobId) return l;
              const next = idMap.get(l.jobId);
              if (!next) return l;
              return { ...l, jobId: next };
            });
            const migratedActiveJobId = logsState.activeJobId
              ? (idMap.get(logsState.activeJobId) ?? undefined)
              : undefined;
            useLogsStore.setState({
              logs: migratedLogs,
              activeJobId: migratedActiveJobId,
            });

            try {
              await storage.saveDownloads<DownloadJob[]>(migratedDownloads);
              await storage.saveLogs(migratedLogs);
            } catch (e) {
              addLog({
                level: "warn",
                message: `Failed to persist job id migration: ${String(e)}`,
              });
            }
          }
        }

        useRuntimeStore.getState().setPersistenceReady(true);
        markStartup("persistence-critical-ready");

        scheduleDeferred(() => {
          void (async () => {
            try {
              const currentMode = getAppMode();
              try {
                const lastMode = await getLastAppMode();
                if (lastMode && lastMode !== currentMode) {
                  if (currentMode === "LITE") {
                    await invoke("cleanup_bin_tools", {
                      tools: ["yt-dlp", "ffmpeg", "aria2", "deno"],
                    });
                  } else {
                    await setFullSwitchAutoInstall(true);
                  }
                }
                await setLastAppMode(currentMode);
              } catch {
                void 0;
              }

              try {
                const latestSettings = useSettingsStore.getState().settings;
                const nextSettings = { ...latestSettings };
                let changed = false;

                if (
                  !(await getAddModeDefaultMigrated()) &&
                  nextSettings.downloadsAddMode === "queue"
                ) {
                  nextSettings.downloadsAddMode = "start";
                  await setAddModeDefaultMigrated(true);
                  changed = true;
                }

                if (!nextSettings.defaultDownloadDir) {
                  nextSettings.defaultDownloadDir = await downloadDir();
                  changed = true;
                }

                const launchAtLogin = await isAutostartEnabled();
                if (nextSettings.launchAtLogin !== launchAtLogin) {
                  nextSettings.launchAtLogin = launchAtLogin;
                  changed = true;
                }

                if (changed) setSettings(nextSettings);
              } catch (e) {
                addLog({
                  level: "warn",
                  message: `Deferred settings sync failed: ${String(e)}`,
                });
              }

              await useLogsStore.getState().loadLogs();

              const savedHistory = await storage.getHistory<HistoryEntry[]>();
              if (savedHistory && Array.isArray(savedHistory)) {
                useHistoryStore.setState({ entries: savedHistory });
                addLog({
                  level: "info",
                  message: `History loaded (${savedHistory.length})`,
                });
              }

              const savedTools = await storage.getTools<Tool[]>();
              if (savedTools && Array.isArray(savedTools)) {
                const currentTools = useToolsStore.getState().tools;
                const mergedTools = currentTools.map((baseTool) => {
                  const saved = savedTools.find((t) => t.id === baseTool.id);
                  if (!saved) return baseTool;
                  return {
                    ...baseTool,
                    mode: saved.mode ?? baseTool.mode,
                    path: saved.path,
                  };
                });
                setTools(mergedTools);
                addLog({
                  level: "info",
                  message: `Tools loaded (${mergedTools.length})`,
                });
              }

              await checkTools();

              try {
                const backupIds = await listToolBackups();
                const currentTools = useToolsStore.getState().tools;
                for (const t of currentTools) {
                  updateTool(t.id, { hasBackup: backupIds.includes(t.id) });
                }
                addLog({
                  level: "debug",
                  message: `Backups found: ${backupIds.length > 0 ? backupIds.join(", ") : "none"}`,
                });
              } catch (e) {
                addLog({
                  level: "warn",
                  message: `Failed to list backups: ${String(e)}`,
                });
              }

              if (useDownloadsStore.getState().jobs.some((job) => job.status === "Queued")) {
                startQueuedJobs();
              }

              initialized.current = true;
              markStartup("persistence-deferred-ready");
            } catch (e) {
              addLog({
                level: "error",
                message: `Deferred persistence load failed: ${String(e)}`,
              });
              initialized.current = true;
            }
          })();
        });
      } catch (e) {
        addLog({
          level: "error",
          message: `Failed to load persistence: ${String(e)}`,
        });
        toast.error("Failed to load settings");
        useRuntimeStore.getState().setPersistenceReady(true);
      }
    };
    init();
  }, [setSettings, setPresets, setTools, updateTool, addLog]);

  return initialized;
}
