import { Command } from "@tauri-apps/plugin-shell";
import { appDataDir, dirname, join } from "@tauri-apps/api/path";
import { exists } from "@tauri-apps/plugin-fs";
import { invoke } from "@tauri-apps/api/core";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { revealItemInDir, openPath } from "@tauri-apps/plugin-opener";
import { useLogsStore } from "@/store/logs";

async function getToolPath(baseName: string): Promise<string> {
  // 1. Check local bin folder first
  try {
    const dataDir = await appDataDir();
    const localPath = await join(dataDir, "bin", `${baseName}.exe`);
    if (await exists(localPath)) {
      return localPath;
    }
  } catch {
    // Ignore and fallback to system
  }
  
  // 2. Fallback to system PATH
  return baseName;
}

export async function checkYtDlpVersion(): Promise<string | null> {
  try {
    const command = await getToolPath("yt-dlp");
    const cmd = Command.create(command, ["--version"]);
    const output = await cmd.execute();
    if (output.code === 0) {
      return output.stdout.trim();
    }
  } catch (e) {
    console.warn("yt-dlp check failed:", e);
  }
  return null;
}

export async function checkFfmpegVersion(): Promise<string | null> {
  try {
    const command = await getToolPath("ffmpeg");
    const cmd = Command.create(command, ["-version"]);
    const output = await cmd.execute();
    if (output.code === 0) {
      const firstLine = output.stdout.split('\n')[0];
      return firstLine || "Detected";
    }
  } catch (e) {
    console.warn("ffmpeg check failed:", e);
  }
  return null;
}

export async function checkAria2Version(): Promise<string | null> {
  try {
    const command = await getToolPath("aria2c");
    const cmd = Command.create(command, ["--version"]);
    const output = await cmd.execute();
    if (output.code === 0) {
      const firstLine = output.stdout.split('\n')[0];
      return firstLine || "Detected";
    }
  } catch (e) {
    console.warn("aria2c check failed:", e);
  }
  return null;
}

export async function checkDenoVersion(): Promise<string | null> {
  try {
    const command = await getToolPath("deno");
    const cmd = Command.create(command, ["--version"]);
    const output = await cmd.execute();
    if (output.code === 0) {
      const firstLine = output.stdout.split('\n')[0];
      return firstLine || "Detected";
    }
  } catch (e) {
    console.warn("deno check failed:", e);
  }
  return null;
}

export async function downloadTools(tools: string[]): Promise<string> {
  return await invoke("download_tools", { tools });
}

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

export async function revealInExplorer(path: string) {
  if (!path) return;
  const resolved = path.trim();
  const { addLog } = useLogsStore.getState();

  addLog({ 
    level: "debug", 
    message: `Attempting to reveal file in explorer: ${resolved}`,
    command: `invoke("show_in_folder", { path: "${resolved}" })`
  });

  if (await exists(resolved)) {
    try {
      addLog({ level: "debug", message: "Path exists, calling Rust command..." });
      await invoke("show_in_folder", { path: resolved });
      addLog({ level: "info", message: "Successfully executed show_in_folder" });
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      addLog({ 
        level: "warn", 
        message: `show_in_folder failed: ${errorMessage}. Falling back to revealItemInDir`,
        command: `revealItemInDir("${resolved}")`
      });
      console.warn("show_in_folder failed, falling back to revealItemInDir", e);
      await revealItemInDir(resolved);
    }
    return;
  }
  
  addLog({ level: "warn", message: "Path does not exist, opening parent directory", command: `openPath("${await dirname(resolved)}")` });
  const dir = await dirname(resolved);
  await openPath(dir);
}

export async function openFolder(path: string) {
  await openPath(path);
}

export async function openFile(path: string) {
  await openPath(path);
}

export async function deleteFile(path: string) {
  await invoke("delete_file", { path });
}
