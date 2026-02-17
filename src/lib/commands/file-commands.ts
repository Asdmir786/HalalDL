import { dirname } from "@tauri-apps/api/path";
import { invoke } from "@tauri-apps/api/core";
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
