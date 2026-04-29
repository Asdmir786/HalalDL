import { Command } from "@tauri-apps/plugin-shell";
import { convertFileSrc } from "@tauri-apps/api/core";
import { useDownloadsStore } from "@/store/downloads";
import { useLogsStore } from "@/store/logs";
import { useSettingsStore } from "@/store/settings";
import { join } from "@tauri-apps/api/path";
import { exists } from "@tauri-apps/plugin-fs";
import { downloadUrlToFile } from "@/lib/commands";
import { isInstagramUrl } from "@/lib/media-engine";
import { getExplicitOutputPaths } from "@/lib/output-paths";
import { resolveTool, ytDlpEnv, isYouTubeUrl } from "./tool-env";
import { fetchInstagramMediaInfo } from "./instagram";
import {
  ensureThumbnailDir,
  thumbnailAssetUrl,
  generateThumbnailContactSheet,
  generateThumbnailFromMediaUrl,
} from "./thumbnails";

const IMAGE_FILE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "gif", "bmp", "avif"]);
const VIDEO_FILE_EXTENSIONS = new Set(["mp4", "mov", "webm", "mkv", "avi", "m4v"]);

export interface MediaMetadataProbe {
  title: string;
  thumbnailUrl: string;
  mediaDurationSeconds?: number;
  mediaCollectionSummary?: DownloadJob["mediaCollectionSummary"];
  hasManualSubtitles: boolean;
  hasAutoSubtitles: boolean;
  availableSubtitleLanguages: string[];
}

function shellPayloadToBytes(output: unknown): Uint8Array | null {
  if (output instanceof Uint8Array) return output;
  if (output instanceof ArrayBuffer) return new Uint8Array(output);
  if (ArrayBuffer.isView(output)) {
    return new Uint8Array(output.buffer, output.byteOffset, output.byteLength);
  }
  if (Array.isArray(output)) return new Uint8Array(output);

  if (output && typeof output === "object") {
    const data = (output as { data?: unknown }).data;
    if (Array.isArray(data)) return new Uint8Array(data);
  }

  return null;
}

function decodeShellOutput(output: unknown): string {
  if (typeof output === "string") return output;
  const bytes = shellPayloadToBytes(output);
  return bytes ? new TextDecoder().decode(bytes) : String(output ?? "");
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
    return fetchInstagramMediaInfo(url);
  }

  const ytDlp = await resolveTool("yt-dlp");
  const command = Command.create(
    ytDlp.command,
    ["--dump-single-json", "--skip-download", "--no-playlist", "--referer", url, url],
    { env: ytDlpEnv(), encoding: "raw" }
  );
  const result = await command.execute();
  const stdout = decodeShellOutput(result.stdout);
  const stderr = decodeShellOutput(result.stderr);

  if (result.code !== 0) {
    throw new Error(stderr.trim() || `yt-dlp exited with code ${result.code}`);
  }

  const payload = JSON.parse(stdout);
  const manualLanguages = extractLanguageKeys(payload?.subtitles);
  const autoLanguages = extractLanguageKeys(payload?.automatic_captions);
  const mergedLanguages = Array.from(new Set([...manualLanguages, ...autoLanguages]));
  const duration = Number(payload?.duration);

  return {
    title: String(payload?.title ?? "").trim(),
    thumbnailUrl: String(payload?.thumbnail ?? "").trim(),
    mediaDurationSeconds: Number.isFinite(duration) && duration > 0 ? duration : undefined,
    hasManualSubtitles: manualLanguages.length > 0,
    hasAutoSubtitles: autoLanguages.length > 0,
    availableSubtitleLanguages: mergedLanguages,
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

    const mediaCmd = Command.create(
      (await resolveTool("yt-dlp")).command,
      ["-f", "best", "-g", "--no-playlist", "--referer", job.url, job.url],
      { env: ytDlpEnv(), encoding: "raw" }
    );

    const mediaOutput = await mediaCmd.execute();
    const mediaStdout = decodeShellOutput(mediaOutput.stdout);
    const mediaStderr = decodeShellOutput(mediaOutput.stderr);
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
