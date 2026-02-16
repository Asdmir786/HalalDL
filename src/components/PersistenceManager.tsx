import { useEffect, useRef } from "react";
import { downloadDir } from "@tauri-apps/api/path";
import { useSettingsStore, Settings, DEFAULT_SETTINGS } from "@/store/settings";
import { usePresetsStore, BUILT_IN_PRESETS, Preset } from "@/store/presets";
import { useToolsStore, Tool } from "@/store/tools";
import { useLogsStore } from "@/store/logs";
import { useDownloadsStore, DownloadJob } from "@/store/downloads";
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

export function PersistenceManager() {
  const { settings, setSettings } = useSettingsStore();
  const { presets, setPresets } = usePresetsStore();
  const { tools, updateTool, setTools, setDiscoveredToolId } = useToolsStore();
  const { logs, addLog } = useLogsStore();
  const { jobs } = useDownloadsStore();
  
  const initialized = useRef(false);
  const pendingCongratsKey = "halaldl:pendingToolCongrats";

  // Initial Load
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
          
          // Send notification if app is in background
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
          // Reset stale update info — will be refreshed below
          updateAvailable: undefined,
          latestVersion: undefined,
          latestCheckedAt: undefined,
        });
      };

      await checkAndNotify("yt-dlp", checkYtDlpVersion);
      await checkAndNotify("ffmpeg", checkFfmpegVersion);
      await checkAndNotify("aria2", checkAria2Version);
      await checkAndNotify("deno", checkDenoVersion);
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

        // Load Settings
        const savedSettings = await storage.getSettings<Settings>();
        if (savedSettings) {
          // If defaultDownloadDir is empty, try to resolve it
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
          // No settings found (first run), set default download dir
          try {
            const defaultDir = await downloadDir();
            const currentSettings = useSettingsStore.getState().settings;
            setSettings({ ...currentSettings, defaultDownloadDir: defaultDir });
          } catch (e) {
            addLog({ level: "warn", message: `Could not resolve download dir: ${String(e)}` });
          }
        }

        // Load Presets
        const savedUserPresets = await storage.getPresets<Preset[]>();
        if (savedUserPresets && Array.isArray(savedUserPresets)) {
          // Merge built-ins (fresh from code) with saved user presets
          // Filter out any built-ins from saved data to avoid duplication/stale data
          const userOnly = savedUserPresets.filter(p => !p.isBuiltIn);
          const merged = [...BUILT_IN_PRESETS, ...userOnly];
          setPresets(merged);
          addLog({ level: "info", message: `Presets loaded (${merged.length})` });
        }

        // Load Downloads
        const savedDownloads = await storage.getDownloads<DownloadJob[]>();
        if (savedDownloads && Array.isArray(savedDownloads)) {
          useDownloadsStore.setState({ jobs: savedDownloads });
          addLog({ level: "info", message: `Downloads loaded (${savedDownloads.length})` });
        }

        // Load Tools — restore user prefs (mode, path) but NOT stale version/update data
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
              // Deliberately omit: version, variant, latestVersion, updateAvailable, latestCheckedAt
              // These are always re-checked on startup to prevent stale data
            };
          });
          setTools(mergedTools);
          addLog({ level: "info", message: `Tools loaded (${mergedTools.length})` });
        }

        // Check installed tool versions
        await checkTools();

        // Check for .old backups so UI can show revert/cleanup options
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

        // Check latest available versions in background (non-blocking)
        void checkLatestVersions();

      } catch (e) {
        addLog({ level: "error", message: `Failed to load persistence: ${String(e)}` });
        toast.error("Failed to load settings");
      }
    };

    init();
  }, [setSettings, setPresets, setTools, updateTool, setDiscoveredToolId, addLog]);

  // Auto-Save Settings
  useEffect(() => {
    if (!initialized.current) return;
    const timer = setTimeout(() => {
      storage.saveSettings(settings).catch((e) => {
        useLogsStore.getState().addLog({ level: "error", message: `Failed to save settings: ${String(e)}` });
      });
    }, 500); // Debounce 500ms
    return () => clearTimeout(timer);
  }, [settings]);

  // Apply Theme to DOM
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");

    if (settings.theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
      root.classList.add(systemTheme);
    } else {
      root.classList.add(settings.theme);
    }
  }, [settings.theme]);

  // Auto-Save Presets (User only)
  useEffect(() => {
    if (!initialized.current) return;
    const timer = setTimeout(() => {
      const userPresets = presets.filter((p) => !p.isBuiltIn);
      storage.savePresets(userPresets).catch((e) => {
        useLogsStore.getState().addLog({ level: "error", message: `Failed to save presets: ${String(e)}` });
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [presets]);

  useEffect(() => {
    if (!initialized.current) return;
    const timer = setTimeout(() => {
      storage.saveLogs(logs).catch((e) => {
        useLogsStore.getState().addLog({ level: "error", message: `Failed to save logs: ${String(e)}` });
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [logs]);

  // Auto-Save Downloads
  useEffect(() => {
    if (!initialized.current) return;
    const timer = setTimeout(async () => {
      try {
        await storage.saveDownloads(jobs);
      } catch (e) {
        useLogsStore.getState().addLog({ level: "error", message: `Failed to save downloads: ${String(e)}` });
      }
    }, 1000); // Debounce 1s
    return () => clearTimeout(timer);
  }, [jobs]);

  // Auto-Save Tools
  useEffect(() => {
    if (!initialized.current) return;
    const timer = setTimeout(() => {
      storage.saveTools(tools).catch((e) => {
        useLogsStore.getState().addLog({ level: "error", message: `Failed to save tools: ${String(e)}` });
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [tools]);

  return null; // Logic only component
}
