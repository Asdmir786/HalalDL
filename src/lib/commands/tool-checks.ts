import { Command } from "@tauri-apps/plugin-shell";
import { useLogsStore } from "@/store/logs";
import { invoke } from "@tauri-apps/api/core";
import { resolveTool } from "@/lib/downloader/tool-env";
import { fetchText, fetchJson } from "./version-utils";

export interface ToolCheckResult {
  version: string;
  variant: string;
  systemPath?: string;
}

export async function resolveSystemToolPath(tool: string): Promise<string | null> {
  return invoke<string | null>("resolve_system_tool_path", { tool });
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

      let variant = tool.isLocal ? "Bundled" : "System";
      if (!tool.isLocal) {
        try {
          const pipCmd = Command.create("pip", ["show", "yt-dlp"]);
          const pipOut = await pipCmd.execute();
          if (pipOut.code === 0 && pipOut.stdout.toLowerCase().includes("name: yt-dlp")) {
            variant = "pip";
          }
        } catch {
          try {
            const pip3Cmd = Command.create("pip3", ["show", "yt-dlp"]);
            const pip3Out = await pip3Cmd.execute();
            if (pip3Out.code === 0 && pip3Out.stdout.toLowerCase().includes("name: yt-dlp")) {
              variant = "pip";
            }
          } catch {
            // neither pip nor pip3 available
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
      const dateGitMatch = rawVersion.match(/^(\d{4})-(\d{2})-(\d{2})-git-([0-9a-f]+)/i);
      const nightlyWithDateMatch = rawVersion.match(/^N-\d+-g([0-9a-f]+)-(\d{4})(\d{2})(\d{2})$/i);
      let version: string;
      const releaseMatch = rawVersion.match(/^(\d+(?:\.\d+)*)/);
      const nightlyMatch = rawVersion.match(/^(N-\d+)/i);
      if (dateGitMatch) {
        version = `${dateGitMatch[1]}-${dateGitMatch[2]}-${dateGitMatch[3]}-git-${dateGitMatch[4].toLowerCase()}`;
      } else if (nightlyWithDateMatch) {
        version = `${nightlyWithDateMatch[2]}-${nightlyWithDateMatch[3]}-${nightlyWithDateMatch[4]}-git-${nightlyWithDateMatch[1].toLowerCase()}`;
      } else if (releaseMatch) {
        version = releaseMatch[1];
      } else if (nightlyMatch) {
        version = nightlyMatch[1];
      } else {
        version = rawVersion || firstLine || "Detected";
      }

      const lower = firstLine.toLowerCase();
      const pathLower = (tool.path || "").toLowerCase();
      let variant = tool.isLocal ? "Bundled" : "System";
      if (nightlyMatch || dateGitMatch || nightlyWithDateMatch || lower.includes("-git-")) {
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
