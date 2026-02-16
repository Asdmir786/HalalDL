import { Command } from "@tauri-apps/plugin-shell";
import { appDataDir, dirname, join } from "@tauri-apps/api/path";
import { exists } from "@tauri-apps/plugin-fs";
import { invoke } from "@tauri-apps/api/core";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { revealItemInDir, openPath } from "@tauri-apps/plugin-opener";
import { useLogsStore } from "@/store/logs";
import { useToolsStore } from "@/store/tools";
import { toast } from "sonner";

type VersionParts = number[];

export interface ToolCheckResult {
  version: string;
  variant: string;
  systemPath?: string;
}

type ToolResolution = {
  command: string;
  path: string;
  isLocal: boolean;
};

function toLocalCommandName(baseName: string): string {
  return `local-${baseName}`;
}

async function resolveTool(baseName: string): Promise<ToolResolution> {
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

function parseVersionParts(input: string): VersionParts | null {
  // Try dotted version first (e.g. "7.1.2", "1.37.0", "2025.06.01")
  const dotted = input.match(/\d+(?:\.\d+)+/);
  if (dotted) {
    const parts = dotted[0]
      .split(".")
      .map((x) => Number.parseInt(x, 10))
      .filter((n) => Number.isFinite(n));
    if (parts.length) return parts;
  }
  // Fallback: date-based version with dashes (e.g. "2024-08-11")
  const dashed = input.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (dashed) {
    return [Number(dashed[1]), Number(dashed[2]), Number(dashed[3])];
  }
  return null;
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
  // Fast path: identical strings → no update
  if (currentVersion.trim() === latestVersion.trim()) return false;
  const currentParts = parseVersionParts(currentVersion);
  const latestParts = parseVersionParts(latestVersion);
  // Both parseable → numeric comparison
  if (currentParts && latestParts) {
    return compareVersionParts(latestParts, currentParts) > 0;
  }
  // Current is unparseable (nightly/custom build) but latest is valid →
  // treat as update available so user can switch to stable
  if (!currentParts && latestParts) return true;
  return undefined;
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

export async function checkYtDlpVersion(): Promise<ToolCheckResult | null> {
  const { addLog } = useLogsStore.getState();
  try {
    const tool = await resolveTool("yt-dlp");
    addLog({ level: "command", message: "Checking for yt-dlp binary...", command: `${tool.path} --version` });
    const cmd = Command.create(tool.command, ["--version"]);
    const output = await cmd.execute();
    if (output.code === 0) {
      const version = output.stdout.trim();

      // Detect variant: bundled (our bin dir) vs pip vs system PATH
      let variant = tool.isLocal ? "Bundled" : "System";
      if (!tool.isLocal) {
        try {
          const pipCmd = Command.create("pip", ["show", "yt-dlp"]);
          const pipOut = await pipCmd.execute();
          if (pipOut.code === 0 && pipOut.stdout.toLowerCase().includes("name: yt-dlp")) {
            variant = "pip";
          }
        } catch {
          // pip not available — try pip3
          try {
            const pip3Cmd = Command.create("pip3", ["show", "yt-dlp"]);
            const pip3Out = await pip3Cmd.execute();
            if (pip3Out.code === 0 && pip3Out.stdout.toLowerCase().includes("name: yt-dlp")) {
              variant = "pip";
            }
          } catch {
            // neither pip nor pip3 available, keep "System"
          }
        }
      }

      const systemPath = !tool.isLocal
        ? await resolveSystemToolPath("yt-dlp").catch(() => null)
        : tool.path;

      addLog({ level: "info", message: `yt-dlp ${version || "Detected"} (${variant}) at ${systemPath || tool.path}` });
      return { version, variant, systemPath: systemPath ?? undefined };
    }
    addLog({ level: "warn", message: `yt-dlp version check returned code ${output.code}` });
  } catch (e) {
    addLog({ level: "error", message: `yt-dlp check failed: ${String(e)}` });
  }
  return null;
}

export async function checkFfmpegVersion(): Promise<ToolCheckResult | null> {
  const { addLog } = useLogsStore.getState();
  try {
    const tool = await resolveTool("ffmpeg");
    addLog({ level: "command", message: "Checking for ffmpeg binary...", command: `${tool.path} -version` });
    const cmd = Command.create(tool.command, ["-version"]);
    const output = await cmd.execute();
    if (output.code === 0) {
      const firstLine = output.stdout.split('\n')[0] || "";
      const rawMatch = firstLine.match(/version\s+(\S+)/i);
      const rawVersion = rawMatch ? rawMatch[1] : "";
      // Clean build metadata:
      //   Release: "7.1-full_build-www.gyan.dev" → "7.1"
      //   Nightly: "N-121437-gf4a87d8ca4-20251015" → "N-121437"
      let version: string;
      const releaseMatch = rawVersion.match(/^(\d+(?:\.\d+)*)/);
      const nightlyMatch = rawVersion.match(/^(N-\d+)/i);
      if (releaseMatch) {
        version = releaseMatch[1];
      } else if (nightlyMatch) {
        version = nightlyMatch[1];
      } else {
        version = rawVersion || firstLine || "Detected";
      }

      // Detect build variant from version string + path
      const lower = firstLine.toLowerCase();
      const pathLower = (tool.path || "").toLowerCase();
      let variant = tool.isLocal ? "Bundled" : "System";
      if (nightlyMatch) {
        variant = "Nightly";
      } else if (lower.includes("shared") || pathLower.includes("shared")) {
        variant = "Shared";
      } else if (lower.includes("full_build") || lower.includes("full-build") || pathLower.includes("-full")) {
        variant = tool.isLocal ? "Bundled (Full)" : "Full Build";
      } else if (lower.includes("essentials_build") || lower.includes("essentials-build") || lower.includes("essentials")) {
        variant = "Essentials";
      }

      const systemPath = !tool.isLocal
        ? await resolveSystemToolPath("ffmpeg").catch(() => null)
        : tool.path;

      addLog({ level: "info", message: `ffmpeg ${version} (${variant}) at ${systemPath || tool.path}` });
      return { version, variant, systemPath: systemPath ?? undefined };
    }
    addLog({ level: "warn", message: `ffmpeg version check returned code ${output.code}` });
  } catch (e) {
    addLog({ level: "error", message: `ffmpeg check failed: ${String(e)}` });
  }
  return null;
}

export async function checkAria2Version(): Promise<ToolCheckResult | null> {
  const { addLog } = useLogsStore.getState();
  try {
    const tool = await resolveTool("aria2c");
    addLog({ level: "command", message: "Checking for aria2c binary...", command: `${tool.path} --version` });
    const cmd = Command.create(tool.command, ["--version"]);
    const output = await cmd.execute();
    if (output.code === 0) {
      const firstLine = output.stdout.split('\n')[0] || "";
      const versionMatch = firstLine.match(/version\s+(\S+)/i);
      const version = versionMatch ? versionMatch[1] : (firstLine || "Detected");
      const variant = tool.isLocal ? "Bundled" : "System";

      const systemPath = !tool.isLocal
        ? await resolveSystemToolPath("aria2").catch(() => null)
        : tool.path;

      addLog({ level: "info", message: `aria2c ${version} (${variant}) at ${systemPath || tool.path}` });
      return { version, variant, systemPath: systemPath ?? undefined };
    }
    addLog({ level: "warn", message: `aria2c version check returned code ${output.code}` });
  } catch (e) {
    addLog({ level: "error", message: `aria2c check failed: ${String(e)}` });
  }
  return null;
}

export async function checkDenoVersion(): Promise<ToolCheckResult | null> {
  const { addLog } = useLogsStore.getState();
  try {
    const tool = await resolveTool("deno");
    addLog({ level: "command", message: "Checking for deno binary...", command: `${tool.path} --version` });
    const cmd = Command.create(tool.command, ["--version"]);
    const output = await cmd.execute();
    if (output.code === 0) {
      const firstLine = output.stdout.split('\n')[0] || "";
      const versionMatch = firstLine.match(/deno\s+(\S+)/i);
      const version = versionMatch ? versionMatch[1] : (firstLine || "Detected");
      const variant = tool.isLocal ? "Bundled" : "System";

      const systemPath = !tool.isLocal
        ? await resolveSystemToolPath("deno").catch(() => null)
        : tool.path;

      addLog({ level: "info", message: `deno ${version} (${variant}) at ${systemPath || tool.path}` });
      return { version, variant, systemPath: systemPath ?? undefined };
    }
    addLog({ level: "warn", message: `deno version check returned code ${output.code}` });
  } catch (e) {
    addLog({ level: "error", message: `deno check failed: ${String(e)}` });
  }
  return null;
}

export async function upgradeYtDlpViaPip(): Promise<boolean> {
  const { addLog } = useLogsStore.getState();
  // Try pip first, fall back to pip3
  for (const pipCmd of ["pip", "pip3"]) {
    try {
      addLog({ level: "command", message: `Upgrading yt-dlp via ${pipCmd}...`, command: `${pipCmd} install --upgrade yt-dlp` });
      const cmd = Command.create(pipCmd, ["install", "--upgrade", "yt-dlp"]);
      const output = await cmd.execute();
      if (output.code === 0) {
        addLog({ level: "info", message: `yt-dlp upgraded via ${pipCmd}` });
        return true;
      }
      addLog({ level: "warn", message: `${pipCmd} upgrade returned code ${output.code}: ${output.stderr}` });
    } catch (e) {
      addLog({ level: "debug", message: `${pipCmd} not available: ${String(e)}` });
    }
  }
  addLog({ level: "error", message: "pip upgrade failed: neither pip nor pip3 available" });
  return false;
}

export async function fetchLatestYtDlpVersion(channel: string = "stable"): Promise<string | null> {
  const { addLog } = useLogsStore.getState();
  try {
    addLog({
      level: "command",
      message: `Checking latest yt-dlp version (${channel})...`,
      command: `invoke("fetch_latest_ytdlp_version", { channel: "${channel}" })`,
    });
    const version = await invoke<string>("fetch_latest_ytdlp_version", { channel });
    return version.trim() || null;
  } catch (e) {
    addLog({ level: "warn", message: `yt-dlp latest version check failed: ${String(e)}` });
    try {
      const repo = channel === "nightly" ? "yt-dlp/yt-dlp-nightly-builds" : "yt-dlp/yt-dlp";
      const data = await fetchJson<{ tag_name?: string }>(
        `https://api.github.com/repos/${repo}/releases/latest`
      );
      const version = data.tag_name ? data.tag_name.replace(/^v/i, "").trim() : null;
      if (!version) addLog({ level: "warn", message: "Latest yt-dlp version not found in GitHub response" });
      return version;
    } catch (e2) {
      addLog({ level: "warn", message: `yt-dlp latest version fallback failed: ${String(e2)}` });
      return null;
    }
  }
}

export async function fetchLatestAria2Version(): Promise<string | null> {
  const { addLog } = useLogsStore.getState();
  try {
    addLog({
      level: "command",
      message: "Checking latest aria2 version...",
      command: 'invoke("fetch_latest_aria2_version")',
    });
    const version = await invoke<string>("fetch_latest_aria2_version");
    return version.trim() || null;
  } catch (e) {
    addLog({ level: "warn", message: `aria2 latest version check failed: ${String(e)}` });
    try {
      const data = await fetchJson<{ tag_name?: string }>(
        "https://api.github.com/repos/aria2/aria2/releases/latest"
      );
      const version = data.tag_name
        ? data.tag_name.replace(/^release-/i, "").replace(/^v/i, "").trim()
        : null;
      if (!version) addLog({ level: "warn", message: "Latest aria2 version not found in GitHub response" });
      return version;
    } catch (e2) {
      addLog({ level: "warn", message: `aria2 latest version fallback failed: ${String(e2)}` });
      return null;
    }
  }
}

export async function fetchLatestDenoVersion(): Promise<string | null> {
  const { addLog } = useLogsStore.getState();
  try {
    addLog({
      level: "command",
      message: "Checking latest deno version...",
      command: 'invoke("fetch_latest_deno_version")',
    });
    const version = await invoke<string>("fetch_latest_deno_version");
    return version.trim() || null;
  } catch (e) {
    addLog({ level: "warn", message: `deno latest version check failed: ${String(e)}` });
    try {
      const text = await fetchText("https://dl.deno.land/release-latest.txt");
      const first = text.trim().split(/\s+/)[0] || "";
      const version = first.replace(/^v/i, "").trim() || null;
      if (!version) addLog({ level: "warn", message: "Latest deno version not found in response" });
      return version;
    } catch (e2) {
      addLog({ level: "warn", message: `deno latest version fallback failed: ${String(e2)}` });
      return null;
    }
  }
}

export async function fetchLatestFfmpegVersion(channel: string = "stable"): Promise<string | null> {
  const { addLog } = useLogsStore.getState();
  try {
    addLog({
      level: "command",
      message: `Checking latest ffmpeg version (${channel})...`,
      command: `invoke("fetch_latest_ffmpeg_version", { channel: "${channel}" })`,
    });
    const version = await invoke<string>("fetch_latest_ffmpeg_version", { channel });
    return version.trim() || null;
  } catch (e) {
    addLog({ level: "warn", message: `ffmpeg latest version check failed: ${String(e)}` });
    try {
      const url = channel === "nightly"
        ? "https://www.gyan.dev/ffmpeg/builds/git-version"
        : "https://www.gyan.dev/ffmpeg/builds/release-version";
      const text = await fetchText(url);
      const first = text.trim().split(/\s+/)[0] || "";
      const version = first.replace(/^v/i, "").trim() || null;
      if (!version) addLog({ level: "warn", message: "Latest ffmpeg version not found in response" });
      return version;
    } catch (e2) {
      addLog({ level: "warn", message: `ffmpeg latest version fallback failed: ${String(e2)}` });
      return null;
    }
  }
}

export async function resolveSystemToolPath(tool: string): Promise<string | null> {
  return invoke<string | null>("resolve_system_tool_path", { tool });
}

export async function updateToolAtPath(tool: string, destDir: string, variant?: string, channel?: string): Promise<string> {
  const { addLog } = useLogsStore.getState();
  addLog({ level: "command", message: `Updating ${tool} at ${destDir} (variant: ${variant || "default"}, channel: ${channel || "stable"})` });
  return invoke<string>("update_tool_at_path", { tool, destDir, variant: variant ?? null, channel: channel ?? null });
}

export async function downloadTools(tools: string[], channels?: Record<string, string>): Promise<string> {
  const { addLog } = useLogsStore.getState();
  addLog({ level: "command", message: `Downloading tools: ${tools.join(", ") || "(none)"}`, command: `invoke("download_tools", { tools: ${JSON.stringify(tools)} })` });
  return await invoke("download_tools", { tools, channels: channels ?? null });
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

  const dataDir = await appDataDir();
  const binDir = await join(dataDir, "bin");
  const toolPath = await join(binDir, fileName);

  if (await exists(toolPath)) {
    await revealInExplorer(toolPath);
    return;
  }

  await revealInExplorer(binDir);
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
    const level = errorMessage.toLowerCase().includes("not allowed by acl") ? "warn" : "error";
    addLog({ level, message: `openPath failed: ${errorMessage}`, command: `invoke("open_path", { path: "${resolved}" })` });
    try {
      await invoke("open_path", { path: resolved });
      addLog({ level: "info", message: `Opened folder via backend: ${resolved}` });
    } catch (e2) {
      const msg2 = e2 instanceof Error ? e2.message : String(e2);
      addLog({ level: "error", message: `Failed to open folder: ${msg2}` });
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
    const level = errorMessage.toLowerCase().includes("not allowed by acl") ? "warn" : "error";
    addLog({ level, message: `openPath failed: ${errorMessage}`, command: `invoke("open_path", { path: "${resolved}" })` });
    try {
      await invoke("open_path", { path: resolved });
      addLog({ level: "info", message: `Opened file via backend: ${resolved}` });
    } catch (e2) {
      const msg2 = e2 instanceof Error ? e2.message : String(e2);
      addLog({ level: "warn", message: `Failed to open file: ${msg2}. Trying to open parent folder instead` });
      try {
        const dir = await dirname(resolved);
        await openPath(dir);
        addLog({ level: "info", message: `Opened parent folder (file open failed): ${dir}` });
        toast.error("File couldn't be opened; opened folder instead");
      } catch (e3) {
        const msg3 = e3 instanceof Error ? e3.message : String(e3);
        addLog({ level: "error", message: `Failed to open file: ${msg2}. Also failed to open folder: ${msg3}` });
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

export async function renameFile(from: string, to: string) {
  await invoke("rename_file", { from, to });
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

// ── Tool backup / rollback commands ──

/** Collect system paths from the tools store to pass to backup commands */
function getExtraBackupPaths(): string[] {
  const { tools } = useToolsStore.getState();
  return tools.filter((t) => t.systemPath).map((t) => t.systemPath!);
}

/** Returns IDs of tools that have .old backups available (checks bin/ + system paths) */
export async function listToolBackups(): Promise<string[]> {
  return invoke<string[]>("list_tool_backups", { extraPaths: getExtraBackupPaths() });
}

/** Roll back a tool to its .old backup (checks bin/ + system paths) */
export async function rollbackTool(tool: string): Promise<string> {
  return invoke<string>("rollback_tool", { tool, extraPaths: getExtraBackupPaths() });
}

/** Delete the .old backup for a single tool (checks bin/ + system paths) */
export async function cleanupToolBackup(tool: string): Promise<string> {
  return invoke<string>("cleanup_tool_backup", { tool, extraPaths: getExtraBackupPaths() });
}

/** Delete all .old backups (checks bin/ + system paths) */
export async function cleanupAllBackups(): Promise<string> {
  return invoke<string>("cleanup_all_backups", { extraPaths: getExtraBackupPaths() });
}

/** Download a URL directly to a local file (bypasses yt-dlp) */
export async function downloadUrlToFile(url: string, dest: string, referer?: string): Promise<string> {
  return invoke<string>("download_url_to_file", { url, dest, referer: referer ?? null });
}
