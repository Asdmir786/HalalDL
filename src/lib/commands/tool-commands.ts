import { exists } from "@tauri-apps/plugin-fs";
import { invoke } from "@tauri-apps/api/core";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { useLogsStore } from "@/store/logs";
import { useToolsStore } from "@/store/tools";
import { revealInExplorer } from "./file-commands";
import type { ToolBatchResult } from "@/lib/tools/tool-batch";
import { getAppPaths } from "@/lib/app-paths";

export async function updateToolAtPath(tool: string, destDir: string, variant?: string, channel?: string): Promise<string> {
  const { addLog } = useLogsStore.getState();
  addLog({ level: "command", message: `Updating ${tool} at ${destDir} (variant: ${variant || "default"}, channel: ${channel || "stable"})` });
  return invoke<string>("update_tool_at_path", { tool, destDir, variant: variant ?? null, channel: channel ?? null });
}

export async function downloadTools(tools: string[], channels?: Record<string, string>): Promise<ToolBatchResult> {
  const { addLog } = useLogsStore.getState();
  addLog({ level: "command", message: `Downloading tools: ${tools.join(", ") || "(none)"}`, command: `invoke("download_tools", { tools: ${JSON.stringify(tools)} })` });
  return await invoke<ToolBatchResult>("download_tools", { tools, channels: channels ?? null });
}

export async function stageManualTool(tool: string, source: string): Promise<string> {
  const { addLog } = useLogsStore.getState();
  addLog({ level: "command", message: `Staging manual tool: ${tool}`, command: `invoke("stage_manual_tool", { tool: "${tool}", source: "${source}" })` });
  return await invoke("stage_manual_tool", { tool, source });
}

const TOOL_BIN_NAMES: Record<string, { windows: string; unix: string }> = {
  "yt-dlp": { windows: "yt-dlp.exe", unix: "yt-dlp" },
  "ffmpeg": { windows: "ffmpeg.exe", unix: "ffmpeg" },
  "aria2": { windows: "aria2c.exe", unix: "aria2c" },
  "deno": { windows: "deno.exe", unix: "deno" },
};

export async function pickFile(): Promise<string | null> {
  const selected = await openDialog({
    multiple: false,
    filters: [{
      name: 'Executable',
      extensions: ['exe']
    }]
  });
  if (Array.isArray(selected)) return selected[0];
  return selected;
}

export async function revealToolInExplorer(toolId: string, currentPath?: string) {
  const preferred = (currentPath || "").trim();
  if (preferred) {
    await revealInExplorer(preferred);
    return;
  }

  const entry = TOOL_BIN_NAMES[toolId];
  if (!entry) return;
  const isWindows = navigator.userAgent.toLowerCase().includes("windows");
  const fileName = isWindows ? entry.windows : entry.unix;

  const { binDir } = await getAppPaths();
  const separator = binDir.includes("\\") ? "\\" : "/";
  const toolPath = `${binDir}${separator}${fileName}`;

  if (await exists(toolPath)) {
    await revealInExplorer(toolPath);
    return;
  }

  await revealInExplorer(binDir);
}

function getExtraBackupPaths(): string[] {
  const { tools } = useToolsStore.getState();
  return tools.filter((t) => t.systemPath).map((t) => t.systemPath!);
}

export async function listToolBackups(): Promise<string[]> {
  return invoke<string[]>("list_tool_backups", { extraPaths: getExtraBackupPaths() });
}

export async function rollbackTool(tool: string): Promise<string> {
  return invoke<string>("rollback_tool", { tool, extraPaths: getExtraBackupPaths() });
}

export async function cleanupToolBackup(tool: string): Promise<string> {
  return invoke<string>("cleanup_tool_backup", { tool, extraPaths: getExtraBackupPaths() });
}

export async function cleanupAllBackups(): Promise<string> {
  return invoke<string>("cleanup_all_backups", { extraPaths: getExtraBackupPaths() });
}

function getBrowserRequestHeaders(): { userAgent: string | null; acceptLanguage: string | null } {
  const userAgent = typeof navigator !== "undefined" ? navigator.userAgent.trim() : "";
  const languages =
    typeof navigator !== "undefined" && Array.isArray(navigator.languages)
      ? navigator.languages
      : [];
  const languageParts = languages
    .map((language) => language.trim())
    .filter(Boolean)
    .slice(0, 6);

  if (languageParts.length === 0 && typeof navigator !== "undefined" && navigator.language) {
    languageParts.push(navigator.language.trim());
  }

  const acceptLanguage = languageParts
    .map((language, index) => index === 0 ? language : `${language};q=${Math.max(0.1, 1 - index * 0.1).toFixed(1)}`)
    .join(",");

  return {
    userAgent: userAgent || null,
    acceptLanguage: acceptLanguage || null,
  };
}

export async function downloadUrlToFile(url: string, dest: string, referer?: string): Promise<string> {
  const { userAgent, acceptLanguage } = getBrowserRequestHeaders();
  return invoke<string>("download_url_to_file", {
    url,
    dest,
    referer: referer ?? null,
    userAgent,
    acceptLanguage,
  });
}

export async function postFormForText(
  url: string,
  body: string,
  referer?: string,
  origin?: string
): Promise<string> {
  const { userAgent, acceptLanguage } = getBrowserRequestHeaders();
  return invoke<string>("post_form_for_text", {
    url,
    body,
    referer: referer ?? null,
    origin: origin ?? null,
    userAgent,
    acceptLanguage,
  });
}
