import { invoke } from "@tauri-apps/api/core";
import { APP_MANAGED_TOOL_IDS } from "./app-mode";

export async function isAppManagedToolInstalled(toolId: string): Promise<boolean> {
  const missing = await invoke<string[]>("get_missing_app_managed_tools", {
    toolIds: [toolId],
  });
  return !missing.includes(toolId);
}

export async function getMissingAppManagedToolIds(
  toolIds: readonly string[] = APP_MANAGED_TOOL_IDS
): Promise<string[]> {
  return invoke<string[]>("get_missing_app_managed_tools", {
    toolIds: [...toolIds],
  });
}

export function isAppManagedToolPath(path: string | undefined): boolean {
  if (!path) return false;

  const normalized = path.replace(/\//g, "\\").toLowerCase();
  return (
    (normalized.includes("\\appdata\\") && normalized.includes("\\bin\\")) ||
    normalized.includes("\\portable-data\\bin\\")
  );
}
