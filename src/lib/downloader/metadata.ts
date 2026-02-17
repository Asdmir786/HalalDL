import { Command } from "@tauri-apps/plugin-shell";
import { useDownloadsStore } from "@/store/downloads";
import { useLogsStore } from "@/store/logs";
import { join } from "@tauri-apps/api/path";
import { BaseDirectory, exists } from "@tauri-apps/plugin-fs";
import { downloadUrlToFile } from "@/lib/commands";
import { resolveTool, ytDlpEnv, isYouTubeUrl } from "./tool-env";
import {
  ensureThumbnailDir,
  thumbnailAssetUrl,
  generateThumbnailFromMediaUrl,
} from "./thumbnails";

export async function fetchMetadata(jobId: string) {
  const { jobs, updateJob } = useDownloadsStore.getState();
  const { addLog } = useLogsStore.getState();
  const job = jobs.find((j) => j.id === jobId);
  if (!job) return;

  try {
    updateJob(jobId, {
      phase: "Generating thumbnail",
      statusDetail: "Fetching metadata",
    });

    const ytDlp = await resolveTool("yt-dlp");
    const ffmpeg = await resolveTool("ffmpeg");
    const thumbsDir = await ensureThumbnailDir();
    const thumbOutputTemplate = await join(thumbsDir, jobId);

    addLog({ level: "info", message: `[meta] Starting metadata fetch for ${job.url}`, jobId });
    addLog({ level: "info", message: `[meta] Thumbnail output template: ${thumbOutputTemplate}`, jobId });

    const metaArgs = [
      "--print", "%(title)s:::%(thumbnail)s",
      "--write-thumbnail",
      "--convert-thumbnails", "jpg",
      "--skip-download",
      "--flat-playlist",
      "--no-playlist",
      "--referer", job.url,
      "-o", thumbOutputTemplate,
      job.url,
    ];

    if (ffmpeg.isLocal) {
      const ffmpegDir = ffmpeg.path.replace(/\\ffmpeg\.exe$/, "");
      metaArgs.unshift("--ffmpeg-location", ffmpegDir);
    }

    addLog({ level: "info", message: `[meta] Phase 1: yt-dlp ${metaArgs.join(" ")}`, jobId });
    const metaCmd = Command.create(ytDlp.command, metaArgs, { env: ytDlpEnv() });
    const metaOutput = await metaCmd.execute();

    addLog({ level: "info", message: `[meta] Phase 1 exit code: ${metaOutput.code}`, jobId });
    addLog({ level: "info", message: `[meta] Phase 1 stdout: ${metaOutput.stdout.trim().substring(0, 500)}`, jobId });
    if (metaOutput.stderr.trim()) {
      addLog({ level: "warn", message: `[meta] Phase 1 stderr: ${metaOutput.stderr.trim().substring(0, 500)}`, jobId });
    }

    let title = "";
    let thumbnailUrl = "";

    if (metaOutput.code === 0) {
      const raw = metaOutput.stdout.trim().split(/\r?\n/)[0] || "";
      const sepIdx = raw.indexOf(":::");
      if (sepIdx !== -1) {
        title = raw.substring(0, sepIdx).trim();
        thumbnailUrl = raw.substring(sepIdx + 3).trim();
      } else {
        title = raw.trim();
      }

      if (title) {
        updateJob(jobId, { title: title || job.title });
      }
      addLog({ level: "info", message: `[meta] Parsed title: "${title}"`, jobId });
      addLog({ level: "info", message: `[meta] Parsed thumbnail URL: "${thumbnailUrl.substring(0, 200)}"`, jobId });
    } else {
      addLog({ level: "warn", message: `[meta] Phase 1 failed (exit ${metaOutput.code}), continuing to fallbacks`, jobId });
    }

    let thumbFound = false;
    for (const ext of ["jpg", "webp", "png"]) {
      const relPath = `thumbnails/${jobId}.${ext}`;
      if (await exists(relPath, { baseDir: BaseDirectory.AppData })) {
        addLog({ level: "info", message: `[meta] Thumbnail file found locally: ${relPath}`, jobId });
        const assetUrl = await thumbnailAssetUrl(relPath);
        updateJob(jobId, { thumbnail: assetUrl, thumbnailStatus: "ready" });
        thumbFound = true;
        break;
      }
    }
    if (thumbFound) return;

    addLog({ level: "warn", message: `[meta] No local thumbnail file produced by --write-thumbnail`, jobId });

    if (thumbnailUrl && /^https?:/i.test(thumbnailUrl) && thumbnailUrl.toUpperCase() !== "NA") {
      const urlExt = (thumbnailUrl.split("?")[0].match(/\.(jpe?g|webp|png)$/i)?.[1] || "jpg").toLowerCase();
      const thumbFileName = `${jobId}.${urlExt === "jpeg" ? "jpg" : urlExt}`;
      const thumbDest = await join(thumbsDir, thumbFileName);
      const thumbRelPath = `thumbnails/${thumbFileName}`;

      addLog({ level: "info", message: `[meta] Phase 2: Direct HTTP download → ${thumbRelPath}`, jobId });

      try {
        await downloadUrlToFile(thumbnailUrl, thumbDest, job.url);
        if (await exists(thumbRelPath, { baseDir: BaseDirectory.AppData })) {
          addLog({ level: "info", message: `[meta] Phase 2 thumbnail downloaded: ${thumbRelPath}`, jobId });
          const assetUrl = await thumbnailAssetUrl(thumbRelPath);
          updateJob(jobId, { thumbnail: assetUrl, thumbnailStatus: "ready" });
          return;
        }
        addLog({ level: "warn", message: `[meta] Phase 2: file not found after download`, jobId });
      } catch (e) {
        addLog({ level: "warn", message: `[meta] Phase 2 HTTP download failed: ${String(e)}`, jobId });
      }

      addLog({ level: "warn", message: `[meta] Phase 2 failed: no file produced`, jobId });
      addLog({ level: "info", message: `[meta] Phase 2b: Using thumbnail URL directly as fallback`, jobId });
      updateJob(jobId, { thumbnail: thumbnailUrl, thumbnailStatus: "ready" });
      return;
    }

    addLog({ level: "warn", message: `[meta] No usable thumbnail URL from yt-dlp (got: "${thumbnailUrl}")`, jobId });

    if (isYouTubeUrl(job.url)) {
      addLog({ level: "info", message: `[meta] YouTube source, skipping ffmpeg extraction`, jobId });
      updateJob(jobId, {
        thumbnailStatus: "failed",
        thumbnailError: "No thumbnail available",
      });
      return;
    }

    addLog({ level: "info", message: `[meta] Phase 4: Fetching media URL for ffmpeg extraction`, jobId });

    const mediaCmd = Command.create(ytDlp.command, [
      "-f", "best",
      "-g",
      "--no-playlist",
      "--referer", job.url,
      job.url,
    ], { env: ytDlpEnv() });

    const mediaOutput = await mediaCmd.execute();
    addLog({ level: "info", message: `[meta] Phase 4 media URL exit code: ${mediaOutput.code}`, jobId });
    if (mediaOutput.stderr.trim()) {
      addLog({ level: "warn", message: `[meta] Phase 4 stderr: ${mediaOutput.stderr.trim().substring(0, 300)}`, jobId });
    }

    if (mediaOutput.code === 0) {
      const mediaUrl = mediaOutput.stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .find(Boolean);
      addLog({ level: "info", message: `[meta] Phase 4 media URL: ${mediaUrl?.substring(0, 200) || "(empty)"}`, jobId });

      if (mediaUrl) {
        await generateThumbnailFromMediaUrl(jobId, mediaUrl);
      } else {
        addLog({ level: "error", message: `[meta] Phase 4: no media URL in stdout`, jobId });
        updateJob(jobId, {
          thumbnailStatus: "failed",
          thumbnailError: "No media URL found for thumbnail generation",
        });
      }
    } else {
      addLog({ level: "error", message: `[meta] Phase 4: yt-dlp -g failed (exit ${mediaOutput.code})`, jobId });
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
      thumbnailStatus: "failed",
      thumbnailError: message,
    });
  }
}
