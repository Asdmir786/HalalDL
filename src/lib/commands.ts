import { Command } from "@tauri-apps/plugin-shell";
import { appDataDir, dirname, join } from "@tauri-apps/api/path";
import { exists } from "@tauri-apps/plugin-fs";
import { invoke } from "@tauri-apps/api/core";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { revealItemInDir, openPath } from "@tauri-apps/plugin-opener";
import { useLogsStore } from "@/store/logs";
import { toast } from "sonner";

type VersionParts = number[];

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

function parseVersionParts(input: string): VersionParts | null {
  const match = input.match(/\d+(?:\.\d+)+/);
  if (!match) return null;
  const parts = match[0]
    .split(".")
    .map((x) => Number.parseInt(x, 10))
    .filter((n) => Number.isFinite(n));
  if (!parts.length) return null;
  return parts;
}

function compareVersionParts(a: VersionParts, b: VersionParts): number {
  const maxLen = Math.max(a.length, b.length);
  for (let i = 0; i < maxLen; i++) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    if (av > bv) return 1;
    if (av < bv) return -1;
  }
  return 0;
}

export function isUpdateAvailable(currentVersion: string | undefined, latestVersion: string | undefined): boolean | undefined {
  if (!currentVersion || !latestVersion) return undefined;
  const currentParts = parseVersionParts(currentVersion);
  const latestParts = parseVersionParts(latestVersion);
  if (!currentParts || !latestParts) return undefined;
  return compareVersionParts(latestParts, currentParts) > 0;
}

async function fetchText(url: string, timeoutMs = 10000): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: { Accept: "text/plain,*/*" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchJson<T>(url: string, timeoutMs = 10000): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
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

export async function fetchLatestYtDlpVersion(): Promise<string | null> {
  try {
    const data = await fetchJson<{ tag_name?: string }>(
      "https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest"
    );
    return data.tag_name ? data.tag_name.replace(/^v/i, "").trim() : null;
  } catch (e) {
    console.warn("yt-dlp latest version fetch failed:", e);
    return null;
  }
}

export async function fetchLatestAria2Version(): Promise<string | null> {
  try {
    const data = await fetchJson<{ tag_name?: string }>(
      "https://api.github.com/repos/aria2/aria2/releases/latest"
    );
    return data.tag_name ? data.tag_name.replace(/^release-/i, "").replace(/^v/i, "").trim() : null;
  } catch (e) {
    console.warn("aria2 latest version fetch failed:", e);
    return null;
  }
}

export async function fetchLatestDenoVersion(): Promise<string | null> {
  try {
    const text = await fetchText("https://dl.deno.land/release-latest.txt");
    const first = text.trim().split(/\s+/)[0] || "";
    return first.replace(/^v/i, "").trim() || null;
  } catch (e) {
    console.warn("deno latest version fetch failed:", e);
    return null;
  }
}

export async function fetchLatestFfmpegVersion(): Promise<string | null> {
  try {
    const text = await fetchText("https://www.gyan.dev/ffmpeg/builds/release-version");
    const first = text.trim().split(/\s+/)[0] || "";
    return first.replace(/^v/i, "").trim() || null;
  } catch (e) {
    console.warn("ffmpeg latest version fetch failed:", e);
    return null;
  }
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
  const resolved = normalizeFsPath(path);
  const { addLog } = useLogsStore.getState();

  addLog({ 
    level: "debug", 
    message: `Attempting to reveal file in explorer: ${resolved}`,
    command: `invoke("show_in_folder", { path: "${resolved}" })`
  });

  try {
    await invoke("show_in_folder", { path: resolved });
    addLog({ level: "info", message: "Successfully executed show_in_folder" });
    return;
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    addLog({ 
      level: "warn", 
      message: `show_in_folder failed: ${errorMessage}. Falling back to revealItemInDir`,
      command: `revealItemInDir("${resolved}")`
    });
  }

  try {
    await revealItemInDir(resolved);
    addLog({ level: "info", message: "Successfully executed revealItemInDir" });
    return;
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    addLog({ level: "warn", message: `revealItemInDir failed: ${errorMessage}. Falling back to openPath(parent)` });
  }

  try {
    const dir = await dirname(resolved);
    await openPath(dir);
    addLog({ level: "info", message: "Successfully opened parent directory" });
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    addLog({ level: "error", message: `Failed to reveal path: ${errorMessage}` });
    toast.error(`Failed to show in Explorer: ${errorMessage}`);
  }
}

export async function openFolder(path: string) {
  if (!path) return;
  const resolved = normalizeFsPath(path);
  const { addLog } = useLogsStore.getState();
  try {
    await openPath(resolved);
    addLog({ level: "info", message: `Opened folder: ${resolved}` });
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    addLog({ level: "error", message: `openPath failed: ${errorMessage}`, command: `invoke("open_path", { path: "${resolved}" })` });
    try {
      await invoke("open_path", { path: resolved });
    } catch (e2) {
      const msg2 = e2 instanceof Error ? e2.message : String(e2);
      toast.error(`Failed to open folder: ${msg2}`);
    }
  }
}

export async function openFile(path: string) {
  if (!path) return;
  const resolved = normalizeFsPath(path);
  const { addLog } = useLogsStore.getState();
  try {
    await openPath(resolved);
    addLog({ level: "info", message: `Opened file: ${resolved}` });
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    addLog({ level: "error", message: `openPath failed: ${errorMessage}`, command: `invoke("open_path", { path: "${resolved}" })` });
    try {
      await invoke("open_path", { path: resolved });
    } catch (e2) {
      const msg2 = e2 instanceof Error ? e2.message : String(e2);
      try {
        const dir = await dirname(resolved);
        await openPath(dir);
        addLog({ level: "info", message: `Opened parent folder (file open failed): ${dir}` });
        toast.error("File couldn't be opened; opened folder instead");
      } catch (e3) {
        const msg3 = e3 instanceof Error ? e3.message : String(e3);
        toast.error(`Failed to open file: ${msg2}. Also failed to open folder: ${msg3}`);
      }
    }
  }
}

export async function copyFilesToClipboard(paths: string[]) {
  const resolved = paths.map(normalizeFsPath).filter(Boolean);
  if (!resolved.length) return;
  await invoke("copy_files_to_clipboard", { paths: resolved });
}

export async function deleteFile(path: string) {
  await invoke("delete_file", { path });
}

function normalizeFsPath(path: string): string {
  const trimmed = path.trim();
  const unquoted =
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
      ? trimmed.slice(1, -1)
      : trimmed;
  const cleaned = stripAnsiSimple(unquoted).trim().replace(/[\r\n]/g, "");
  return stripFileUriPrefix(cleaned);
}

function stripFileUriPrefix(path: string): string {
  const lower = path.toLowerCase();
  if (!lower.startsWith("file:")) return path;

  let out = path.replace(/^file:\/\//i, "").replace(/^file:\//i, "");
  out = out.replace(/^localhost\//i, "");
  if (/^\/[a-zA-Z]:\//.test(out)) out = out.slice(1);

  try {
    out = decodeURIComponent(out);
  } catch {
    void 0;
  }

  return out;
}

function stripAnsiSimple(input: string): string {
  let out = "";
  for (let i = 0; i < input.length; i++) {
    if (input.charCodeAt(i) === 27 && input[i + 1] === "[") {
      i += 2;
      while (i < input.length && input[i] !== "m") i++;
      continue;
    }
    out += input[i];
  }
  return out;
}
