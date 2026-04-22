import { exists } from "@tauri-apps/plugin-fs";
import { useLogsStore } from "@/store/logs";
import { notifyUser } from "@/lib/notifications";
import type { AttentionTargetInput } from "@/store/attention";
import { getAppPaths } from "@/lib/app-paths";
import { getAppMode } from "@/lib/tools/app-mode";

export type ToolResolution = {
  command: string;
  path: string;
  isLocal: boolean;
};

export function toLocalCommandName(baseName: string, portable = false): string {
  return `${portable ? "portable" : "local"}-${baseName}`;
}

export async function resolveTool(baseName: string): Promise<ToolResolution> {
  try {
    const { binDir, isPortable } = await getAppPaths();
    const exeSuffix = navigator.userAgent.toLowerCase().includes("windows") ? ".exe" : "";
    const separator = binDir.includes("\\") ? "\\" : "/";
    const localPath = `${binDir}${separator}${baseName}${exeSuffix}`;
    if (await exists(localPath)) {
      return {
        command: toLocalCommandName(baseName, isPortable || getAppMode() === "PORTABLE"),
        path: localPath,
        isLocal: true,
      };
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

export async function sendDownloadCompleteNotification(
  title: string,
  body: string,
  target?: AttentionTargetInput
) {
  try {
    await notifyUser(title, body, "success", target);
  } catch (error) {
    useLogsStore.getState().addLog({ level: "warn", message: `Failed to send notification: ${String(error)}` });
  }
}
