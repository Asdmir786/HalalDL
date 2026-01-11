import { useEffect, useRef } from "react";
import { downloadDir } from "@tauri-apps/api/path";
import { useSettingsStore, Settings } from "@/store/settings";
import { usePresetsStore, BUILT_IN_PRESETS, Preset } from "@/store/presets";
import { useToolsStore } from "@/store/tools";
import { storage } from "@/lib/storage";
import { checkYtDlpVersion, checkFfmpegVersion, checkAria2Version, checkDenoVersion } from "@/lib/commands";
import { toast } from "sonner";

export function PersistenceManager() {
  const { settings, setSettings } = useSettingsStore();
  const { presets, setPresets } = usePresetsStore();
  const { updateTool } = useToolsStore();
  
  const initialized = useRef(false);

  // Initial Load
  useEffect(() => {
    const checkTools = async () => {
      console.log("Checking tools...");
      
      // Check yt-dlp
      const ytVer = await checkYtDlpVersion();
      updateTool("yt-dlp", { 
          status: ytVer ? "Detected" : "Missing", 
          version: ytVer || undefined 
      });

      // Check ffmpeg
      const ffVer = await checkFfmpegVersion();
      updateTool("ffmpeg", {
          status: ffVer ? "Detected" : "Missing",
          version: ffVer || undefined
      });

      // Check aria2
      const ariaVer = await checkAria2Version();
      updateTool("aria2", {
          status: ariaVer ? "Detected" : "Missing",
          version: ariaVer || undefined
      });

      // Check deno
      const denoVer = await checkDenoVersion();
      updateTool("deno", {
          status: denoVer ? "Detected" : "Missing",
          version: denoVer || undefined
      });
    };

    const init = async () => {
      if (initialized.current) return;
      initialized.current = true;

      try {
        await storage.init();

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
  }, [setSettings, setPresets, updateTool]);

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

  return null; // Logic only component
}
