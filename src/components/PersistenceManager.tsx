import { useEffect, useRef } from "react";
import { downloadDir } from "@tauri-apps/api/path";
import { useSettingsStore, Settings } from "@/store/settings";
import { usePresetsStore, BUILT_IN_PRESETS, Preset } from "@/store/presets";
import { useToolsStore } from "@/store/tools";
import { useLogsStore } from "@/store/logs";
import { storage } from "@/lib/storage";
import { checkYtDlpVersion, checkFfmpegVersion, checkAria2Version, checkDenoVersion } from "@/lib/commands";
import { toast } from "sonner";
import { isPermissionGranted, requestPermission, sendNotification } from '@tauri-apps/plugin-notification';

export function PersistenceManager() {
  const { settings, setSettings } = useSettingsStore();
  const { presets, setPresets } = usePresetsStore();
  const { updateTool, setDiscoveredToolId } = useToolsStore();
  const { logs } = useLogsStore();
  
  const initialized = useRef(false);

  // Initial Load
  useEffect(() => {
    const checkTools = async () => {
      console.log("Checking tools...");
      
      const checkAndNotify = async (id: string, checkFn: () => Promise<string | null>) => {
        const currentTool = useToolsStore.getState().tools.find(t => t.id === id);
        const version = await checkFn();
        
        if (version && currentTool?.status === "Missing") {
          // Tool was missing but is now detected
          setDiscoveredToolId(id);
          
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
      initialized.current = true;

      try {
        await storage.init();
        await useLogsStore.getState().loadLogs();

        // Load Settings
        const savedSettings = await storage.getSettings<Settings>();
        if (savedSettings) {
          // If defaultDownloadDir is empty, try to resolve it
          if (!savedSettings.defaultDownloadDir) {
            try {
              savedSettings.defaultDownloadDir = await downloadDir();
            } catch (e) {
              console.warn("Could not resolve download dir", e);
            }
          }
          setSettings(savedSettings);
          console.log("Settings loaded");
        } else {
          // No settings found (first run), set default download dir
          try {
            const defaultDir = await downloadDir();
            const currentSettings = useSettingsStore.getState().settings;
            setSettings({ ...currentSettings, defaultDownloadDir: defaultDir });
          } catch (e) {
            console.warn("Could not resolve download dir", e);
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
          console.log("Presets loaded", merged.length);
        }

        // Check Tools
        await checkTools();

      } catch (e) {
        console.error("Failed to load persistence:", e);
        toast.error("Failed to load settings");
      }
    };

    init();
  }, [setSettings, setPresets, updateTool, setDiscoveredToolId]);

  // Auto-Save Settings
  useEffect(() => {
    if (!initialized.current) return;
    const timer = setTimeout(() => {
      storage.saveSettings(settings).catch(console.error);
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
      storage.savePresets(userPresets).catch(console.error);
    }, 500);
    return () => clearTimeout(timer);
  }, [presets]);

  useEffect(() => {
    if (!initialized.current) return;
    const timer = setTimeout(() => {
      console.debug("[logs] saveLogs");
      storage.saveLogs(logs).catch((e) => {
        console.error("[logs] saveLogs:error", e);
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [logs]);

  return null; // Logic only component
}
