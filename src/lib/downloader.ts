import { Command } from "@tauri-apps/plugin-shell";
import { useDownloadsStore } from "@/store/downloads";
import { useLogsStore } from "@/store/logs";
import { usePresetsStore } from "@/store/presets";
import { useSettingsStore } from "@/store/settings";
import { appDataDir, join } from "@tauri-apps/api/path";
import { exists, mkdir } from "@tauri-apps/plugin-fs";
import { OutputParser } from "@/lib/output-parser";
import { copyFilesToClipboard, deleteFile } from "@/lib/commands";

import { sendNotification, requestPermission, isPermissionGranted } from '@tauri-apps/plugin-notification';

async function sendDownloadCompleteNotification(title: string, body: string) {
  try {
    let permissionGranted = await isPermissionGranted();
    if (!permissionGranted) {
      const permission = await requestPermission();
      permissionGranted = permission === 'granted';
    }
    
    if (permissionGranted) {
      sendNotification({
        title,
        body,
      });
    }
  } catch (error) {
    useLogsStore.getState().addLog({ level: "warn", message: `Failed to send notification: ${String(error)}` });
  }
}

type ToolResolution = {
  command: string;
  path: string;
  isLocal: boolean;
};

function toLocalCommandName(baseName: string): string {
  return `local-${baseName}`;
}

async function resolveTool(baseName: string): Promise<ToolResolution> {
  try {
    const dataDir = await appDataDir();
    const localPath = await join(dataDir, "bin", `${baseName}.exe`);
    if (await exists(localPath)) {
      return { command: toLocalCommandName(baseName), path: localPath, isLocal: true };
    }
  } catch {
    void 0;
  }
  return { command: baseName, path: baseName, isLocal: false };
}

function ytDlpEnv(): Record<string, string> {
  return {
    PYTHONIOENCODING: "utf-8",
    PYTHONUTF8: "1",
    LANG: "C.UTF-8",
    LC_ALL: "C.UTF-8",
  };
}

function isYouTubeUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return (
      host === "youtube.com" ||
      host === "www.youtube.com" ||
      host === "m.youtube.com" ||
      host === "music.youtube.com" ||
      host === "youtu.be"
    );
  } catch {
    const lower = url.toLowerCase();
    return lower.includes("youtube.com") || lower.includes("youtu.be");
  }
}

async function ensureThumbnailDir(): Promise<string> {
  const dataDir = await appDataDir();
  const thumbsDir = await join(dataDir, "thumbnails");
  if (!(await exists(thumbsDir))) {
    await mkdir(thumbsDir, { recursive: true });
  }
  return thumbsDir;
}

function toFileUrl(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  if (/^[a-zA-Z]:\//.test(normalized)) {
    return `file:///${normalized}`;
  }
  if (normalized.startsWith("/")) {
    return `file://${normalized}`;
  }
  return `file://${normalized}`;
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

async function resolveLocalThumbnailPath(thumbnail: string): Promise<string | null> {
  if (!thumbnail) return null;
  if (/^https?:/i.test(thumbnail)) return null;

  let candidate = thumbnail;
  if (/^file:/i.test(candidate)) {
    candidate = stripFileUriPrefix(candidate);
  }

  const dataDir = await appDataDir();
  const thumbsDir = await join(dataDir, "thumbnails");
  if (candidate.toLowerCase().startsWith(thumbsDir.toLowerCase())) {
    return candidate;
  }

  return null;
}

async function generateThumbnailFromMediaUrl(jobId: string, mediaUrl: string) {
  const { updateJob } = useDownloadsStore.getState();
  const { addLog } = useLogsStore.getState();

  try {
    const ffmpeg = await resolveTool("ffmpeg");
    const thumbsDir = await ensureThumbnailDir();
    const outputPath = await join(thumbsDir, `${jobId}.jpg`);
    const filter = "blackframe=amount=98:threshold=32,select='lt(lavfi.blackframe.pblack,98)',scale=320:-1";

    const primary = Command.create(ffmpeg.command, [
      "-y",
      "-i",
      mediaUrl,
      "-frames:v",
      "1",
      "-vf",
      filter,
      outputPath,
    ]);

    const primaryOutput = await primary.execute();
    if (primaryOutput.code === 0 && (await exists(outputPath))) {
      updateJob(jobId, { thumbnail: toFileUrl(outputPath) });
      return;
    }

    const fallback = Command.create(ffmpeg.command, [
      "-y",
      "-i",
      mediaUrl,
      "-frames:v",
      "1",
      "-vf",
      "thumbnail,scale=320:-1",
      outputPath,
    ]);

    const fallbackOutput = await fallback.execute();
    if (fallbackOutput.code === 0 && (await exists(outputPath))) {
      updateJob(jobId, { thumbnail: toFileUrl(outputPath) });
      return;
    }

    addLog({ level: "warn", message: "Thumbnail generation failed", jobId });
  } catch (e) {
    addLog({ level: "warn", message: `Thumbnail generation error: ${String(e)}`, jobId });
  }
}

export async function cleanupThumbnailByJobId(jobId: string) {
  const { jobs } = useDownloadsStore.getState();
  const { addLog } = useLogsStore.getState();
  const job = jobs.find((j) => j.id === jobId);
  if (!job?.thumbnail) return;

  try {
    const localPath = await resolveLocalThumbnailPath(job.thumbnail);
    if (!localPath) return;
    await deleteFile(localPath);
  } catch (e) {
    addLog({ level: "warn", message: `Thumbnail cleanup failed: ${String(e)}`, jobId });
  }
}

export async function startDownload(jobId: string) {
  const { jobs, updateJob, removeJob } = useDownloadsStore.getState();

  const { addLog } = useLogsStore.getState();
  const { presets } = usePresetsStore.getState();
  const { settings } = useSettingsStore.getState();

  const job = jobs.find((j) => j.id === jobId);
  if (!job) return;

  const preset = presets.find((p) => p.id === job.presetId) || presets[0];
  const ytDlp = await resolveTool("yt-dlp");
  const ffmpeg = await resolveTool("ffmpeg");
  const aria2 = await resolveTool("aria2c");

  const args = [...preset.args];

  // Apply Format Override if present
  if (job.overrides?.format) {
    const removeFlagWithValue = (flag: string) => {
      const i = args.indexOf(flag);
      if (i !== -1) args.splice(i, 2);
    };
    const removeFlag = (flag: string) => {
      const i = args.indexOf(flag);
      if (i !== -1) args.splice(i, 1);
    };

    // Remove existing format args if any
    const formatIndex = args.indexOf("-f");
    if (formatIndex !== -1) {
        args.splice(formatIndex, 2);
    }
    
    switch (job.overrides.format) {
        case "best":
            args.push("-f", "bestvideo+bestaudio/best");
            addLog({ level: "info", message: "Format override applied: bestvideo+bestaudio/best", jobId });
            break;
        case "mp4":
            args.push("-f", "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best");
            addLog({ level: "info", message: "Format override applied: bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best", jobId });
            break;
        case "webm":
            args.push("-f", "bestvideo[ext=webm]+bestaudio[ext=webm]/best[ext=webm]/best");
            addLog({ level: "info", message: "Format override applied: bestvideo[ext=webm]+bestaudio[ext=webm]/best[ext=webm]/best", jobId });
            break;
        case "mp3":
            removeFlag("-x");
            removeFlagWithValue("--audio-format");
            removeFlagWithValue("--audio-quality");
            args.push("-f", "bestaudio", "-x", "--audio-format", "mp3", "--audio-quality", "0");
            addLog({ level: "info", message: "Format override applied: bestaudio -> mp3", jobId });
            break;
        case "m4a":
            removeFlag("-x");
            removeFlagWithValue("--audio-format");
            removeFlagWithValue("--audio-quality");
            args.push("-f", "bestaudio", "-x", "--audio-format", "m4a");
            addLog({ level: "info", message: "Format override applied: bestaudio -> m4a", jobId });
            break;
        case "flac":
            removeFlag("-x");
            removeFlagWithValue("--audio-format");
            removeFlagWithValue("--audio-quality");
            args.push("-f", "bestaudio", "-x", "--audio-format", "flac");
            addLog({ level: "info", message: "Format override applied: bestaudio -> flac", jobId });
            break;
        case "wav":
            removeFlag("-x");
            removeFlagWithValue("--audio-format");
            removeFlagWithValue("--audio-quality");
            args.push("-f", "bestaudio", "-x", "--audio-format", "wav");
            addLog({ level: "info", message: "Format override applied: bestaudio -> wav", jobId });
            break;
        case "alac":
            removeFlag("-x");
            removeFlagWithValue("--audio-format");
            removeFlagWithValue("--audio-quality");
            args.push("-f", "bestaudio", "-x", "--audio-format", "alac");
            addLog({ level: "info", message: "Format override applied: bestaudio -> alac", jobId });
            break;
        case "mkv":
            args.push("--merge-output-format", "mkv");
            addLog({ level: "info", message: "Format override applied: merge-output-format=mkv", jobId });
            break;
        default:
            // Custom format string
            args.push("-f", job.overrides.format);
            addLog({ level: "info", message: `Format override applied: ${job.overrides.format}`, jobId });
    }
  }

  // Add ffmpeg path if it exists
  if (ffmpeg.isLocal) {
    const ffmpegDir = ffmpeg.path.replace(/\\ffmpeg\.exe$/, "");
    args.push("--ffmpeg-location", ffmpegDir);
  }

  // Use aria2 if available
  if (aria2.isLocal) {
    addLog({ level: "info", message: `Using local aria2c: ${aria2.path}`, jobId });
    args.push("--external-downloader", aria2.path);
    args.push("--external-downloader-args", "-x 16 -s 16 -k 1M --summary-interval=0");
  } else {
    addLog({ level: "info", message: "Aria2c not found in local bin, checking system PATH...", jobId });
  }

  // Add output template
  const downloadDir = job.overrides?.downloadDir || settings.defaultDownloadDir;
  const filenameTemplate = job.overrides?.filenameTemplate || "%(title)s.%(ext)s";

  if (downloadDir) {
    args.push("-o", await join(downloadDir, filenameTemplate));
  } else {
    // If no dir set, just use template (current working dir)
    args.push("-o", filenameTemplate);
  }

  // Ensure consistent behavior: ignore global config and force newline output for logs
  args.push("--ignore-config", "--newline", "--no-colors", "--no-playlist");

  args.push("--print", "after_move:__HALALDL_OUTPUT__:%(filepath)s");

  // Speed Limit
  if (settings.maxSpeed && settings.maxSpeed > 0) {
    args.push("--limit-rate", `${settings.maxSpeed}K`);
  }

  args.push(job.url);

  const quotedArgs = args.map(arg => arg.includes(' ') ? `"${arg}"` : arg).join(" ");
  addLog({ level: "info", message: `Executing Command:\n${ytDlp.path} ${quotedArgs}`, jobId });
  updateJob(jobId, { status: "Downloading", progress: 0 });

  const buildFallbackArgs = (sourceArgs: string[]) => {
    const next = [...sourceArgs];
    const formatIndex = next.indexOf("-f");
    const formatValue = formatIndex !== -1 ? next[formatIndex + 1] : "";
    const audioOnly =
      next.includes("-x") ||
      next.includes("--audio-format") ||
      (formatValue ? formatValue.startsWith("bestaudio") : false);
    if (formatIndex !== -1) next.splice(formatIndex, 2);
    next.push("-f", audioOnly ? "bestaudio" : "bestvideo+bestaudio/best");
    return next;
  };

  const runDownload = async (runArgs: string[]) => {
    const cmd = Command.create(ytDlp.command, runArgs, { env: ytDlpEnv() });
    let lastKnownOutputPath: string | undefined;
    let formatUnavailable = false;

    const outputParser = new OutputParser();
    let lastUpdate = 0;
    const UPDATE_INTERVAL = 500;
    let stdoutBuffer = "";
    let stderrBuffer = "";

    const flushStdoutLine = (line: string) => {
      const trimmedLine = line.replace(/\r/g, "");
      if (!trimmedLine) return;

      addLog({ level: "info", message: trimmedLine, jobId });

      const now = Date.now();
      const shouldUpdate = now - lastUpdate > UPDATE_INTERVAL;
      const update = outputParser.parse(trimmedLine);

      if (!update) return;

      if (update.outputPath) {
        lastKnownOutputPath = update.outputPath;
      }

      if (update.progress || update.speed || update.eta) {
        if (shouldUpdate) {
          updateJob(jobId, update);
          lastUpdate = now;
        }
      } else {
        updateJob(jobId, update);
      }
    };

    const flushStderrLine = (line: string) => {
      const trimmedLine = line.replace(/\r/g, "");
      if (!trimmedLine) return;

      addLog({ level: "error", message: `STDERR: ${trimmedLine}`, jobId });

      if (/requested format is not available/i.test(trimmedLine)) {
        formatUnavailable = true;
        addLog({ level: "warn", message: "Requested format is not available, preparing fallback", jobId });
      }

      if (trimmedLine.includes("aria2c") || trimmedLine.includes("downloader")) {
        addLog({ level: "error", message: "Downloader specific error detected", jobId });
      }

      const now = Date.now();
      const shouldUpdate = now - lastUpdate > UPDATE_INTERVAL;
      const update = outputParser.parse(trimmedLine);

      if (!update) return;

      if (update.outputPath) {
        lastKnownOutputPath = update.outputPath;
      }

      if (update.progress || update.speed || update.eta) {
        if (shouldUpdate) {
          updateJob(jobId, update);
          lastUpdate = now;
        }
      } else {
        updateJob(jobId, update);
      }
    };

    cmd.stdout.on("data", (chunk) => {
      stdoutBuffer += chunk;
      const parts = stdoutBuffer.split(/\n/);
      stdoutBuffer = parts.pop() ?? "";
      for (const part of parts) flushStdoutLine(part);
    });

    cmd.stderr.on("data", (chunk) => {
      stderrBuffer += chunk;
      const parts = stderrBuffer.split(/\n/);
      stderrBuffer = parts.pop() ?? "";
      for (const part of parts) flushStderrLine(part);
    });

    return new Promise<{
      code: number;
      lastKnownOutputPath?: string;
      formatUnavailable: boolean;
    }>((resolve) => {
      cmd.on("close", (data) => {
        flushStdoutLine(stdoutBuffer);
        flushStderrLine(stderrBuffer);
        const code = typeof data.code === "number" ? data.code : 1;
        addLog({ level: "info", message: `Process finished with code ${code}`, jobId });
        resolve({ code, lastKnownOutputPath, formatUnavailable });
      });

      cmd.on("error", (error) => {
        const message = String(error);
        if (message.toLowerCase().includes("invalid utf-8 sequence")) {
          addLog({ level: "warn", message: `Process output decode warning: ${message}`, jobId });
          resolve({ code: 1, lastKnownOutputPath, formatUnavailable });
          return;
        }
        addLog({ level: "error", message: `Process error: ${message}`, jobId });
        resolve({ code: 1, lastKnownOutputPath, formatUnavailable });
      });

      cmd.spawn().catch((e) => {
        addLog({ level: "error", message: `Failed to spawn process: ${e}`, jobId });
        resolve({ code: 1, lastKnownOutputPath, formatUnavailable });
      });
    });
  };

  let result = await runDownload(args);
  if (result.code !== 0 && result.formatUnavailable) {
    const fallbackArgs = buildFallbackArgs(args);
    const fallbackQuoted = fallbackArgs.map(arg => arg.includes(' ') ? `"${arg}"` : arg).join(" ");
    const fallbackFormatIndex = fallbackArgs.indexOf("-f");
    const fallbackFormat = fallbackFormatIndex !== -1 ? fallbackArgs[fallbackFormatIndex + 1] : "best";
    addLog({ level: "warn", message: `Falling back to format: ${fallbackFormat}`, jobId });
    addLog({ level: "info", message: `Retrying with fallback format:\n${ytDlp.path} ${fallbackQuoted}`, jobId });
    result = await runDownload(fallbackArgs);
  }

  if (result.code === 0) {
    updateJob(jobId, { status: "Done", progress: 100 });
    fetchMetadata(jobId);

    setTimeout(() => {
      const { settings } = useSettingsStore.getState();
      const finalJob = useDownloadsStore.getState().jobs.find((j) => j.id === jobId);
      const outputPathToUse = result.lastKnownOutputPath || finalJob?.outputPath;

      if (result.lastKnownOutputPath && finalJob?.outputPath !== result.lastKnownOutputPath) {
        updateJob(jobId, { outputPath: result.lastKnownOutputPath });
      }

      if (settings.notifications && finalJob) {
        const title = finalJob.title || "Download Complete";
        sendDownloadCompleteNotification("Download Finished", `${title} has been downloaded successfully.`);
      }

      if (settings.autoCopyFile && outputPathToUse) {
        copyFilesToClipboard([outputPathToUse]).catch((e) => {
          addLog({ level: "error", message: `Auto-copy failed: ${e}`, jobId });
        });
      }
    }, 50);

    if (settings.autoClearFinished) {
      setTimeout(() => {
        cleanupThumbnailByJobId(jobId).finally(() => {
          removeJob(jobId);
        });
      }, 2000);
    }
  } else {
    if (result.formatUnavailable) {
      addLog({ level: "error", message: "Fallback failed: format unavailable after retry", jobId });
    }
    updateJob(jobId, { status: "Failed" });
  }
}

export async function fetchMetadata(jobId: string) {
  const { jobs, updateJob } = useDownloadsStore.getState();
  const job = jobs.find((j) => j.id === jobId);
  if (!job) return;

  try {
    const ytDlp = await resolveTool("yt-dlp");
    if (isYouTubeUrl(job.url)) {
      const cmd = Command.create(ytDlp.command, [
        "--print",
        "%(title)s:::%(thumbnail)s",
        "--skip-download",
        "--no-warnings",
        "--flat-playlist",
        "--no-playlist",
        "--referer", job.url,
        job.url
      ], { env: ytDlpEnv() });

      const output = await cmd.execute();
      
      if (output.code === 0) {
        const parts = output.stdout.trim().split(":::");
        if (parts.length >= 2) {
          const title = parts[0].trim();
          const thumbnailUrl = parts[1].trim();

          updateJob(jobId, { 
            title: title || job.title, 
            thumbnail: thumbnailUrl || undefined,
          });
        }
      }
      return;
    }

    const titleCmd = Command.create(ytDlp.command, [
      "--print",
      "%(title)s",
      "--skip-download",
      "--no-warnings",
      "--flat-playlist",
      "--no-playlist",
      "--referer", job.url,
      job.url
    ], { env: ytDlpEnv() });

    const titleOutput = await titleCmd.execute();
    if (titleOutput.code === 0) {
      const title = titleOutput.stdout.trim();
      if (title) {
        updateJob(jobId, { title });
      }
    }

    const mediaCmd = Command.create(ytDlp.command, [
      "-f",
      "best",
      "-g",
      "--no-warnings",
      "--no-playlist",
      "--referer", job.url,
      job.url
    ], { env: ytDlpEnv() });

    const mediaOutput = await mediaCmd.execute();
    if (mediaOutput.code === 0) {
      const mediaUrl = mediaOutput.stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .find(Boolean);
      if (mediaUrl) {
        await generateThumbnailFromMediaUrl(jobId, mediaUrl);
      }
    }
  } catch (e) {
    const message = String(e);
    if (message.toLowerCase().includes("invalid utf-8 sequence")) {
      useLogsStore.getState().addLog({ level: "warn", message: `[meta] Metadata decode warning: ${message}`, jobId });
      return;
    }
    useLogsStore.getState().addLog({ level: "error", message: `[meta] Failed to fetch metadata: ${message}`, jobId });
  }
}
