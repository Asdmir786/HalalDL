import { appDataDir, join } from "@tauri-apps/api/path";
import { exists } from "@tauri-apps/plugin-fs";
import { APP_MANAGED_TOOL_IDS } from "./app-mode";

const TOOL_BIN_NAMES: Record<string, string> = {
  "yt-dlp": "yt-dlp.exe",
  ffmpeg: "ffmpeg.exe",
  aria2: "aria2c.exe",
  deno: "deno.exe",
};

export async function isAppManagedToolInstalled(toolId: string): Promise<boolean> {
  const fileName = TOOL_BIN_NAMES[toolId];
  if (!fileName) return false;

  const dataDir = await appDataDir();
  const toolPath = await join(dataDir, "bin", fileName);
  return exists(toolPath);
}

export async function getMissingAppManagedToolIds(
  toolIds: readonly string[] = APP_MANAGED_TOOL_IDS
): Promise<string[]> {
  const results = await Promise.all(
    toolIds.map(async (toolId) => ({
      toolId,
      installed: await isAppManagedToolInstalled(toolId),
    }))
  );

  return results.filter((entry) => !entry.installed).map((entry) => entry.toolId);
}

export function isAppManagedToolPath(path: string | undefined): boolean {
  if (!path) return false;

  const normalized = path.replace(/\//g, "\\").toLowerCase();
  return normalized.includes("\\appdata\\") && normalized.includes("\\bin\\");
}
