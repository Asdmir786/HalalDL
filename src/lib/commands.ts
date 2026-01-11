import { Command } from "@tauri-apps/plugin-shell";
import { appDataDir, join } from "@tauri-apps/api/path";
import { exists } from "@tauri-apps/plugin-fs";

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
  const { invoke } = await import("@tauri-apps/api/core");
  return await invoke("download_tools", { tools });
}

export async function pickFile(): Promise<string | null> {
  const { open } = await import("@tauri-apps/plugin-dialog");
  const selected = await open({
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
  const { revealItemInDir } = await import("@tauri-apps/plugin-opener");
  await revealItemInDir(path);
}

export async function openFolder(path: string) {
  const { openPath } = await import("@tauri-apps/plugin-opener");
  await openPath(path);
}
