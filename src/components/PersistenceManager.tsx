import { useEffect, useRef } from "react";
import { downloadDir } from "@tauri-apps/api/path";
import { useSettingsStore, Settings } from "@/store/settings";
import { usePresetsStore, BUILT_IN_PRESETS, Preset } from "@/store/presets";
import { useToolsStore, Tool } from "@/store/tools";
import { useLogsStore } from "@/store/logs";
import { useDownloadsStore, DownloadJob } from "@/store/downloads";
import { storage } from "@/lib/storage";
import { checkYtDlpVersion, checkFfmpegVersion, checkAria2Version, checkDenoVersion } from "@/lib/commands";
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
      
      const checkAndNotify = async (id: string, checkFn: () => Promise<string | null>) => {
        const currentTool = useToolsStore.getState().tools.find(t => t.id === id);
        const version = await checkFn();
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
          version: version || undefined 
        });
      };

      await checkAndNotify("yt-dlp", checkYtDlpVersion);
      await checkAndNotify("ffmpeg", checkFfmpegVersion);
      await checkAndNotify("aria2", checkAria2Version);
      await checkAndNotify("deno", checkDenoVersion);
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
          if (!savedSettings.defaultDownloadDir) {
            try {
              savedSettings.defaultDownloadDir = await downloadDir();
            } catch (e) {
              addLog({ level: "warn", message: `Could not resolve download dir: ${String(e)}` });
            }
          }
          setSettings(savedSettings);
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

        // Load Tools
        const savedTools = await storage.getTools<Tool[]>();
        if (savedTools && Array.isArray(savedTools)) {
          const currentTools = useToolsStore.getState().tools;
          const mergedTools = currentTools.map((baseTool) => {
            const saved = savedTools.find((t) => t.id === baseTool.id);
            return saved ? { ...baseTool, ...saved, id: baseTool.id, name: baseTool.name, required: baseTool.required } : baseTool;
          });
          setTools(mergedTools);
          addLog({ level: "info", message: `Tools loaded (${mergedTools.length})` });
        }

        // Check Tools
        await checkTools();
        initialized.current = true;

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
