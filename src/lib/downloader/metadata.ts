import { Command } from "@tauri-apps/plugin-shell";
import { useDownloadsStore } from "@/store/downloads";
import { useLogsStore } from "@/store/logs";
import { join } from "@tauri-apps/api/path";
import { BaseDirectory, exists } from "@tauri-apps/plugin-fs";
import { downloadUrlToFile } from "@/lib/commands";
import { isInstagramUrl } from "@/lib/media-engine";
import { resolveTool, ytDlpEnv, isYouTubeUrl } from "./tool-env";
import { fetchInstagramMediaInfo } from "./instagram";
import {
  ensureThumbnailDir,
  thumbnailAssetUrl,
  generateThumbnailFromMediaUrl,
} from "./thumbnails";

export interface MediaMetadataProbe {
  title: string;
  thumbnailUrl: string;
  hasManualSubtitles: boolean;
  hasAutoSubtitles: boolean;
  availableSubtitleLanguages: string[];
}

function extractLanguageKeys(value: unknown): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return Object.keys(value as Record<string, unknown>)
    .map((key) => key.trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
}

export async function fetchMediaInfo(url: string): Promise<MediaMetadataProbe> {
  if (isInstagramUrl(url)) {
    return fetchInstagramMediaInfo(url);
  }

  const ytDlp = await resolveTool("yt-dlp");
  const command = Command.create(
    ytDlp.command,
    ["--dump-single-json", "--skip-download", "--no-playlist", "--referer", url, url],
    { env: ytDlpEnv() }
  );
  const result = await command.execute();

  if (result.code !== 0) {
    throw new Error(result.stderr.trim() || `yt-dlp exited with code ${result.code}`);
  }

  const payload = JSON.parse(result.stdout);
  const manualLanguages = extractLanguageKeys(payload?.subtitles);
  const autoLanguages = extractLanguageKeys(payload?.automatic_captions);
  const mergedLanguages = Array.from(new Set([...manualLanguages, ...autoLanguages]));

  return {
    title: String(payload?.title ?? "").trim(),
    thumbnailUrl: String(payload?.thumbnail ?? "").trim(),
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
    let title = "";
    let thumbnailUrl = "";

    addLog({ level: "info", message: `[meta] Starting metadata fetch for ${job.url}`, jobId });

    try {
      const info = await fetchMediaInfo(job.url);
      title = info.title;
      thumbnailUrl = info.thumbnailUrl;

      updateJob(jobId, {
        ...(title ? { title } : {}),
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
      const urlExt = (
        thumbnailUrl.split("?")[0].match(/\.(jpe?g|webp|png)$/i)?.[1] || "jpg"
      ).toLowerCase();
      const thumbFileName = `${jobId}.${urlExt === "jpeg" ? "jpg" : urlExt}`;
      const thumbDest = await join(thumbsDir, thumbFileName);
      const thumbRelPath = `thumbnails/${thumbFileName}`;

      addLog({ level: "info", message: `[meta] Downloading thumbnail → ${thumbRelPath}`, jobId });

      try {
        await downloadUrlToFile(thumbnailUrl, thumbDest, job.url);
        if (await exists(thumbRelPath, { baseDir: BaseDirectory.AppData })) {
          const assetUrl = await thumbnailAssetUrl(thumbRelPath);
          updateJob(jobId, { thumbnail: assetUrl, thumbnailStatus: "ready" });
          return;
        }
      } catch (e) {
        addLog({ level: "warn", message: `[meta] Thumbnail HTTP download failed: ${String(e)}`, jobId });
      }

      updateJob(jobId, { thumbnail: thumbnailUrl, thumbnailStatus: "ready" });
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
      { env: ytDlpEnv() }
    );

    const mediaOutput = await mediaCmd.execute();
    if (mediaOutput.stderr.trim()) {
      addLog({
        level: "warn",
        message: `[meta] Media URL stderr: ${mediaOutput.stderr.trim().substring(0, 300)}`,
        jobId,
      });
    }

    if (mediaOutput.code === 0) {
      const mediaUrl = mediaOutput.stdout
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
