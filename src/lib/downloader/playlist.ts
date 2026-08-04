import { getAppPaths } from "@/lib/app-paths";
import { runResolvedTool } from "@/lib/process/app-bin";
import { appendCookiesArgs } from "./cookies";
import { resolveTool, ytDlpEnv } from "./tool-env";

export type PlaylistEntry = {
  /** Stable UI key (id + index). */
  key: string;
  /** yt-dlp / site media id when present. */
  id: string;
  /** 1-based playlist index when known. */
  index?: number;
  title: string;
  /** Canonical playable URL for a single-item job. */
  url: string;
  durationSeconds?: number;
};

export type PlaylistScanResult = {
  title?: string;
  count?: number;
  entries: PlaylistEntry[];
  truncated: boolean;
};

/** Max entries shown / queued from one scan (keeps UI + concurrency sane). */
export const PLAYLIST_ENTRY_LIMIT = 400;

/**
 * Heuristic: URL likely lists multiple videos (not a single watch without list=).
 * Instagram carousels are handled elsewhere and return false.
 */
export function looksLikePlaylistUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;

  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.replace(/^www\./i, "").toLowerCase();
    const path = parsed.pathname.toLowerCase();
    const list = parsed.searchParams.get("list")?.trim() || "";

    // YouTube / YouTube Music playlists and list= watch links
    if (
      host === "youtube.com" ||
      host === "m.youtube.com" ||
      host === "music.youtube.com" ||
      host === "youtu.be"
    ) {
      if (path.includes("/playlist")) return true;
      if (list && !list.startsWith("UL") && list !== "LL") return true;
      return false;
    }

    // Common multi-item hosts
    if (host.endsWith("soundcloud.com") && (path.includes("/sets/") || path.includes("/playlists/"))) {
      return true;
    }
    if (host.endsWith("vimeo.com") && path.includes("/showcase/")) {
      return true;
    }
    if (host.endsWith("dailymotion.com") && path.includes("/playlist/")) {
      return true;
    }

    // Generic playlist path token
    if (/\/(playlist|playlists|sets)\b/i.test(path)) {
      return true;
    }
  } catch {
    const lower = trimmed.toLowerCase();
    if (lower.includes("list=") || lower.includes("/playlist")) return true;
  }

  return false;
}

/**
 * YouTube URL has both a video id and a playlist list= — user may want only the open video.
 */
export function canPreferSingleVideoFromUrl(url: string): boolean {
  try {
    const parsed = new URL(url.trim());
    const host = parsed.hostname.replace(/^www\./i, "").toLowerCase();
    const isYt =
      host === "youtube.com" ||
      host === "m.youtube.com" ||
      host === "music.youtube.com" ||
      host === "youtu.be";
    if (!isYt) return false;
    const list = parsed.searchParams.get("list")?.trim() || "";
    if (!list || list.startsWith("UL") || list === "LL") return false;
    if (host === "youtu.be") {
      const id = parsed.pathname.replace(/^\//, "").split("/")[0];
      return Boolean(id);
    }
    return Boolean(parsed.searchParams.get("v")?.trim());
  } catch {
    return false;
  }
}

/** Canonical single-video URL when a list= watch link also identifies a video. */
export function singleVideoUrlFromMixedUrl(url: string): string | null {
  if (!canPreferSingleVideoFromUrl(url)) return null;
  try {
    const parsed = new URL(url.trim());
    const host = parsed.hostname.replace(/^www\./i, "").toLowerCase();
    if (host === "youtu.be") {
      const id = parsed.pathname.replace(/^\//, "").split("/")[0];
      return id ? `https://www.youtube.com/watch?v=${encodeURIComponent(id)}` : null;
    }
    const videoId = parsed.searchParams.get("v")?.trim();
    if (!videoId) return null;
    return `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
  } catch {
    return null;
  }
}

function buildFallbackUrl(id: string, originalUrl: string): string {
  if (!id) return originalUrl;
  try {
    const host = new URL(originalUrl).hostname.replace(/^www\./i, "").toLowerCase();
    if (
      host === "youtube.com" ||
      host === "m.youtube.com" ||
      host === "music.youtube.com" ||
      host === "youtu.be"
    ) {
      return `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`;
    }
  } catch {
    // fall through
  }
  return originalUrl;
}

function parsePlaylistPrintLine(line: string, originalUrl: string, fallbackIndex: number): PlaylistEntry | null {
  const parts = line.split("\t");
  if (parts.length < 3) return null;

  const indexRaw = parts[0]?.trim() ?? "";
  const id = (parts[1]?.trim() || indexRaw || `item-${fallbackIndex}`).trim();
  const title = (parts[2]?.trim() || `Item ${fallbackIndex}`).trim();
  const webpageOrUrl = (parts[3]?.trim() || "").trim();
  const durationRaw = parts[4]?.trim() ?? "";

  const indexNum = Number(indexRaw);
  const index = Number.isFinite(indexNum) && indexNum > 0 ? Math.floor(indexNum) : fallbackIndex;

  let entryUrl = webpageOrUrl;
  if (!entryUrl || entryUrl === "NA" || entryUrl === "None") {
    entryUrl = buildFallbackUrl(id, originalUrl);
  }
  if (!/^https?:\/\//i.test(entryUrl)) {
    entryUrl = buildFallbackUrl(id, originalUrl);
  }

  // Skip the playlist container itself when print accidentally emits it
  if (!id || id === "NA") return null;

  const duration = Number(durationRaw);
  return {
    key: `${id}:${index}`,
    id,
    index,
    title: title === "NA" || title === "None" ? `Item ${index}` : title,
    url: entryUrl,
    durationSeconds: Number.isFinite(duration) && duration > 0 ? duration : undefined,
  };
}

/**
 * Flat-list playlist members without downloading.
 * Keeps `--flat-playlist` and never downloads media; results become single-URL jobs.
 */
export async function fetchPlaylistEntries(url: string): Promise<PlaylistScanResult> {
  const ytDlp = await resolveTool("yt-dlp");
  const args = [
    "--flat-playlist",
    "--skip-download",
    "--ignore-config",
    "--no-warnings",
    "--print",
    "%(playlist_index)s\t%(id)s\t%(title)s\t%(webpage_url)s\t%(duration)s",
    url,
  ];

  appendCookiesArgs(args);

  try {
    const { ytdlpCacheDir } = await getAppPaths();
    args.splice(0, 0, "--cache-dir", ytdlpCacheDir);
  } catch {
    // default cache
  }

  const result = await runResolvedTool(ytDlp, "yt-dlp", args, {
    env: ytDlpEnv(),
    timeoutMs: 120000,
  });

  if (result.code !== 0) {
    const err = result.stderr.trim() || result.stdout.trim() || `yt-dlp exited with code ${result.code}`;
    throw new Error(err.slice(0, 400));
  }

  const lines = result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const entries: PlaylistEntry[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    const entry = parsePlaylistPrintLine(line, url, entries.length + 1);
    if (!entry) continue;
    if (seen.has(entry.key)) continue;
    // Drop rows that still point at the playlist URL itself with no real media id
    if (entry.url === url && entries.length === 0 && lines.length > 1) {
      // keep; may be first video
    }
    seen.add(entry.key);
    entries.push(entry);
    if (entries.length >= PLAYLIST_ENTRY_LIMIT) break;
  }

  if (entries.length === 0) {
    throw new Error("No playlist items found. The list may be private (try cookies.txt) or empty.");
  }

  return {
    entries,
    count: entries.length,
    truncated: lines.length > entries.length || entries.length >= PLAYLIST_ENTRY_LIMIT,
  };
}
