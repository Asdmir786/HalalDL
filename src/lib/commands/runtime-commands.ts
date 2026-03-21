import { invoke } from "@tauri-apps/api/core";

export interface RuntimeSettingsSyncPayload {
  closeToTray: boolean;
}

export interface TrayStatePayload {
  activeDownloads: number;
  failedJobs: number;
  queuePaused: boolean;
  appUpdateAvailable: boolean;
  toolUpdateCount: number;
}

export async function syncRuntimeSettings(payload: RuntimeSettingsSyncPayload) {
  return invoke("sync_runtime_settings", { payload });
}

export async function updateTrayState(payload: TrayStatePayload) {
  return invoke("update_tray_state", { payload });
}

export async function restoreMainWindow() {
  return invoke("restore_main_window");
}

export async function showQuickDownloadWindow() {
  return invoke("show_quick_download_window");
}

export async function hideMainWindowToTray() {
  return invoke("hide_main_window_to_tray");
}

export async function isAutostartEnabled(): Promise<boolean> {
  return invoke<boolean>("is_autostart_enabled");
}

export async function wasLaunchedFromAutostart(): Promise<boolean> {
  return invoke<boolean>("was_launched_from_autostart");
}

export async function setAutostartEnabled(enabled: boolean) {
  return invoke("set_autostart_enabled", { enabled });
}

export async function takePendingLaunchUrls(): Promise<string[]> {
  return invoke<string[]>("take_pending_launch_urls");
}
