export type AppMode = "FULL" | "LITE" | "PORTABLE";

export const APP_MANAGED_TOOL_IDS = ["yt-dlp", "ffmpeg", "aria2", "deno"] as const;
export const LITE_REQUIRED_TOOL_IDS = ["yt-dlp"] as const;

export function getAppMode(): AppMode {
  const appMode = String(import.meta.env.VITE_APP_MODE ?? "").trim().toUpperCase();
  if (appMode === "FULL") return "FULL";
  if (appMode === "PORTABLE") return "PORTABLE";
  return "LITE";
}

export function isFullMode(): boolean {
  return getAppMode() === "FULL";
}

export function isPortableMode(): boolean {
  return getAppMode() === "PORTABLE";
}

export function getStartupToolIds(mode: AppMode = getAppMode()): string[] {
  return mode === "FULL" || mode === "PORTABLE"
    ? [...APP_MANAGED_TOOL_IDS]
    : [...LITE_REQUIRED_TOOL_IDS];
}

export function isStartupRequiredTool(toolId: string, mode: AppMode = getAppMode()): boolean {
  return getStartupToolIds(mode).includes(toolId);
}
