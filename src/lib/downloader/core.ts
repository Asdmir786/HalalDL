import { Command } from "@tauri-apps/plugin-shell";
import { useDownloadsStore } from "@/store/downloads";
import { useLogsStore } from "@/store/logs";
import { usePresetsStore } from "@/store/presets";
import { useSettingsStore } from "@/store/settings";
import { join } from "@tauri-apps/api/path";
import { OutputParser } from "@/lib/output-parser";
import { copyFilesToClipboard, deleteFile, renameFile } from "@/lib/commands";
import { resolveTool, ytDlpEnv, sendDownloadCompleteNotification } from "./tool-env";
import { cleanupThumbnailByJobId } from "./thumbnails";
import { fetchMetadata } from "./metadata";

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

  if (job.overrides?.format) {
    const removeFlagWithValue = (flag: string) => {
      const i = args.indexOf(flag);
      if (i !== -1) args.splice(i, 2);
    };
    const removeFlag = (flag: string) => {
      const i = args.indexOf(flag);
      if (i !== -1) args.splice(i, 1);
    };

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
            args.push("-f", job.overrides.format);
            addLog({ level: "info", message: `Format override applied: ${job.overrides.format}`, jobId });
    }
  }

  if (ffmpeg.isLocal) {
    const ffmpegDir = ffmpeg.path.replace(/\\ffmpeg\.exe$/, "");
    args.push("--ffmpeg-location", ffmpegDir);
  }

  if (aria2.isLocal) {
    addLog({ level: "info", message: `Using local aria2c: ${aria2.path}`, jobId });
    args.push("--external-downloader", aria2.path);
    args.push("--external-downloader-args", "aria2c:-x 16 -s 16 -k 1M --summary-interval=0");
  } else {
    addLog({ level: "info", message: "Aria2c not found in local bin, checking system PATH...", jobId });
  }

  const downloadDir = job.overrides?.downloadDir || settings.defaultDownloadDir;
  const outputFormatIndex = args.indexOf("-f");
  const outputFormatValue = outputFormatIndex !== -1 ? args[outputFormatIndex + 1] ?? "" : "";
  const inferredAudioOnly =
    args.includes("-x") ||
    args.includes("--audio-format") ||
    (outputFormatValue.startsWith("bestaudio") && !outputFormatValue.includes("+"));
  const defaultFilenameTemplate =
    settings.fileCollision === "rename"
      ? `%(title)s${inferredAudioOnly ? " [audio]" : " [video]"} [${jobId}].%(ext)s`
      : "%(title)s.%(ext)s";
  const filenameTemplate = job.overrides?.filenameTemplate || defaultFilenameTemplate;

  if (downloadDir) {
    args.push("-o", await join(downloadDir, filenameTemplate));
  } else {
    args.push("-o", filenameTemplate);
  }

  if (settings.fileCollision === "overwrite") {
    args.push("--force-overwrites");
    addLog({ level: "info", message: "File collision policy: overwrite", jobId });
  } else if (settings.fileCollision === "skip") {
    args.push("--no-overwrites");
    addLog({ level: "info", message: "File collision policy: skip existing files", jobId });
  } else {
    args.push("--no-overwrites");
    addLog({ level: "info", message: "File collision policy: rename (unique filename per job)", jobId });
  }

  args.push("--ignore-config", "--newline", "--no-colors", "--no-playlist");
  args.push("--print", "after_move:__HALALDL_OUTPUT__:%(filepath)s");

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

  const removeFlagWithValueFromArgs = (a: string[], flag: string): string[] => {
    const out = [...a];
    let idx = out.indexOf(flag);
    while (idx !== -1) {
      out.splice(idx, 2);
      idx = out.indexOf(flag);
    }
    return out;
  };

  const buildFallbackAttempts = (sourceArgs: string[]) => {
    const formatIndex = sourceArgs.indexOf("-f");
    const formatValue = formatIndex !== -1 ? sourceArgs[formatIndex + 1] : "";
    const audioOnly =
      sourceArgs.includes("-x") ||
      sourceArgs.includes("--audio-format") ||
      (formatValue ? formatValue.startsWith("bestaudio") : false);

    const stripped = formatValue.replace(/\[[^\]]*\]/g, "");
    const simplified = [...new Set(stripped.split("/").filter(Boolean))].join("/");

    const buildCleanArgs = (format: string) => {
      let next = buildArgsWithFormat(sourceArgs, format);
      next = removeFlagWithValueFromArgs(next, "--postprocessor-args");
      next = removeFlagWithValueFromArgs(next, "--recode-video");
      return next;
    };

    const fallbacks: Array<{ format: string; args: string[] }> = [];

    if (simplified && simplified !== formatValue) {
      fallbacks.push({ format: simplified, args: buildCleanArgs(simplified) });
    }

    const genericFmt = audioOnly ? "bestaudio" : "bestvideo+bestaudio/best";
    if (!fallbacks.some((f) => f.format === genericFmt)) {
      fallbacks.push({ format: genericFmt, args: buildCleanArgs(genericFmt) });
    }

    fallbacks.push({ format: "best", args: buildCleanArgs("best") });

    return fallbacks;
  };

  const getFallbackConversionArgs = (): string[] | null => {
    const formatIndex = args.indexOf("-f");
    const formatValue = formatIndex !== -1 ? args[formatIndex + 1] : "";
    const audioOnly =
      args.includes("-x") || args.includes("--audio-format") ||
      (formatValue ? formatValue.startsWith("bestaudio") : false);
    if (audioOnly) return null;

    const ppIdx = args.indexOf("--postprocessor-args");
    if (ppIdx !== -1 && args[ppIdx + 1]?.includes("VideoConvertor:")) {
      return args[ppIdx + 1].replace("VideoConvertor:", "").split(/\s+/).filter(Boolean);
    }

    if (/\[vcodec\^=avc1\]/.test(formatValue)) {
      return ["-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-movflags", "+faststart"];
    }

    if (args.includes("--recode-video")) {
      return ["-c:v", "copy", "-c:a", "copy"];
    }

    return null;
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

  let didFallback = false;

  if (result.code !== 0 && result.formatUnavailable) {
    const fallbackAttempts = buildFallbackAttempts(activeArgs);

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
        didFallback = true;
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

    if (!didFallback && result.code !== 0 && result.formatUnavailable) {
      addLog({ level: "error", message: "All fallback formats failed", jobId });
    }
  }

  if (result.code === 0 && didFallback && result.lastKnownOutputPath) {
    const conversionArgs = getFallbackConversionArgs();
    if (conversionArgs) {
      const inputPath = result.lastKnownOutputPath;
      const mergeIdx = args.indexOf("--merge-output-format");
      const recodeIdx = args.indexOf("--recode-video");
      const targetExt = mergeIdx !== -1 ? args[mergeIdx + 1]
                      : recodeIdx !== -1 ? args[recodeIdx + 1]
                      : "mp4";
      const baseName = inputPath.replace(/\.[^.]+$/, "");
      const tmpPath = `${baseName}.converting.${targetExt}`;
      const finalPath = `${baseName}.${targetExt}`;

      updateJob(jobId, {
        status: "Post-processing",
        phase: "Converting with FFmpeg",
        statusDetail: "Converting to target format",
        progress: 99,
      });

      const ffmpegArgs = ["-i", inputPath, ...conversionArgs, "-y", tmpPath];
      const ffmpegQuoted = ffmpegArgs.map(a => a.includes(" ") ? `"${a}"` : a).join(" ");
      addLog({ level: "info", message: `Running separate FFmpeg conversion:\n${ffmpeg.path} ${ffmpegQuoted}`, jobId });

      const ffmpegCmd = Command.create(ffmpeg.command, ffmpegArgs);
      const ffmpegResult = await ffmpegCmd.execute();

      if (ffmpegResult.code === 0) {
        addLog({ level: "info", message: "FFmpeg conversion succeeded, replacing original file", jobId });
        try {
          await deleteFile(inputPath);
          if (tmpPath !== finalPath) {
            await renameFile(tmpPath, finalPath);
          }
          result.lastKnownOutputPath = finalPath;
        } catch (e) {
          addLog({ level: "error", message: `File swap failed: ${e}`, jobId });
          try { await deleteFile(tmpPath); } catch { void 0; }
        }
      } else {
        addLog({ level: "error", message: `FFmpeg conversion failed (code ${ffmpegResult.code}):\n${ffmpegResult.stderr}`, jobId });
        try { await deleteFile(tmpPath); } catch { void 0; }
      }
    }
  }

  if (result.code === 0) {
    updateJob(jobId, {
      status: "Post-processing",
      phase: "Generating thumbnail",
      statusDetail: "Finalizing download",
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
