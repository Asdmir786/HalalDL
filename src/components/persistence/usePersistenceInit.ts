import { useEffect, useRef, type MutableRefObject } from "react";
import { downloadDir } from "@tauri-apps/api/path";
import { useSettingsStore, type Settings, DEFAULT_SETTINGS } from "@/store/settings";
import { usePresetsStore, BUILT_IN_PRESETS, type Preset } from "@/store/presets";
import { useToolsStore, type Tool } from "@/store/tools";
import { useLogsStore } from "@/store/logs";
import { useDownloadsStore, type DownloadJob } from "@/store/downloads";
import { storage } from "@/lib/storage";
import {
  checkYtDlpVersion,
  checkFfmpegVersion,
  checkAria2Version,
  checkDenoVersion,
  fetchLatestYtDlpVersion,
  fetchLatestFfmpegVersion,
  fetchLatestAria2Version,
  fetchLatestDenoVersion,
  isUpdateAvailable,
  listToolBackups,
} from "@/lib/commands";
import { toast } from "sonner";
import { isPermissionGranted, requestPermission, sendNotification } from '@tauri-apps/plugin-notification';
import { getVersion } from "@tauri-apps/api/app";
import { useAppUpdateStore } from "@/store/app-update";

export function usePersistenceInit(): MutableRefObject<boolean> {
  const { setSettings } = useSettingsStore();
  const { setPresets } = usePresetsStore();
  const { updateTool, setTools, setDiscoveredToolId } = useToolsStore();
  const { addLog } = useLogsStore();

  const initialized = useRef(false);
  const pendingCongratsKey = "halaldl:pendingToolCongrats";

  useEffect(() => {
    const checkTools = async () => {
      addLog({ level: "debug", message: "Checking tools..." });

      const checkAndNotify = async (id: string, checkFn: () => Promise<{ version: string; variant?: string; systemPath?: string } | null>) => {
        const currentTool = useToolsStore.getState().tools.find(t => t.id === id);
        const result = await checkFn();
        const version = result?.version ?? null;
        const discoveredAlready = useToolsStore.getState().discoveredToolId;

        const readPending = (): string[] => {
          try {
            const raw = localStorage.getItem(pendingCongratsKey);
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
          } catch {
            return [];
          }
        };

        const writePending = (next: string[]) => {
          try {
            if (next.length === 0) localStorage.removeItem(pendingCongratsKey);
            else localStorage.setItem(pendingCongratsKey, JSON.stringify(next));
          } catch (e) {
            addLog({ level: "warn", message: `Failed to persist pending tool congrats: ${String(e)}` });
          }
        };

        const pending = readPending();
        const isPending = pending.includes(id);
        const shouldOpenForPending = Boolean(version) && isPending && !discoveredAlready;

        if (shouldOpenForPending) {
          setDiscoveredToolId(id);
          writePending(pending.filter((x) => x !== id));
        } else if (version && currentTool?.status === "Missing") {
          if (!discoveredAlready) {
            setDiscoveredToolId(id);
          } else if (!isPending) {
            writePending([...pending, id]);
          }

          let permissionGranted = await isPermissionGranted();
          if (!permissionGranted) {
            const permission = await requestPermission();
            permissionGranted = permission === 'granted';
          }

          if (permissionGranted) {
            sendNotification({
              title: 'Tool Discovered!',
              body: `${currentTool.name} has been detected and is ready to use.`,
              icon: 'info'
            });
          }
        }

        updateTool(id, {
          status: version ? "Detected" : "Missing",
          version: version || undefined,
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
    };

    const checkLatestVersions = async () => {
      addLog({ level: "debug", message: "Checking latest tool versions..." });

      const toolsSnapshot = useToolsStore.getState().tools;
      const getChannel = (id: string) => toolsSnapshot.find((t) => t.id === id)?.channel ?? "stable";

      const checks: Array<{ id: string; fetchFn: () => Promise<string | null> }> = [
        { id: "yt-dlp", fetchFn: () => fetchLatestYtDlpVersion(getChannel("yt-dlp")) },
        { id: "ffmpeg", fetchFn: () => fetchLatestFfmpegVersion(getChannel("ffmpeg")) },
        { id: "aria2", fetchFn: fetchLatestAria2Version },
        { id: "deno", fetchFn: fetchLatestDenoVersion },
      ];

      await Promise.all(
        checks.map(async ({ id, fetchFn }) => {
          try {
            const latest = await fetchFn();
            const tool = useToolsStore.getState().tools.find((t) => t.id === id);
            updateTool(id, {
              latestVersion: latest || undefined,
              updateAvailable: isUpdateAvailable(tool?.version, latest || undefined),
              latestCheckedAt: Date.now(),
            });
          } catch (e) {
            addLog({ level: "warn", message: `Latest version check failed (${id}): ${String(e)}` });
          }
        })
      );
    };

    const init = async () => {
      if (initialized.current) return;

      try {
        await storage.init();
        addLog({ level: "debug", message: "Storage initialized" });
        await useLogsStore.getState().loadLogs();

        const savedSettings = await storage.getSettings<Settings>();
        if (savedSettings) {
          const mergedSettings = { ...DEFAULT_SETTINGS, ...savedSettings };
          if (!mergedSettings.defaultDownloadDir) {
            try {
              mergedSettings.defaultDownloadDir = await downloadDir();
            } catch (e) {
              addLog({ level: "warn", message: `Could not resolve download dir: ${String(e)}` });
            }
          }
          setSettings(mergedSettings);
          addLog({ level: "info", message: "Settings loaded" });
        } else {
          try {
            const defaultDir = await downloadDir();
            const currentSettings = useSettingsStore.getState().settings;
            setSettings({ ...currentSettings, defaultDownloadDir: defaultDir });
          } catch (e) {
            addLog({ level: "warn", message: `Could not resolve download dir: ${String(e)}` });
          }
        }

        const savedUserPresets = await storage.getPresets<Preset[]>();
        if (savedUserPresets && Array.isArray(savedUserPresets)) {
          const userOnly = savedUserPresets.filter(p => !p.isBuiltIn);
          const merged = [...BUILT_IN_PRESETS, ...userOnly];
          setPresets(merged);
          addLog({ level: "info", message: `Presets loaded (${merged.length})` });
        }

        const savedDownloads = await storage.getDownloads<DownloadJob[]>();
        if (savedDownloads && Array.isArray(savedDownloads)) {
          useDownloadsStore.setState({ jobs: savedDownloads });
          addLog({ level: "info", message: `Downloads loaded (${savedDownloads.length})` });
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
          addLog({ level: "info", message: `Tools loaded (${mergedTools.length})` });
        }

        await checkTools();

        try {
          const backupIds = await listToolBackups();
          const currentTools = useToolsStore.getState().tools;
          for (const t of currentTools) {
            updateTool(t.id, { hasBackup: backupIds.includes(t.id) });
          }
          addLog({ level: "debug", message: `Backups found: ${backupIds.length > 0 ? backupIds.join(", ") : "none"}` });
        } catch (e) {
          addLog({ level: "warn", message: `Failed to list backups: ${String(e)}` });
        }

        initialized.current = true;

        void checkLatestVersions();
        void checkAppUpdate();

      } catch (e) {
        addLog({ level: "error", message: `Failed to load persistence: ${String(e)}` });
        toast.error("Failed to load settings");
      }
    };

    async function checkAppUpdate() {
      try {
        const currentVersion = await getVersion();
        const res = await fetch(
          "https://api.github.com/repos/Asdmir786/HalalDL/releases/latest",
          { headers: { Accept: "application/vnd.github.v3+json" } },
        );
        if (!res.ok) return;
        const data = await res.json();
        const tag: string = data.tag_name ?? "";
        const latest = tag.replace(/^v/, "");
        if (latest && latest !== currentVersion) {
          useAppUpdateStore.getState().setUpdate(latest, data.html_url ?? "https://github.com/Asdmir786/HalalDL/releases");
          addLog({ level: "info", message: `App update available: v${latest} (current: v${currentVersion})` });
        }
      } catch {
        // silently ignore update check failures
      }
    }

    init();
  }, [setSettings, setPresets, setTools, updateTool, setDiscoveredToolId, addLog]);

  return initialized;
}
