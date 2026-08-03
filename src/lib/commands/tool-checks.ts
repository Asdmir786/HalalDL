import { Command } from "@tauri-apps/plugin-shell";
import { useLogsStore } from "@/store/logs";
import { invoke } from "@tauri-apps/api/core";
import { resolveTool } from "@/lib/downloader/tool-env";
import { fetchText, fetchJson } from "./version-utils";

export interface ToolCheckResult {
  version: string;
  variant: string;
  systemPath?: string;
  isLocal?: boolean;
  usingFallback?: boolean;
}

const TOOL_CHECK_TIMEOUT_MS = 8000;

async function executeWithTimeout(
  program: string,
  args: string[],
  timeoutMs = TOOL_CHECK_TIMEOUT_MS
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  const cmd = Command.create(program, args);
  let stdout = "";
  let stderr = "";
  let child: Awaited<ReturnType<typeof cmd.spawn>> | null = null;
  let settled = false;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  cmd.stdout.on("data", (line) => {
    stdout += `${line}`;
  });
  cmd.stderr.on("data", (line) => {
    stderr += `${line}`;
  });

  try {
    return await new Promise<{ code: number | null; stdout: string; stderr: string }>(
      (resolve, reject) => {
        const finish = (result: { code: number | null; stdout: string; stderr: string }) => {
          if (settled) return;
          settled = true;
          if (timeoutId !== undefined) clearTimeout(timeoutId);
          resolve(result);
        };
        const fail = (error: Error) => {
          if (settled) return;
          settled = true;
          if (timeoutId !== undefined) clearTimeout(timeoutId);
          reject(error);
        };

        cmd.on("close", (data) => {
          const code = typeof data.code === "number" ? data.code : null;
          finish({ code, stdout, stderr });
        });
        cmd.on("error", (error) => {
          fail(new Error(String(error)));
        });

        timeoutId = setTimeout(() => {
          void (async () => {
            try {
              if (child) await child.kill();
            } catch {
              void 0;
            }
            fail(new Error(`Timed out after ${timeoutMs}ms`));
          })();
        }, timeoutMs);

        cmd
          .spawn()
          .then((spawned) => {
            child = spawned;
          })
          .catch((error) => {
            fail(new Error(String(error)));
          });
      }
    );
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
}

export async function resolveSystemToolPath(tool: string): Promise<string | null> {
  return invoke<string | null>("resolve_system_tool_path", { tool });
}

/** Cheap path heuristic: pip installs land under Scripts or site-packages. */
export function isYtDlpPipPath(path?: string | null): boolean {
  if (!path) return false;
  const lower = path.toLowerCase().replace(/\\/g, "/");
  const base = lower.split("/").pop() || "";
  if (!(base === "yt-dlp" || base === "yt-dlp.exe" || base.startsWith("yt-dlp."))) {
    return false;
  }
  return lower.includes("/scripts/") || lower.includes("/site-packages/");
}

export function isPipYtDlpTool(tool: {
  id: string;
  variant?: string;
  systemPath?: string;
  path?: string;
}): boolean {
  if (tool.id !== "yt-dlp") return false;
  if (tool.variant?.toLowerCase() === "pip") return true;
  return isYtDlpPipPath(tool.systemPath) || isYtDlpPipPath(tool.path);
}

function detectYtDlpPipVariant(path?: string | null): string | null {
  return isYtDlpPipPath(path) ? "pip" : null;
}

export async function checkYtDlpVersion(): Promise<ToolCheckResult | null> {
  const { addLog } = useLogsStore.getState();
  try {
    const tool = await resolveTool("yt-dlp");

    if (tool.isLocal) {
      addLog({
        level: "command",
        message: "Checking app-managed yt-dlp (Portable/Full bin preferred over pip/PATH)...",
        command: `${tool.path} --version`,
      });
      try {
        const output = await executeWithTimeout(tool.command, ["--version"]);
        if (output.code === 0) {
          const version = output.stdout.trim();
          addLog({
            level: "info",
            message: `yt-dlp ${version || "Detected"} (Bundled) at ${tool.path}`,
          });
          return {
            version,
            variant: "Bundled",
            systemPath: tool.path,
            isLocal: true,
            usingFallback: false,
          };
        }
        addLog({
          level: "warn",
          message: `App-managed yt-dlp returned code ${output.code}; checking for a system fallback (pip/PATH)...`,
        });
      } catch (e) {
        addLog({
          level: "warn",
          message: `App-managed yt-dlp check failed (${String(e)}); checking for a system fallback (pip/PATH)...`,
        });
      }
    } else {
      addLog({
        level: "info",
        message:
          "No app-managed yt-dlp in bin (Portable: portable-data\\bin, Full: AppData\\bin); checking system/PATH/pip fallback...",
      });
    }

    const systemPath = await resolveSystemToolPath("yt-dlp").catch(() => null);
    if (!systemPath && !tool.isLocal) {
      // Last-chance PATH spawn with a short timeout (covers non-.exe launchers).
      addLog({
        level: "command",
        message: "Probing PATH for yt-dlp...",
        command: "yt-dlp --version",
      });
      try {
        const output = await executeWithTimeout("yt-dlp", ["--version"], TOOL_CHECK_TIMEOUT_MS);
        if (output.code === 0) {
          const version = output.stdout.trim();
          const variant = "System";
          addLog({
            level: "info",
            message: `Using system/PATH fallback yt-dlp ${version || "Detected"} (${variant})`,
          });
          return {
            version,
            variant,
            systemPath: undefined,
            isLocal: false,
            usingFallback: true,
          };
        }
      } catch (e) {
        addLog({ level: "warn", message: `PATH yt-dlp probe failed: ${String(e)}` });
      }

      addLog({
        level: "warn",
        message: "yt-dlp is unavailable (no app-managed binary and none on PATH)",
      });
      return null;
    }

    const command = tool.isLocal ? "yt-dlp" : tool.command;
    const probePath = systemPath || "yt-dlp";
    addLog({
      level: "command",
      message: "Checking system/PATH yt-dlp fallback...",
      command: `${probePath} --version`,
    });
    const output = await executeWithTimeout(command, ["--version"]);
    if (output.code === 0) {
      const version = output.stdout.trim();
      const pipVariant = detectYtDlpPipVariant(systemPath);
      const variant = pipVariant ?? "System";
      const resolvedPath = systemPath ?? undefined;
      addLog({
        level: "info",
        message: `Using system/PATH fallback yt-dlp ${version || "Detected"} (${variant})${
          resolvedPath ? ` at ${resolvedPath}` : ""
        }`,
      });
      return {
        version,
        variant,
        systemPath: resolvedPath,
        isLocal: false,
        usingFallback: true,
      };
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
    if (!tool.isLocal) {
      const systemPath = await resolveSystemToolPath("ffmpeg").catch(() => null);
      if (!systemPath) {
        addLog({ level: "warn", message: "ffmpeg is unavailable (no app-managed binary and none on PATH)" });
        return null;
      }
    }

    addLog({ level: "command", message: "Checking for ffmpeg binary...", command: `${tool.path} -version` });
    const output = await executeWithTimeout(tool.command, ["-version"]);
    if (output.code === 0) {
      const firstLine = output.stdout.split("\n")[0] || "";
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
      return {
        version,
        variant,
        systemPath: systemPath ?? undefined,
        isLocal: tool.isLocal,
        usingFallback: !tool.isLocal,
      };
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
    if (!tool.isLocal) {
      const systemPath = await resolveSystemToolPath("aria2").catch(() => null);
      if (!systemPath) {
        addLog({ level: "warn", message: "aria2c is unavailable (no app-managed binary and none on PATH)" });
        return null;
      }
    }

    addLog({ level: "command", message: "Checking for aria2c binary...", command: `${tool.path} --version` });
    const output = await executeWithTimeout(tool.command, ["--version"]);
    if (output.code === 0) {
      const firstLine = output.stdout.split("\n")[0] || "";
      const versionMatch = firstLine.match(/version\s+(\S+)/i);
      const version = versionMatch ? versionMatch[1] : (firstLine || "Detected");
      const variant = tool.isLocal ? "Bundled" : "System";

      const systemPath = !tool.isLocal
        ? await resolveSystemToolPath("aria2").catch(() => null)
        : tool.path;

      addLog({ level: "info", message: `aria2c ${version} (${variant}) at ${systemPath || tool.path}` });
      return {
        version,
        variant,
        systemPath: systemPath ?? undefined,
        isLocal: tool.isLocal,
        usingFallback: !tool.isLocal,
      };
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
    if (!tool.isLocal) {
      const systemPath = await resolveSystemToolPath("deno").catch(() => null);
      if (!systemPath) {
        addLog({ level: "warn", message: "deno is unavailable (no app-managed binary and none on PATH)" });
        return null;
      }
    }

    addLog({ level: "command", message: "Checking for deno binary...", command: `${tool.path} --version` });
    const output = await executeWithTimeout(tool.command, ["--version"]);
    if (output.code === 0) {
      const firstLine = output.stdout.split("\n")[0] || "";
      const versionMatch = firstLine.match(/deno\s+(\S+)/i);
      const version = versionMatch ? versionMatch[1] : (firstLine || "Detected");
      const variant = tool.isLocal ? "Bundled" : "System";

      const systemPath = !tool.isLocal
        ? await resolveSystemToolPath("deno").catch(() => null)
        : tool.path;

      addLog({ level: "info", message: `deno ${version} (${variant}) at ${systemPath || tool.path}` });
      return {
        version,
        variant,
        systemPath: systemPath ?? undefined,
        isLocal: tool.isLocal,
        usingFallback: !tool.isLocal,
      };
    }
    addLog({ level: "warn", message: `deno version check returned code ${output.code}` });
  } catch (e) {
    addLog({ level: "error", message: `deno check failed: ${String(e)}` });
  }
  return null;
}

export async function upgradeYtDlpViaPip(systemPath?: string | null): Promise<boolean> {
  const { addLog } = useLogsStore.getState();
  try {
    addLog({
      level: "command",
      message: "Upgrading yt-dlp via pip...",
      command: `invoke("upgrade_ytdlp_via_pip", { systemPath: ${JSON.stringify(systemPath ?? null)} })`,
    });
    const result = await invoke<string>("upgrade_ytdlp_via_pip", {
      systemPath: systemPath ?? null,
    });
    addLog({ level: "info", message: result });
    return true;
  } catch (e) {
    addLog({ level: "error", message: `pip upgrade failed: ${String(e)}` });
    for (const pipCmd of ["pip", "pip3"]) {
      try {
        addLog({
          level: "command",
          message: `Upgrading yt-dlp via ${pipCmd}...`,
          command: `${pipCmd} install --upgrade yt-dlp`,
        });
        const cmd = Command.create(pipCmd, ["install", "--upgrade", "yt-dlp"]);
        const output = await cmd.execute();
        if (output.code === 0) {
          addLog({ level: "info", message: `yt-dlp upgraded via ${pipCmd}` });
          return true;
        }
        addLog({
          level: "warn",
          message: `${pipCmd} upgrade returned code ${output.code}: ${output.stderr}`,
        });
      } catch (err) {
        addLog({ level: "debug", message: `${pipCmd} not available: ${String(err)}` });
      }
    }
    return false;
  }
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
