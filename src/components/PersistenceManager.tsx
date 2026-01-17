import { useEffect, useRef } from "react";
import { downloadDir } from "@tauri-apps/api/path";
import { useSettingsStore, Settings } from "@/store/settings";
import { usePresetsStore, BUILT_IN_PRESETS, Preset } from "@/store/presets";
import { useToolsStore } from "@/store/tools";
import { useLogsStore } from "@/store/logs";
import { useDownloadsStore, DownloadJob } from "@/store/downloads";
import { storage } from "@/lib/storage";
import { checkYtDlpVersion, checkFfmpegVersion, checkAria2Version, checkDenoVersion } from "@/lib/commands";
import { toast } from "sonner";
import { isPermissionGranted, requestPermission, sendNotification } from '@tauri-apps/plugin-notification';
import { documentDir, join } from "@tauri-apps/api/path";
import { writeTextFile, mkdir, exists } from "@tauri-apps/plugin-fs";

export function PersistenceManager() {
  const { settings, setSettings } = useSettingsStore();
  const { presets, setPresets } = usePresetsStore();
  const { updateTool, setDiscoveredToolId } = useToolsStore();
  const { logs } = useLogsStore();
  const { jobs } = useDownloadsStore();
  
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

        // Load Downloads
        const savedDownloads = await storage.getDownloads<DownloadJob[]>();
        if (savedDownloads && Array.isArray(savedDownloads)) {
          useDownloadsStore.setState({ jobs: savedDownloads });
          console.log("Downloads loaded", savedDownloads.length);
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

  // Auto-Save Downloads
  useEffect(() => {
    if (!initialized.current) return;
    const timer = setTimeout(async () => {
      try {
        await storage.saveDownloads(jobs);
        
        // Paranoid Backup Mode
        if (settings.paranoidMode) {
          try {
            const docs = await documentDir();
            const backupDir = await join(docs, "HalalDL", "backups");
            if (!(await exists(backupDir))) {
              await mkdir(backupDir, { recursive: true });
            }
            
            // We use a single rolling history file for now, or timestamped?
            // "Paranoid" implies losing nothing. Let's do timestamped but throttled?
            // Or just a single history.json that is guaranteed to be user accessible.
            // Let's do a daily backup file + latest.json
            
            const dateStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
            const backupPath = await join(backupDir, `history-${dateStr}.json`);
            
            await writeTextFile(backupPath, JSON.stringify(jobs, null, 2));
            console.log("Paranoid backup saved to", backupPath);
          } catch (e) {
            console.error("Paranoid backup failed:", e);
          }
        }
      } catch (e) {
        console.error("Failed to save downloads:", e);
      }
    }, 1000); // Debounce 1s
    return () => clearTimeout(timer);
  }, [jobs, settings.paranoidMode]);

  return null; // Logic only component
}
