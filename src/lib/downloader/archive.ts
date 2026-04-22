import { getAppPaths } from "@/lib/app-paths";
import { readTextFile, writeTextFile } from "@/lib/commands";

const ARCHIVE_DIR = "download-archive";
const APP_URL_ARCHIVE_FILE = "urls.txt";
const YT_DLP_ARCHIVE_FILE = "yt-dlp.txt";

function normalizeArchiveUrl(url: string) {
  return url.trim();
}

async function readAppArchiveEntries() {
  const { archiveDir } = await getAppPaths();
  const separator = archiveDir.includes("\\") ? "\\" : "/";
  const archivePath = `${archiveDir}${separator}${APP_URL_ARCHIVE_FILE}`;

  try {
    const raw = await readTextFile(archivePath);
    return new Set(
      raw
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
    );
  } catch {
    return new Set<string>();
  }
}

export async function getYtDlpArchivePath() {
  const { archiveDir } = await getAppPaths();
  const separator = archiveDir.includes("\\") ? "\\" : "/";
  return `${archiveDir}${separator}${YT_DLP_ARCHIVE_FILE}`;
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
  const { archiveDir } = await getAppPaths();
  const separator = archiveDir.includes("\\") ? "\\" : "/";
  const archivePath = `${archiveDir}${separator}${APP_URL_ARCHIVE_FILE}`;
  const content = `${Array.from(entries)
    .sort((a, b) => a.localeCompare(b))
    .join("\n")}\n`;
  await writeTextFile(archivePath, content);
}

export { ARCHIVE_DIR };
