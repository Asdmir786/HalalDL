import { Command } from "@tauri-apps/plugin-shell";
import { useDownloadsStore } from "@/store/downloads";
import { useLogsStore } from "@/store/logs";
import { usePresetsStore } from "@/store/presets";
import { useSettingsStore } from "@/store/settings";
import { appDataDir, join } from "@tauri-apps/api/path";
import { BaseDirectory, exists, mkdir } from "@tauri-apps/plugin-fs";
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
  if (!(await exists("thumbnails", { baseDir: BaseDirectory.AppData }))) {
    await mkdir("thumbnails", { baseDir: BaseDirectory.AppData, recursive: true });
  }
  const dataDir = await appDataDir();
  const thumbsDir = await join(dataDir, "thumbnails");
  return thumbsDir;
}

function thumbnailRelativePathForJob(jobId: string): string {
  return `thumbnails/${jobId}.jpg`;
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
    updateJob(jobId, {
      phase: "Generating thumbnail",
      statusDetail: "Creating thumbnail preview",
      thumbnailStatus: "generating",
      thumbnailError: undefined,
    });
    const ffmpeg = await resolveTool("ffmpeg");
    const thumbsDir = await ensureThumbnailDir();
    const outputPath = await join(thumbsDir, `${jobId}.jpg`);
    const outputRelativePath = thumbnailRelativePathForJob(jobId);
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
    if (primaryOutput.code === 0 && (await exists(outputRelativePath, { baseDir: BaseDirectory.AppData }))) {
      updateJob(jobId, { thumbnail: toFileUrl(outputPath) });
      updateJob(jobId, { thumbnailStatus: "ready", statusDetail: "Thumbnail ready" });
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
    if (fallbackOutput.code === 0 && (await exists(outputRelativePath, { baseDir: BaseDirectory.AppData }))) {
      updateJob(jobId, { thumbnail: toFileUrl(outputPath) });
      updateJob(jobId, { thumbnailStatus: "ready", statusDetail: "Thumbnail ready" });
      return;
    }

    addLog({ level: "warn", message: "Thumbnail generation failed", jobId });
    updateJob(jobId, {
      thumbnailStatus: "failed",
      thumbnailError: "Could not generate thumbnail",
      statusDetail: "Thumbnail unavailable (download completed)",
    });
  } catch (e) {
    addLog({ level: "warn", message: `Thumbnail generation error: ${String(e)}`, jobId });
    updateJob(jobId, {
      thumbnailStatus: "failed",
      thumbnailError: String(e),
      statusDetail: "Thumbnail unavailable (download completed)",
    });
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
    args.push("--external-downloader-args", "aria2c:-x 16 -s 16 -k 1M --summary-interval=0");
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
  updateJob(jobId, {
    status: "Downloading",
    phase: "Resolving formats",
    statusDetail: "Preparing download",
    progress: 0,
    speed: undefined,
    eta: undefined,
    thumbnailStatus: "pending",
    thumbnailError: undefined,
    fallbackUsed: false,
    fallbackFormat: undefined,
  });

  const buildArgsWithFormat = (sourceArgs: string[], format: string) => {
    const next = [...sourceArgs];
    const formatIndex = next.indexOf("-f");
    if (formatIndex !== -1) next.splice(formatIndex, 2);
    next.push("-f", format);
    return next;
  };

  const buildFallbackAttempts = (sourceArgs: string[]) => {
    const formatIndex = sourceArgs.indexOf("-f");
    const formatValue = formatIndex !== -1 ? sourceArgs[formatIndex + 1] : "";
    const audioOnly =
      sourceArgs.includes("-x") ||
      sourceArgs.includes("--audio-format") ||
      (formatValue ? formatValue.startsWith("bestaudio") : false);

    const fallbacks = audioOnly
      ? ["bestaudio", "best"]
      : ["bestvideo+bestaudio/best", "best[ext=mp4]/best", "best"];

    return fallbacks.map((fmt) => ({ format: fmt, args: buildArgsWithFormat(sourceArgs, fmt) }));
  };

  const removeFlagWithValueFromArgs = (sourceArgs: string[], flag: string) => {
    const next = [...sourceArgs];
    let index = next.indexOf(flag);
    while (index !== -1) {
      next.splice(index, 2);
      index = next.indexOf(flag);
    }
    return next;
  };

  const stripExternalDownloaderArgs = (sourceArgs: string[]) => {
    let next = removeFlagWithValueFromArgs(sourceArgs, "--external-downloader");
    next = removeFlagWithValueFromArgs(next, "--external-downloader-args");
    next = removeFlagWithValueFromArgs(next, "--downloader");
    next = removeFlagWithValueFromArgs(next, "--downloader-args");
    return next;
  };

  const runDownload = async (runArgs: string[]) => {
    const cmd = Command.create(ytDlp.command, runArgs, { env: ytDlpEnv() });
    let lastKnownOutputPath: string | undefined;
    let formatUnavailable = false;
    let aria2Error = false;

    const outputParser = new OutputParser();
    let lastUpdate = 0;
    const UPDATE_INTERVAL = 500;
    let stdoutBuffer = "";
    let stderrBuffer = "";

    const flushStdoutLine = (line: string) => {
      const trimmedLine = line.replace(/\r/g, "");
      if (!trimmedLine) return;

      addLog({ level: "info", message: trimmedLine, jobId });

      if (trimmedLine.startsWith("[download]")) {
        updateJob(jobId, { phase: "Downloading streams", statusDetail: "Downloading media streams" });
      } else if (trimmedLine.startsWith("[Merger]")) {
        updateJob(jobId, {
          status: "Post-processing",
          phase: "Merging streams",
          statusDetail: "Merging audio and video",
        });
      } else if (trimmedLine.startsWith("[ffmpeg]") || trimmedLine.startsWith("[VideoConvertor]")) {
        updateJob(jobId, {
          status: "Post-processing",
          phase: "Converting with FFmpeg",
          statusDetail: "Converting to target format",
        });
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

    const flushStderrLine = (line: string) => {
      const trimmedLine = line.replace(/\r/g, "");
      if (!trimmedLine) return;

      const isWarning = /^warning:/i.test(trimmedLine) || /\bwarning\b/i.test(trimmedLine);
      addLog({ level: isWarning ? "warn" : "error", message: `STDERR: ${trimmedLine}`, jobId });

      if (/requested format is not available/i.test(trimmedLine)) {
        formatUnavailable = true;
        addLog({ level: "warn", message: "Requested format is not available, preparing fallback", jobId });
        updateJob(jobId, {
          phase: "Resolving formats",
          statusDetail: "Requested format unavailable, trying adaptive fallback",
        });
      }

      if (!isWarning && (trimmedLine.includes("aria2c") || trimmedLine.includes("downloader"))) {
        aria2Error = true;
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
      aria2Error: boolean;
    }>((resolve) => {
      cmd.on("close", (data) => {
        flushStdoutLine(stdoutBuffer);
        flushStderrLine(stderrBuffer);
        const code = typeof data.code === "number" ? data.code : 1;
        addLog({ level: "info", message: `Process finished with code ${code}`, jobId });
        resolve({ code, lastKnownOutputPath, formatUnavailable, aria2Error });
      });

      cmd.on("error", (error) => {
        const message = String(error);
        if (message.toLowerCase().includes("invalid utf-8 sequence")) {
          addLog({ level: "warn", message: `Process output decode warning: ${message}`, jobId });
          resolve({ code: 1, lastKnownOutputPath, formatUnavailable, aria2Error });
          return;
        }
        addLog({ level: "error", message: `Process error: ${message}`, jobId });
        resolve({ code: 1, lastKnownOutputPath, formatUnavailable, aria2Error });
      });

      cmd.spawn().catch((e) => {
        addLog({ level: "error", message: `Failed to spawn process: ${e}`, jobId });
        resolve({ code: 1, lastKnownOutputPath, formatUnavailable, aria2Error });
      });
    });
  };

  const hadExternalDownloader = args.includes("--external-downloader") || args.includes("--downloader");
  let activeArgs = [...args];
  let result = await runDownload(activeArgs);

  if (result.code !== 0 && hadExternalDownloader && result.aria2Error) {
    const nativeArgs = stripExternalDownloaderArgs(activeArgs);
    const nativeQuoted = nativeArgs.map(arg => arg.includes(" ") ? `"${arg}"` : arg).join(" ");
    addLog({ level: "warn", message: "aria2c error detected, retrying with native downloader", jobId });
    addLog({ level: "info", message: `Retrying without external downloader:\n${ytDlp.path} ${nativeQuoted}`, jobId });
    updateJob(jobId, {
      phase: "Downloading streams",
      statusDetail: "Retrying with native downloader",
    });
    activeArgs = nativeArgs;
    result = await runDownload(activeArgs);
  }

  if (result.code !== 0 && result.formatUnavailable) {
    const fallbackAttempts = buildFallbackAttempts(activeArgs);
    let fallbackSucceeded = false;

    for (const [index, attempt] of fallbackAttempts.entries()) {
      updateJob(jobId, {
        phase: "Resolving formats",
        statusDetail: `Trying fallback format ${index + 1}/${fallbackAttempts.length}: ${attempt.format}`,
      });
      const fallbackQuoted = attempt.args.map(arg => arg.includes(" ") ? `"${arg}"` : arg).join(" ");
      addLog({ level: "warn", message: `Falling back to format: ${attempt.format}`, jobId });
      addLog({ level: "info", message: `Retrying with fallback format:\n${ytDlp.path} ${fallbackQuoted}`, jobId });
      result = await runDownload(attempt.args);
      if (result.code === 0) {
        fallbackSucceeded = true;
        addLog({ level: "info", message: `Fallback succeeded with format: ${attempt.format}`, jobId });
        updateJob(jobId, {
          fallbackUsed: true,
          fallbackFormat: attempt.format,
          statusDetail: `Adaptive fallback active (${attempt.format})`,
        });
        break;
      }
      if (!result.formatUnavailable) {
        break;
      }
    }

    if (!fallbackSucceeded && result.code !== 0 && result.formatUnavailable) {
      addLog({ level: "error", message: "All fallback formats failed", jobId });
    }
  }

  if (result.code === 0) {
    updateJob(jobId, {
      status: "Post-processing",
      phase: "Generating thumbnail",
      statusDetail: "Finalizing download and generating thumbnail",
      progress: 100,
    });
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

    updateJob(jobId, { status: "Done", statusDetail: "Completed" });
  } else {
    if (result.formatUnavailable) {
      addLog({ level: "error", message: "Fallback failed: format unavailable after retry", jobId });
    }
    updateJob(jobId, {
      status: "Failed",
      phase: "Resolving formats",
      statusDetail: result.formatUnavailable
        ? "Failed to resolve a compatible format"
        : "Download failed (see logs)",
    });
  }
}

export async function fetchMetadata(jobId: string) {
  const { jobs, updateJob } = useDownloadsStore.getState();
  const job = jobs.find((j) => j.id === jobId);
  if (!job) return;

  try {
    updateJob(jobId, {
      phase: "Generating thumbnail",
      statusDetail: "Fetching metadata and thumbnail",
    });
    const ytDlp = await resolveTool("yt-dlp");
    const titleAndThumbCmd = Command.create(ytDlp.command, [
      "--print",
      "%(title)s:::%(thumbnail)s",
      "--skip-download",
      "--no-warnings",
      "--flat-playlist",
      "--no-playlist",
      "--referer", job.url,
      job.url
    ], { env: ytDlpEnv() });

    const titleAndThumbOutput = await titleAndThumbCmd.execute();
    if (titleAndThumbOutput.code === 0) {
      const parts = titleAndThumbOutput.stdout.trim().split(":::");
      if (parts.length >= 2) {
        const title = parts[0].trim();
        const thumbnailUrl = parts[1].trim();
        updateJob(jobId, {
          title: title || job.title,
          thumbnail: thumbnailUrl || undefined,
          thumbnailStatus: thumbnailUrl ? "ready" : "pending",
          thumbnailError: thumbnailUrl ? undefined : "No thumbnail URL available",
        });
        // If source provides thumbnail URL (e.g. Instagram), use it to avoid black-frame extraction.
        if (thumbnailUrl) return;
      }
    }

    if (isYouTubeUrl(job.url)) {
      // For YouTube, if no direct thumbnail was returned, avoid ffmpeg frame extraction.
      updateJob(jobId, {
        thumbnailStatus: "failed",
        thumbnailError: "No thumbnail URL available",
      });
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
    useLogsStore.getState().addLog({ level: "error", message: `[meta] Failed to fetch metadata: ${message}`, jobId });
    updateJob(jobId, {
      thumbnailStatus: "failed",
      thumbnailError: message,
    });
  }
}
