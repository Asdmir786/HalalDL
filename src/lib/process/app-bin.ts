import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { ToolResolution } from "@/lib/downloader/tool-env";

export type AppBinRunResult = {
  code: number | null;
  stdout: string;
  stderr: string;
};

type AppBinStreamEvent = {
  sessionId: string;
  kind: string;
  line?: string | null;
  code?: number | null;
};

/** Run an app-managed binary by absolute path (Portable/Full bin). */
export async function runAppBinTool(
  binaryName: string,
  args: string[],
  options?: {
    env?: Record<string, string>;
    timeoutMs?: number;
  }
): Promise<AppBinRunResult> {
  return invoke<AppBinRunResult>("run_app_bin_tool", {
    binaryName,
    args,
    env: options?.env ?? null,
    timeoutMs: options?.timeoutMs ?? null,
  });
}

export type SpawnedProcess = {
  /** True when process ended (useful for kill races). */
  finished: boolean;
  kill: () => Promise<void>;
  wait: () => Promise<number>;
};

/**
 * Prefer Rust absolute-path execution for managed tools; shell plugin for PATH tools.
 */
export async function runResolvedTool(
  tool: ToolResolution,
  binaryName: string,
  args: string[],
  options?: {
    env?: Record<string, string>;
    timeoutMs?: number;
  }
): Promise<AppBinRunResult> {
  if (tool.isLocal) {
    return runAppBinTool(binaryName, args, options);
  }

  // PATH / system tools still go through shell allowlist names (yt-dlp, ffmpeg, …).
  const { Command } = await import("@tauri-apps/plugin-shell");
  const cmd = Command.create(tool.command, args, options?.env ? { env: options.env } : undefined);
  let stdout = "";
  let stderr = "";
  let child: Awaited<ReturnType<typeof cmd.spawn>> | null = null;
  let settled = false;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutMs = options?.timeoutMs;

  cmd.stdout.on("data", (line) => {
    stdout += `${line}`;
  });
  cmd.stderr.on("data", (line) => {
    stderr += `${line}`;
  });

  try {
    return await new Promise<AppBinRunResult>((resolve, reject) => {
      const finish = (result: AppBinRunResult) => {
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

      if (timeoutMs && timeoutMs > 0) {
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
      }

      cmd
        .spawn()
        .then((spawned) => {
          child = spawned;
        })
        .catch((error) => {
          fail(new Error(String(error)));
        });
    });
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
}

/** Stream a managed-tool process (absolute path spawn). */
export async function spawnAppBinTool(
  binaryName: string,
  args: string[],
  handlers: {
    onStdout?: (line: string) => void;
    onStderr?: (line: string) => void;
  },
  options?: {
    env?: Record<string, string>;
  }
): Promise<SpawnedProcess> {
  const sessionId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `bin-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  let resolveWait: (code: number) => void = () => undefined;
  const waitPromise = new Promise<number>((resolve) => {
    resolveWait = resolve;
  });

  let finished = false;
  let pid = 0;
  let unlisten: UnlistenFn | null = null;

  unlisten = await listen<AppBinStreamEvent>("app-bin-stream", (event) => {
    const payload = event.payload;
    if (!payload || payload.sessionId !== sessionId) return;
    if (payload.kind === "stdout" && payload.line != null) {
      handlers.onStdout?.(payload.line);
    } else if (payload.kind === "stderr" && payload.line != null) {
      handlers.onStderr?.(payload.line);
    } else if (payload.kind === "closed") {
      finished = true;
      resolveWait(typeof payload.code === "number" ? payload.code : 1);
      void unlisten?.();
      unlisten = null;
    }
  });

  try {
    pid = await invoke<number>("start_app_bin_tool", {
      sessionId,
      binaryName,
      args,
      env: options?.env ?? null,
    });
  } catch (error) {
    void unlisten?.();
    throw error;
  }

  return {
    get finished() {
      return finished;
    },
    kill: async () => {
      if (finished) return;
      try {
        await invoke("kill_app_bin_tool", { pid });
      } catch {
        void 0;
      }
      finished = true;
      resolveWait(1);
      void unlisten?.();
      unlisten = null;
    },
    wait: () => waitPromise,
  };
}

/** Shell-plugin spawn for PATH tools; managed tools use absolute-path streaming. */
export async function spawnResolvedTool(
  tool: ToolResolution,
  binaryName: string,
  args: string[],
  handlers: {
    onStdoutChunk?: (chunk: string | Uint8Array) => void;
    onStderrChunk?: (chunk: string | Uint8Array) => void;
    onStdoutLine?: (line: string) => void;
    onStderrLine?: (line: string) => void;
  },
  options?: {
    env?: Record<string, string>;
    encoding?: "utf-8" | "raw";
  }
): Promise<SpawnedProcess> {
  if (tool.isLocal) {
    return spawnAppBinTool(
      binaryName,
      args,
      {
        onStdout: handlers.onStdoutLine,
        onStderr: handlers.onStderrLine,
      },
      { env: options?.env }
    );
  }

  const { Command } = await import("@tauri-apps/plugin-shell");
  const cmd = Command.create(
    tool.command,
    args,
    options?.env || options?.encoding
      ? { env: options?.env, encoding: options?.encoding }
      : undefined
  );

  let resolveWait: (code: number) => void = () => undefined;
  const waitPromise = new Promise<number>((resolve) => {
    resolveWait = resolve;
  });
  let finished = false;
  let child: Awaited<ReturnType<typeof cmd.spawn>> | null = null;

  if (handlers.onStdoutChunk) {
    cmd.stdout.on("data", (chunk) => handlers.onStdoutChunk?.(chunk));
  } else if (handlers.onStdoutLine) {
    cmd.stdout.on("data", (line) => handlers.onStdoutLine?.(String(line)));
  }
  if (handlers.onStderrChunk) {
    cmd.stderr.on("data", (chunk) => handlers.onStderrChunk?.(chunk));
  } else if (handlers.onStderrLine) {
    cmd.stderr.on("data", (line) => handlers.onStderrLine?.(String(line)));
  }

  cmd.on("close", (data) => {
    finished = true;
    resolveWait(typeof data.code === "number" ? data.code : 1);
  });
  cmd.on("error", () => {
    finished = true;
    resolveWait(1);
  });

  child = await cmd.spawn();

  return {
    get finished() {
      return finished;
    },
    kill: async () => {
      if (finished || !child) return;
      try {
        await child.kill();
      } catch {
        void 0;
      }
      finished = true;
      resolveWait(1);
    },
    wait: () => waitPromise,
  };
}
