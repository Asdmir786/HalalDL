import { useEffect, type MutableRefObject } from "react";
import { useSettingsStore } from "@/store/settings";
import { usePresetsStore } from "@/store/presets";
import { useToolsStore } from "@/store/tools";
import { useLogsStore } from "@/store/logs";
import { useDownloadsStore } from "@/store/downloads";
import { useHistoryStore } from "@/store/history";
import { storage } from "@/lib/storage";
import { setAutostartEnabled } from "@/lib/commands";
import { isDemoModeEnabled } from "@/lib/demo-mode";

export function useAutoSave(initialized: MutableRefObject<boolean>) {
  const demoMode = isDemoModeEnabled();
  const settings = useSettingsStore((s) => s.settings);
  const presets = usePresetsStore((s) => s.presets);
  const tools = useToolsStore((s) => s.tools);
  const logs = useLogsStore((s) => s.logs);
  const jobs = useDownloadsStore((s) => s.jobs);
  const historyEntries = useHistoryStore((s) => s.entries);

  useEffect(() => {
    if (!initialized.current || demoMode) return;
    const timer = setTimeout(() => {
      storage.saveSettings(settings).catch((e) => {
        useLogsStore.getState().addLog({ level: "error", message: `Failed to save settings: ${String(e)}` });
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [settings, initialized, demoMode]);

  useEffect(() => {
    if (!initialized.current || demoMode) return;
    const timer = setTimeout(() => {
      setAutostartEnabled(settings.launchAtLogin).catch((e) => {
        useLogsStore.getState().addLog({ level: "error", message: `Failed to sync autostart: ${String(e)}` });
      });
    }, 200);
    return () => clearTimeout(timer);
  }, [initialized, settings.launchAtLogin, demoMode]);

  useEffect(() => {
    if (!initialized.current || demoMode) return;
    const timer = setTimeout(() => {
      const userPresets = presets.filter((p) => !p.isBuiltIn);
      storage.savePresets(userPresets).catch((e) => {
        useLogsStore.getState().addLog({ level: "error", message: `Failed to save presets: ${String(e)}` });
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [presets, initialized, demoMode]);

  useEffect(() => {
    if (!initialized.current || demoMode) return;
    const timer = setTimeout(() => {
      storage.saveLogs(logs).catch((e) => {
        useLogsStore.getState().addLog({ level: "error", message: `Failed to save logs: ${String(e)}` });
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [logs, initialized, demoMode]);

  useEffect(() => {
    if (!initialized.current || demoMode) return;
    const timer = setTimeout(async () => {
      try {
        await storage.saveDownloads(jobs);
      } catch (e) {
        useLogsStore.getState().addLog({ level: "error", message: `Failed to save downloads: ${String(e)}` });
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [jobs, initialized, demoMode]);

  useEffect(() => {
    if (!initialized.current || demoMode) return;
    const timer = setTimeout(() => {
      storage.saveTools(tools).catch((e) => {
        useLogsStore.getState().addLog({ level: "error", message: `Failed to save tools: ${String(e)}` });
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [tools, initialized, demoMode]);

  useEffect(() => {
    if (!initialized.current || demoMode) return;
    const timer = setTimeout(() => {
      const retention = useSettingsStore.getState().settings.historyRetention;
      if (retention > 0) {
        useHistoryStore.getState().trimToRetention(retention);
      }
      const entries = useHistoryStore.getState().entries;
      storage.saveHistory(entries).catch((e) => {
        useLogsStore.getState().addLog({ level: "error", message: `Failed to save history: ${String(e)}` });
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [historyEntries, initialized, demoMode]);
}
