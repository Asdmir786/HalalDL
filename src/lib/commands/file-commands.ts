import { dirname } from "@tauri-apps/api/path";
import { invoke } from "@tauri-apps/api/core";
import { exists, readDir } from "@tauri-apps/plugin-fs";
import { revealItemInDir, openPath } from "@tauri-apps/plugin-opener";
import { useLogsStore } from "@/store/logs";
import { toast } from "sonner";

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

function getPathParts(path: string) {
  const slashIdx = path.lastIndexOf("/");
  const backslashIdx = path.lastIndexOf("\\");
  const lastSepIdx = Math.max(slashIdx, backslashIdx);
  const sep = backslashIdx >= slashIdx ? "\\" : "/";
  const dir = lastSepIdx >= 0 ? path.slice(0, lastSepIdx) : "";
  const base = lastSepIdx >= 0 ? path.slice(lastSepIdx + 1) : path;
  const dotIdx = base.lastIndexOf(".");
  const ext = dotIdx > 0 ? base.slice(dotIdx + 1) : "";
  const baseNoExt = dotIdx > 0 ? base.slice(0, dotIdx) : base;
  return { dir, base, ext, baseNoExt, sep };
}

function extractBracketedJobId(path: string): string | null {
  const match = path.match(/\[([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\]/i);
  return match?.[1] ?? null;
}

function looksFinalMediaName(name: string): boolean {
  return !name.endsWith(".part") && !name.includes(".converting.");
}

async function resolveExistingClipboardPath(path: string): Promise<string | null> {
  const normalized = normalizeFsPath(path);
  if (!normalized) return null;
  if (await exists(normalized)) return normalized;

  const { dir, baseNoExt } = getPathParts(normalized);
  if (!dir) return null;

  const entries = await readDir(dir);
  const files = entries
    .map((entry) => entry.name)
    .filter((name): name is string => Boolean(name));

  const jobId = extractBracketedJobId(normalized);
  if (jobId) {
    const byJobId = files.find((name) => name.includes(`[${jobId}]`) && looksFinalMediaName(name));
    if (byJobId) {
      return `${dir}\\${byJobId}`;
    }
  }

  const byStem = files.find((name) => name.startsWith(baseNoExt) && looksFinalMediaName(name));
  if (byStem) {
    return `${dir}\\${byStem}`;
  }

  return null;
}

async function waitForClipboardPaths(paths: string[]): Promise<string[]> {
  const attempts = 12;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const resolved = (
      await Promise.all(
        paths.map(async (path) => {
          try {
            return await resolveExistingClipboardPath(path);
          } catch {
            return null;
          }
        })
      )
    ).filter((value): value is string => Boolean(value));

    if (resolved.length > 0) {
      return resolved;
    }

    if (attempt < attempts - 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 150));
    }
  }

  return [];
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
  const requested = paths.map(normalizeFsPath).filter(Boolean);
  if (!requested.length) return;

  const resolved = await waitForClipboardPaths(requested);
  if (!resolved.length) {
    throw new Error("No valid files provided");
  }

  await invoke("copy_files_to_clipboard", { paths: resolved });
}

export async function readTextFromClipboard(): Promise<string> {
  return await invoke<string>("read_text_from_clipboard");
}

export async function deleteFile(path: string) {
  await invoke("delete_file", { path });
}

export async function renameFile(from: string, to: string) {
  await invoke("rename_file", { from, to });
}

export async function writeTextFile(path: string, contents: string) {
  await invoke("write_text_file", { path, contents });
}

export async function readTextFile(path: string): Promise<string> {
  return invoke<string>("read_text_file", { path });
}
