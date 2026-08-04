import { convertFileSrc } from "@tauri-apps/api/core";
import { useDownloadsStore } from "@/store/downloads";
import type { DownloadJob } from "@/store/downloads";
import { useLogsStore } from "@/store/logs";
import { useSettingsStore } from "@/store/settings";
import { join } from "@tauri-apps/api/path";
import { exists } from "@tauri-apps/plugin-fs";
import { downloadUrlToFile } from "@/lib/commands";
import { isInstagramUrl } from "@/lib/media-engine";
import { getExplicitOutputPaths } from "@/lib/output-paths";
import { resolveTool, ytDlpEnv, isYouTubeUrl } from "./tool-env";
import { runResolvedTool } from "@/lib/process/app-bin";
import { getAppPaths } from "@/lib/app-paths";
import { fetchInstagramMediaInfo } from "./instagram";
import {
  ensureThumbnailDir,
  thumbnailAssetUrl,
  generateThumbnailContactSheet,
  generateThumbnailFromMediaUrl,
} from "./thumbnails";

const IMAGE_FILE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "gif", "bmp", "avif"]);
const VIDEO_FILE_EXTENSIONS = new Set(["mp4", "mov", "webm", "mkv", "avi", "m4v"]);

export interface MediaFormatOption {
  /** Stable id for UI keys, e.g. "h:1080" or "audio". */
  id: string;
  /** Short label shown in the preview, e.g. "1080p" or "Audio". */
  label: string;
  height?: number;
  fps?: number;
  ext?: string;
  hasVideo: boolean;
  hasAudio: boolean;
  filesizeBytes?: number;
  /** Optional note such as "60fps" or "HDR". */
  note?: string;
  /** yt-dlp `-f` expression when the user picks this quality later. */
  formatSelector: string;
}

export interface MediaMetadataProbe {
  title: string;
  thumbnailUrl: string;
  uploader?: string;
  mediaDurationSeconds?: number;
  mediaCollectionSummary?: DownloadJob["mediaCollectionSummary"];
  hasManualSubtitles: boolean;
  hasAutoSubtitles: boolean;
  availableSubtitleLanguages: string[];
  /** Curated quality options derived from yt-dlp `formats`. */
  formats: MediaFormatOption[];
}

function isTauriLocalAssetUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.hostname === "tauri.localhost" || parsed.hostname === "asset.localhost";
  } catch {
    return false;
  }
}

function extractLanguageKeys(value: unknown): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return Object.keys(value as Record<string, unknown>)
    .map((key) => key.trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
}

function isNoneCodec(value: unknown): boolean {
  if (value == null) return true;
  const text = String(value).trim().toLowerCase();
  return !text || text === "none";
}

function pickFilesize(entry: Record<string, unknown>): number | undefined {
  const exact = Number(entry.filesize);
  if (Number.isFinite(exact) && exact > 0) return exact;
  const approx = Number(entry.filesize_approx);
  if (Number.isFinite(approx) && approx > 0) return approx;
  return undefined;
}

function formatNoteFromEntry(entry: Record<string, unknown>, fps?: number): string | undefined {
  const bits: string[] = [];
  if (fps && fps >= 50) bits.push(`${Math.round(fps)}fps`);
  const dynamicRange = String(entry.dynamic_range ?? "").trim().toUpperCase();
  if (dynamicRange && dynamicRange !== "SDR") bits.push(dynamicRange);
  const note = String(entry.format_note ?? "").trim();
  if (note && /hdr|hlg|dv/i.test(note) && !bits.some((bit) => /hdr|hlg|dv/i.test(bit))) {
    bits.push(note);
  }
  return bits.length > 0 ? bits.join(" · ") : undefined;
}

/**
 * Collapse yt-dlp's raw `formats` list into a short quality chip list:
 * unique video heights (best file for each) plus one audio option when present.
 */
export function summarizeMediaFormats(rawFormats: unknown): MediaFormatOption[] {
  if (!Array.isArray(rawFormats)) return [];

  type HeightBucket = {
    height: number;
    fps?: number;
    ext?: string;
    filesizeBytes?: number;
    note?: string;
    hasAudio: boolean;
  };

  const byHeight = new Map<number, HeightBucket>();
  let bestAudio:
    | {
        ext?: string;
        filesizeBytes?: number;
      }
    | undefined;

  for (const item of rawFormats) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const entry = item as Record<string, unknown>;
    const hasVideo = !isNoneCodec(entry.vcodec);
    const hasAudio = !isNoneCodec(entry.acodec);
    if (!hasVideo && !hasAudio) continue;

    const height = Number(entry.height);
    const fpsRaw = Number(entry.fps);
    const fps = Number.isFinite(fpsRaw) && fpsRaw > 0 ? fpsRaw : undefined;
    const ext = String(entry.ext ?? "").trim().toLowerCase() || undefined;
    const filesizeBytes = pickFilesize(entry);

    if (hasVideo && Number.isFinite(height) && height > 0) {
      const existing = byHeight.get(height);
      const candidate: HeightBucket = {
        height,
        fps,
        ext,
        filesizeBytes,
        note: formatNoteFromEntry(entry, fps),
        hasAudio,
      };

      if (!existing) {
        byHeight.set(height, candidate);
      } else {
        const existingScore =
          (existing.filesizeBytes ?? 0) + (existing.hasAudio ? 1_000_000_000 : 0) + (existing.fps ?? 0);
        const candidateScore =
          (candidate.filesizeBytes ?? 0) + (candidate.hasAudio ? 1_000_000_000 : 0) + (candidate.fps ?? 0);
        if (candidateScore >= existingScore) {
          byHeight.set(height, candidate);
        }
      }
      continue;
    }

    if (!hasVideo && hasAudio) {
      if (!bestAudio || (filesizeBytes ?? 0) >= (bestAudio.filesizeBytes ?? 0)) {
        bestAudio = { ext, filesizeBytes };
      }
    }
  }

  const heights = Array.from(byHeight.values()).sort((a, b) => b.height - a.height);
  const options: MediaFormatOption[] = heights.slice(0, 8).map((bucket) => ({
    id: `h:${bucket.height}`,
    label: `${bucket.height}p`,
    height: bucket.height,
    fps: bucket.fps,
    ext: bucket.ext,
    hasVideo: true,
    hasAudio: bucket.hasAudio,
    filesizeBytes: bucket.filesizeBytes,
    note: bucket.note,
    formatSelector: `bv*[height<=${bucket.height}]+ba/b[height<=${bucket.height}]`,
  }));

  if (bestAudio || options.some((option) => option.hasAudio)) {
    options.push({
      id: "audio",
      label: "Audio",
      ext: bestAudio?.ext,
      hasVideo: false,
      hasAudio: true,
      filesizeBytes: bestAudio?.filesizeBytes,
      formatSelector: "bestaudio/best",
    });
  }

  return options;
}

function getExtension(path: string): string {
  const cleanPath = path.split("?")[0]?.split("#")[0] ?? "";
  const match = cleanPath.match(/\.([a-z0-9]+)$/i);
  return match?.[1]?.toLowerCase() ?? "";
}

function findLocalOutputByExtension(
  value: { outputPath?: string; outputPaths?: string[] },
  extensions: Set<string>
): string | undefined {
  return getExplicitOutputPaths(value).find((path) => extensions.has(getExtension(path)));
}

export async function fetchMediaInfo(url: string): Promise<MediaMetadataProbe> {
  if (isInstagramUrl(url)) {
    const engine = useSettingsStore.getState().settings.instagramEngine;
    if (engine !== "yt-dlp") {
      return fetchInstagramMediaInfo(url);
    }
    // Fall through to yt-dlp dump-json for Instagram when that engine is selected.
  }

  const ytDlp = await resolveTool("yt-dlp");
  const args = ["--dump-single-json", "--skip-download", "--no-playlist", "--referer", url, url];
  try {
    const { ytdlpCacheDir } = await getAppPaths();
    args.splice(0, 0, "--cache-dir", ytdlpCacheDir);
  } catch {
    // Keep default cache when app paths are unavailable.
  }
  const result = await runResolvedTool(ytDlp, "yt-dlp", args, {
    env: ytDlpEnv(),
    timeoutMs: 60000,
  });
  const stdout = result.stdout;
  const stderr = result.stderr;

  if (result.code !== 0) {
    throw new Error(stderr.trim() || `yt-dlp exited with code ${result.code}`);
  }

  const payload = JSON.parse(stdout);
  const manualLanguages = extractLanguageKeys(payload?.subtitles);
  const autoLanguages = extractLanguageKeys(payload?.automatic_captions);
  const mergedLanguages = Array.from(new Set([...manualLanguages, ...autoLanguages]));
  const duration = Number(payload?.duration);
  const uploader = String(payload?.uploader ?? payload?.channel ?? payload?.creator ?? "").trim();

  return {
    title: String(payload?.title ?? "").trim(),
    thumbnailUrl: String(payload?.thumbnail ?? "").trim(),
    ...(uploader ? { uploader } : {}),
    mediaDurationSeconds: Number.isFinite(duration) && duration > 0 ? duration : undefined,
    hasManualSubtitles: manualLanguages.length > 0,
    hasAutoSubtitles: autoLanguages.length > 0,
    availableSubtitleLanguages: mergedLanguages,
    formats: summarizeMediaFormats(payload?.formats),
  };
}

export async function fetchMetadata(jobId: string) {
  const { jobs, updateJob } = useDownloadsStore.getState();
  const { addLog } = useLogsStore.getState();
  const job = jobs.find((j) => j.id === jobId);
  if (!job) return;

  try {
    updateJob(jobId, {
      phase: "Generating thumbnail",
      statusDetail: "Fetching metadata",
      subtitleStatus: "checking",
    });

    const ffmpeg = await resolveTool("ffmpeg");
    const thumbsDir = await ensureThumbnailDir();
    const shouldGenerateContactSheet = useSettingsStore.getState().settings.generateThumbnailContactSheets;
    let title = "";
    let thumbnailUrl = "";

    const maybeGenerateContactSheet = async () => {
      if (!shouldGenerateContactSheet) return;
      const localVideoPath = findLocalOutputByExtension(
        useDownloadsStore.getState().jobs.find((j) => j.id === jobId) ?? job,
        VIDEO_FILE_EXTENSIONS
      );
      if (!localVideoPath) return;
      addLog({ level: "info", message: "[meta] Generating thumbnail contact sheet", jobId });
      await generateThumbnailContactSheet(jobId, localVideoPath);
    };

    addLog({ level: "info", message: `[meta] Starting metadata fetch for ${job.url}`, jobId });

    try {
      const info = await fetchMediaInfo(job.url);
      title = info.title;
      thumbnailUrl = info.thumbnailUrl;

      updateJob(jobId, {
        ...(title ? { title } : {}),
        ...(info.mediaDurationSeconds ? { mediaDurationSeconds: info.mediaDurationSeconds } : {}),
        ...(info.mediaCollectionSummary
          ? { mediaCollectionSummary: info.mediaCollectionSummary }
          : {}),
        subtitleStatus:
          info.hasManualSubtitles || info.hasAutoSubtitles ? "available" : "unavailable",
        hasManualSubtitles: info.hasManualSubtitles,
        hasAutoSubtitles: info.hasAutoSubtitles,
        availableSubtitleLanguages: info.availableSubtitleLanguages,
      });

      addLog({
        level: "info",
        message: `[meta] Subtitle availability: manual=${info.hasManualSubtitles} auto=${info.hasAutoSubtitles} langs=${info.availableSubtitleLanguages.join(", ") || "none"}`,
        jobId,
      });
    } catch (infoError) {
      updateJob(jobId, { subtitleStatus: "error" });
      addLog({
        level: "warn",
        message: `[meta] Metadata probe failed: ${String(infoError)}`,
        jobId,
      });
    }

    if (thumbnailUrl && /^https?:/i.test(thumbnailUrl) && thumbnailUrl.toUpperCase() !== "NA") {
      if (isTauriLocalAssetUrl(thumbnailUrl)) {
        updateJob(jobId, { thumbnail: thumbnailUrl, thumbnailStatus: "ready" });
        return;
      }

      const urlExt = (
        thumbnailUrl.split("?")[0].match(/\.(jpe?g|webp|png)$/i)?.[1] || "jpg"
      ).toLowerCase();
      const thumbFileName = `${jobId}.${urlExt === "jpeg" ? "jpg" : urlExt}`;
      const thumbDest = await join(thumbsDir, thumbFileName);
      const thumbRelPath = `thumbnails/${thumbFileName}`;

      addLog({ level: "info", message: `[meta] Downloading thumbnail → ${thumbRelPath}`, jobId });

      try {
        await downloadUrlToFile(thumbnailUrl, thumbDest, job.url);
        if (await exists(thumbDest)) {
          const assetUrl = await thumbnailAssetUrl(thumbRelPath);
          updateJob(jobId, { thumbnail: assetUrl, thumbnailStatus: "ready" });
          await maybeGenerateContactSheet();
          return;
        }
      } catch (e) {
        addLog({ level: "warn", message: `[meta] Thumbnail HTTP download failed: ${String(e)}`, jobId });
      }

      updateJob(jobId, { thumbnail: thumbnailUrl, thumbnailStatus: "ready" });
      await maybeGenerateContactSheet();
      return;
    }

    const localImagePath = findLocalOutputByExtension(job, IMAGE_FILE_EXTENSIONS);
    if (localImagePath) {
      addLog({ level: "info", message: `[meta] Using downloaded image as thumbnail`, jobId });
      updateJob(jobId, {
        thumbnail: thumbnailAssetUrlFromAbsolutePath(localImagePath),
        thumbnailStatus: "ready",
      });
      return;
    }

    const localVideoPath = findLocalOutputByExtension(job, VIDEO_FILE_EXTENSIONS);
    if (localVideoPath) {
      if (ffmpeg.isLocal) {
        addLog({ level: "info", message: `[meta] Generating thumbnail from downloaded file`, jobId });
        await generateThumbnailFromMediaUrl(jobId, localVideoPath);
        return;
      }

      updateJob(jobId, {
        thumbnailStatus: "failed",
        thumbnailError: "FFmpeg is unavailable for thumbnail generation",
      });
      return;
    }

    addLog({ level: "warn", message: `[meta] No usable thumbnail URL from metadata probe`, jobId });

    if (isYouTubeUrl(job.url)) {
      updateJob(jobId, {
        thumbnailStatus: "failed",
        thumbnailError: "No thumbnail available",
      });
      return;
    }

    addLog({ level: "info", message: `[meta] Falling back to ffmpeg thumbnail extraction`, jobId });

    const ytDlpTool = await resolveTool("yt-dlp");
    const mediaOutput = await runResolvedTool(
      ytDlpTool,
      "yt-dlp",
      ["-f", "best", "-g", "--no-playlist", "--referer", job.url, job.url],
      { env: ytDlpEnv(), timeoutMs: 60000 }
    );
    const mediaStdout = mediaOutput.stdout;
    const mediaStderr = mediaOutput.stderr;
    if (mediaStderr.trim()) {
      addLog({
        level: "warn",
        message: `[meta] Media URL stderr: ${mediaStderr.trim().substring(0, 300)}`,
        jobId,
      });
    }

    if (mediaOutput.code === 0) {
      const mediaUrl = mediaStdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .find(Boolean);

      if (mediaUrl) {
        if (ffmpeg.isLocal) {
          await generateThumbnailFromMediaUrl(jobId, mediaUrl);
        } else {
          updateJob(jobId, {
            thumbnailStatus: "failed",
            thumbnailError: "FFmpeg is unavailable for thumbnail generation",
          });
        }
      } else {
        updateJob(jobId, {
          thumbnailStatus: "failed",
          thumbnailError: "No media URL found for thumbnail generation",
        });
      }
    } else {
      updateJob(jobId, {
        thumbnailStatus: "failed",
        thumbnailError: "Failed to fetch media URL",
      });
    }
  } catch (e) {
    const message = String(e);
    if (message.toLowerCase().includes("invalid utf-8 sequence")) {
      useLogsStore.getState().addLog({ level: "warn", message: `[meta] Metadata decode warning: ${message}`, jobId });
      return;
    }
    useLogsStore.getState().addLog({ level: "error", message: `[meta] Exception in fetchMetadata: ${message}`, jobId });
    updateJob(jobId, {
      subtitleStatus: "error",
      thumbnailStatus: "failed",
      thumbnailError: message,
    });
  }
}

function thumbnailAssetUrlFromAbsolutePath(path: string): string {
  return convertFileSrc(path);
}
