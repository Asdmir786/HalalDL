import { appDataDir, join } from "@tauri-apps/api/path";
import { exists } from "@tauri-apps/plugin-fs";
import { useLogsStore } from "@/store/logs";
import { sendNotification, requestPermission, isPermissionGranted } from '@tauri-apps/plugin-notification';

export type ToolResolution = {
  command: string;
  path: string;
  isLocal: boolean;
};

export function toLocalCommandName(baseName: string): string {
  return `local-${baseName}`;
}

export async function resolveTool(baseName: string): Promise<ToolResolution> {
  try {
    const dataDir = await appDataDir();
    const exeSuffix = navigator.userAgent.toLowerCase().includes("windows") ? ".exe" : "";
    const localPath = await join(dataDir, "bin", `${baseName}${exeSuffix}`);
    if (await exists(localPath)) {
      return { command: toLocalCommandName(baseName), path: localPath, isLocal: true };
    }
  } catch {
    void 0;
  }
  return { command: baseName, path: baseName, isLocal: false };
}

export function ytDlpEnv(): Record<string, string> {
  return {
    PYTHONIOENCODING: "utf-8",
    PYTHONUTF8: "1",
    LANG: "C.UTF-8",
    LC_ALL: "C.UTF-8",
  };
}

export function isYouTubeUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return (
      host === "youtube.com" ||
      host === "www.youtube.com" ||
      host === "m.youtube.com" ||
      host === "music.youtube.com" ||
      host === "youtu.be"
    );
  } catch {
    const lower = url.toLowerCase();
    return lower.includes("youtube.com") || lower.includes("youtu.be");
  }
}

export async function sendDownloadCompleteNotification(title: string, body: string) {
  try {
    let permissionGranted = await isPermissionGranted();
    if (!permissionGranted) {
      const permission = await requestPermission();
      permissionGranted = permission === 'granted';
    }
    
    if (permissionGranted) {
      sendNotification({
        title,
        body,
      });
    }
  } catch (error) {
    useLogsStore.getState().addLog({ level: "warn", message: `Failed to send notification: ${String(error)}` });
  }
}
