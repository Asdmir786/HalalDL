import { appDataDir, join } from "@tauri-apps/api/path";
import { BaseDirectory, exists, mkdir, readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";

const ARCHIVE_DIR = "download-archive";
const APP_URL_ARCHIVE_REL_PATH = `${ARCHIVE_DIR}/urls.txt`;
const YT_DLP_ARCHIVE_FILE = "yt-dlp.txt";

async function ensureArchiveDir() {
  if (!(await exists(ARCHIVE_DIR, { baseDir: BaseDirectory.AppData }))) {
    await mkdir(ARCHIVE_DIR, { baseDir: BaseDirectory.AppData, recursive: true });
  }
}

function normalizeArchiveUrl(url: string) {
  return url.trim();
}

async function readAppArchiveEntries() {
  await ensureArchiveDir();
  if (!(await exists(APP_URL_ARCHIVE_REL_PATH, { baseDir: BaseDirectory.AppData }))) {
    return new Set<string>();
  }

  const raw = await readTextFile(APP_URL_ARCHIVE_REL_PATH, { baseDir: BaseDirectory.AppData });
  return new Set(
    raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
  );
}

export async function getYtDlpArchivePath() {
  await ensureArchiveDir();
  const dataDir = await appDataDir();
  return join(dataDir, ARCHIVE_DIR, YT_DLP_ARCHIVE_FILE);
}

export async function isUrlInAppArchive(url: string) {
  const normalized = normalizeArchiveUrl(url);
  if (!normalized) return false;
  const entries = await readAppArchiveEntries();
  return entries.has(normalized);
}

export async function addUrlToAppArchive(url: string) {
  const normalized = normalizeArchiveUrl(url);
  if (!normalized) return;

  const entries = await readAppArchiveEntries();
  if (entries.has(normalized)) return;

  entries.add(normalized);
  const content = `${Array.from(entries).sort((a, b) => a.localeCompare(b)).join("\n")}\n`;
  await writeTextFile(APP_URL_ARCHIVE_REL_PATH, content, { baseDir: BaseDirectory.AppData });
}
