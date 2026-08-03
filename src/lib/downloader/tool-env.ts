import { invoke } from "@tauri-apps/api/core";
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

/**
 * Prefer app-managed binaries (Full: AppData bin, Portable: portable-data/bin).
 * Existence is checked in Rust so Portable tools are found even when the FS
 * plugin cannot `exists()` absolute paths under `$EXE/portable-data`.
 */
export async function resolveTool(baseName: string): Promise<ToolResolution> {
  try {
    const { isPortable } = await getAppPaths();
    const usePortableSidecar = isPortable || getAppMode() === "PORTABLE";
    const localPath = await invoke<string | null>("resolve_app_bin_tool", {
      binaryName: baseName,
    });

    if (localPath) {
      return {
        command: toLocalCommandName(baseName, usePortableSidecar),
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
