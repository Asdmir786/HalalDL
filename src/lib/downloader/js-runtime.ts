import { invoke } from "@tauri-apps/api/core";
import { useLogsStore } from "@/store/logs";
import { useSettingsStore } from "@/store/settings";
import { useDenoJsRuntimeStore, type DenoRuntimeCandidate } from "@/store/deno-js-runtime";
import { getAppMode } from "@/lib/tools/app-mode";
import { isDemoModeEnabled } from "@/lib/demo-mode";
import { resolveTool, isYouTubeUrl } from "./tool-env";

export type { DenoRuntimeCandidate };

let liteDetectPromise: Promise<string | null> | null = null;
let pickerShownThisSession = false;
let missingShownThisSession = false;
let skipLogged = false;
let usedRuntimeLoggedFor = "";
let promptWaiters: Array<(path: string | null) => void> = [];

function waitForLitePrompt(): Promise<string | null> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (path: string | null) => {
      if (settled) return;
      settled = true;
      resolve(path);
    };
    promptWaiters.push(finish);
    window.setTimeout(() => finish(null), 90_000);
  });
}

function settleLitePrompt(path: string | null): void {
  const waiters = promptWaiters;
  promptWaiters = [];
  for (const waiter of waiters) waiter(path);
}

export async function resolveSystemToolPaths(tool: string): Promise<string[]> {
  const paths = await invoke<string[]>("resolve_system_tool_paths", { tool });
  return Array.isArray(paths) ? paths.filter((path) => path.trim()) : [];
}

export async function probeExecutableVersion(path: string): Promise<string | null> {
  try {
    const line = await invoke<string | null>("probe_executable_version", { path });
    return line?.trim() || null;
  } catch {
    return null;
  }
}

export function parseDenoVersionLine(line?: string | null): string | undefined {
  if (!line) return undefined;
  const match = line.match(/deno\s+(\S+)/i);
  return match?.[1] || line.trim() || undefined;
}

function samePath(a: string, b: string): boolean {
  return a.trim().replace(/\//g, "\\").toLowerCase() === b.trim().replace(/\//g, "\\").toLowerCase();
}

function getPersistedDenoPath(): string {
  return useSettingsStore.getState().settings.denoJsRuntimePath?.trim() ?? "";
}

function wasDenoSkipped(): boolean {
  return useSettingsStore.getState().settings.denoJsRuntimeSkipped === true;
}

export function persistDenoJsRuntimePath(path: string): void {
  const trimmed = path.trim();
  useSettingsStore.getState().updateSettings({
    denoJsRuntimePath: trimmed,
    denoJsRuntimeSkipped: false,
  });
}

export function persistDenoJsRuntimeSkipped(): void {
  useSettingsStore.getState().updateSettings({
    denoJsRuntimeSkipped: true,
  });
}

async function decorateCandidates(paths: string[]): Promise<DenoRuntimeCandidate[]> {
  return Promise.all(
    paths.map(async (path) => ({
      path,
      version: parseDenoVersionLine(await probeExecutableVersion(path)),
    }))
  );
}

/** App-managed deno.exe in bin, if present (Full / Portable / Lite after Tools download). */
export async function resolveAppManagedDenoPath(): Promise<string | null> {
  const tool = await resolveTool("deno");
  if (tool.isLocal && tool.path && tool.path !== "deno") {
    return tool.path;
  }
  return null;
}

/**
 * Path to pass as `--js-runtimes deno:<path>`, or null to omit the flag.
 * Does not search PATH or open UI — Lite detection happens via `ensureLiteDenoJsRuntime`.
 */
export async function resolveDenoJsRuntimePath(): Promise<string | null> {
  const managed = await resolveAppManagedDenoPath();
  if (managed) return managed;

  const persisted = getPersistedDenoPath();
  return persisted || null;
}

export type LiteDenoEnsureReason = "tools" | "youtube";

/**
 * Lite-only: search PATH for deno.exe.
 * One match is stored automatically. Several matches open a picker card.
 * None opens a missing card unless the user already skipped.
 */
export async function ensureLiteDenoJsRuntime(
  reason: LiteDenoEnsureReason
): Promise<string | null> {
  if (getAppMode() !== "LITE" || isDemoModeEnabled()) {
    return resolveDenoJsRuntimePath();
  }

  const existing = await resolveDenoJsRuntimePath();
  if (existing) return existing;

  if (liteDetectPromise) return liteDetectPromise;

  liteDetectPromise = (async () => {
    try {
      const paths = await resolveSystemToolPaths("deno");
      const persisted = getPersistedDenoPath();
      if (persisted && paths.some((path) => samePath(path, persisted))) {
        return persisted;
      }

      if (paths.length === 1) {
        persistDenoJsRuntimePath(paths[0]);
        return paths[0];
      }

      if (paths.length > 1) {
        if (!pickerShownThisSession) {
          pickerShownThisSession = true;
          const candidates = await decorateCandidates(paths);
          useDenoJsRuntimeStore.getState().openPicker(candidates);
        }
        if (reason === "youtube") {
          return waitForLitePrompt();
        }
        return null;
      }

      if (!wasDenoSkipped() && (reason === "tools" || reason === "youtube")) {
        if (!missingShownThisSession) {
          missingShownThisSession = true;
          useDenoJsRuntimeStore.getState().openMissing();
        }
        if (reason === "youtube") {
          return waitForLitePrompt();
        }
      }
      return null;
    } catch {
      return null;
    } finally {
      liteDetectPromise = null;
    }
  })();

  return liteDetectPromise;
}

export async function confirmLiteDenoJsRuntime(path: string): Promise<void> {
  persistDenoJsRuntimePath(path);
  pickerShownThisSession = true;
  missingShownThisSession = true;
  useDenoJsRuntimeStore.getState().closePrompt();
  settleLitePrompt(path.trim() || null);
}

export function skipLiteDenoJsRuntimePrompt(): void {
  persistDenoJsRuntimeSkipped();
  missingShownThisSession = true;
  useDenoJsRuntimeStore.getState().closePrompt();
  settleLitePrompt(null);
}

/** Close without skipping forever — used when sending the user to Tools. */
export function closeLiteDenoJsRuntimePrompt(): void {
  missingShownThisSession = true;
  pickerShownThisSession = true;
  useDenoJsRuntimeStore.getState().closePrompt();
  settleLitePrompt(null);
}

export function dismissLiteDenoPickerForSession(): void {
  pickerShownThisSession = true;
  useDenoJsRuntimeStore.getState().closePrompt();
  settleLitePrompt(null);
}

/**
 * Append `--js-runtimes deno:<absolute-path>` when a Deno binary is resolved.
 * Lite may search PATH / prompt on YouTube use; missing Deno is never required.
 */
export async function appendJsRuntimeArgs(args: string[], url?: string): Promise<void> {
  if (args.includes("--js-runtimes")) return;

  if (
    getAppMode() === "LITE" &&
    !isDemoModeEnabled() &&
    !getPersistedDenoPath() &&
    !(await resolveAppManagedDenoPath()) &&
    url &&
    isYouTubeUrl(url)
  ) {
    await ensureLiteDenoJsRuntime("youtube");
  }

  const path = await resolveDenoJsRuntimePath();
  const { addLog } = useLogsStore.getState();

  if (!path) {
    if (!skipLogged) {
      skipLogged = true;
      addLog({
        level: "info",
        message: "No Deno JS runtime found",
      });
    }
    return;
  }

  args.push("--js-runtimes", `deno:${path}`);
  if (usedRuntimeLoggedFor !== path) {
    usedRuntimeLoggedFor = path;
    addLog({
      level: "info",
      message: `Using Deno JS runtime: ${path}`,
    });
  }
}
