import { Child, Command } from "@tauri-apps/plugin-shell";
import { useDownloadsStore } from "@/store/downloads";
import { useLogsStore } from "@/store/logs";
import { usePresetsStore } from "@/store/presets";
import { canonicalizePresetId, resolvePresetById } from "@/lib/preset-display";
import { useSettingsStore } from "@/store/settings";
import { useRuntimeStore } from "@/store/runtime";
import { join } from "@tauri-apps/api/path";
import { OutputParser } from "@/lib/output-parser";
import { copyFilesToClipboard, deleteFile, renameFile } from "@/lib/commands";
import { resolveTool, ytDlpEnv, sendDownloadCompleteNotification } from "./tool-env";
import { cleanupThumbnailByJobId } from "./thumbnails";
import { fetchMediaInfo, fetchMetadata } from "./metadata";
import { downloadInstagramJob } from "./instagram";
import { isInstagramUrl } from "@/lib/media-engine";
import { useHistoryStore, extractDomain, type HistoryEntry } from "@/store/history";
import { stat } from "@tauri-apps/plugin-fs";
import { createId } from "@/lib/id";
import type { DownloadJob } from "@/store/downloads";
import { getExplicitOutputPaths } from "@/lib/output-paths";
import {
  normalizeSubtitlePreferences,
  resolveSubtitleLanguages,
  resolveSubtitlePlan,
  type SubtitleAvailability,
} from "@/lib/subtitles";

const ACTIVE_JOB_STATUSES = new Set<DownloadJob["status"]>([
  "Downloading",
  "Post-processing",
]);

const startingJobs = new Set<string>();
const activeYtDlpChildren = new Map<string, Child>();
const activeFfmpegChildren = new Map<string, Child>();
const holdRequestedJobs = new Map<string, "pause" | "stop">();

function decodeShellChunk(decoder: TextDecoder, chunk: string | Uint8Array, stream = true): string {
  return typeof chunk === "string" ? chunk : decoder.decode(chunk, { stream });
}

function consumeHoldRequest(jobId: string) {
  const request = holdRequestedJobs.get(jobId);
  if (request) {
    holdRequestedJobs.delete(jobId);
  }
  return request;
}

function getQueueOrder(job: DownloadJob) {
  return typeof job.queueOrder === "number" ? job.queueOrder : job.createdAt;
}

function getReservedJobIds(jobs: DownloadJob[]) {
  const reserved = new Set(startingJobs);
  jobs.forEach((job) => {
    if (ACTIVE_JOB_STATUSES.has(job.status)) {
      reserved.add(job.id);
    }
  });
  return reserved;
}

function launchJob(jobId: string) {
  const { jobs, updateJob } = useDownloadsStore.getState();
  const job = jobs.find((candidate) => candidate.id === jobId);
  if (!job) return false;
  if (startingJobs.has(jobId)) return false;
  if (ACTIVE_JOB_STATUSES.has(job.status) || job.status === "Done") return false;

  startingJobs.add(jobId);
  updateJob(jobId, {
    status: "Downloading",
    phase: "Resolving formats",
    statusDetail: "Preparing download",
    progress: 0,
    speed: undefined,
    eta: undefined,
  });

  void startDownload(jobId).finally(() => {
    startingJobs.delete(jobId);
    void startQueuedJobs();
  });

  return true;
}

export function startQueuedJobs(jobIds?: string[]) {
  const { jobs } = useDownloadsStore.getState();
  const { settings } = useSettingsStore.getState();
  const { queuePaused } = useRuntimeStore.getState();
  if (queuePaused) return 0;
  const allowedIds = jobIds ? new Set(jobIds) : undefined;
  const reservedIds = getReservedJobIds(jobs);
  const maxConcurrency = settings.maxConcurrency || 1;
  const availableSlots = Math.max(0, maxConcurrency - reservedIds.size);

  if (availableSlots === 0) return 0;

  const queued = jobs
    .filter(
      (job) =>
        job.status === "Queued" &&
        !reservedIds.has(job.id) &&
        (!allowedIds || allowedIds.has(job.id))
    )
    .sort((a, b) => getQueueOrder(b) - getQueueOrder(a))
    .slice(0, availableSlots);

  let started = 0;
  queued.forEach((job) => {
    if (launchJob(job.id)) started += 1;
  });

  return started;
}

export function retryFailedJobs(jobIds?: string[]) {
  const { jobs } = useDownloadsStore.getState();
  const { settings } = useSettingsStore.getState();
  const { queuePaused } = useRuntimeStore.getState();
  if (queuePaused) return 0;
  const allowedIds = jobIds ? new Set(jobIds) : undefined;
  const reservedIds = getReservedJobIds(jobs);
  const maxConcurrency = settings.maxConcurrency || 1;
  const availableSlots = Math.max(0, maxConcurrency - reservedIds.size);

  if (availableSlots === 0) return 0;

  const failed = jobs
    .filter(
      (job) =>
        job.status === "Failed" &&
        !reservedIds.has(job.id) &&
        (!allowedIds || allowedIds.has(job.id))
    )
    .sort((a, b) => {
      const at = typeof a.statusChangedAt === "number" ? a.statusChangedAt : a.createdAt;
      const bt = typeof b.statusChangedAt === "number" ? b.statusChangedAt : b.createdAt;
      return bt - at;
    })
    .slice(0, availableSlots);

  let started = 0;
  failed.forEach((job) => {
    if (launchJob(job.id)) started += 1;
  });

  return started;
}

export async function pauseActiveDownload(jobId: string) {
  const { jobs, updateJob } = useDownloadsStore.getState();
  const { addLog } = useLogsStore.getState();
  const job = jobs.find((candidate) => candidate.id === jobId);
  const child = activeYtDlpChildren.get(jobId);

  if (!job || job.status !== "Downloading" || !child) {
    return false;
  }

  holdRequestedJobs.set(jobId, "pause");
  updateJob(jobId, {
    statusDetail: "Pausing download...",
    speed: undefined,
    eta: undefined,
    resumeBehavior: "continue",
  });

  try {
    await child.kill();
    addLog({ level: "info", message: "Pause requested for active yt-dlp download", jobId });
    return true;
  } catch (error) {
    holdRequestedJobs.delete(jobId);
    addLog({ level: "error", message: `Failed to pause download: ${String(error)}`, jobId });
    updateJob(jobId, {
      statusDetail: "Could not pause download",
    });
    return false;
  }
}

export async function stopPostProcessingJob(jobId: string) {
  const { jobs, updateJob } = useDownloadsStore.getState();
  const { addLog } = useLogsStore.getState();
  const job = jobs.find((candidate) => candidate.id === jobId);
  const child = activeFfmpegChildren.get(jobId) ?? activeYtDlpChildren.get(jobId);

  if (!job || job.status !== "Post-processing" || !child) {
    return false;
  }

  holdRequestedJobs.set(jobId, "stop");
  updateJob(jobId, {
    statusDetail: "Stopping current process...",
    speed: undefined,
    eta: undefined,
    resumeBehavior: "restart",
  });

  try {
    await child.kill();
    addLog({ level: "info", message: "Stop requested for active post-processing job", jobId });
    return true;
  } catch (error) {
    holdRequestedJobs.delete(jobId);
    addLog({ level: "error", message: `Failed to stop processing job: ${String(error)}`, jobId });
    updateJob(jobId, {
      statusDetail: "Could not stop current process",
    });
    return false;
  }
}

export function resumePausedDownload(jobId: string) {
  const { jobs, updateJob } = useDownloadsStore.getState();
  const { queuePaused } = useRuntimeStore.getState();
  const job = jobs.find((candidate) => candidate.id === jobId);

  if (!job || (job.status !== "Paused" && job.status !== "Stopped")) {
    return false;
  }

  const willRestart = job.resumeBehavior === "restart";
  updateJob(jobId, {
    status: "Queued",
    phase: "Resolving formats",
    statusDetail: queuePaused
      ? "Queue paused"
      : willRestart
        ? "Restarting with new preset"
        : "Resuming download",
    progress: willRestart ? 0 : job.progress,
    speed: undefined,
    eta: undefined,
    ffmpegProgressKnown: undefined,
  });

  if (!queuePaused) {
    startQueuedJobs([jobId]);
  }

  return true;
}

export function changePausedJobPreset(jobId: string, presetId: string) {
  const { jobs, updateJob } = useDownloadsStore.getState();
  const job = jobs.find((candidate) => candidate.id === jobId);

  if (!job || (job.status !== "Paused" && job.status !== "Stopped")) {
    return false;
  }

  const nextPresetId = canonicalizePresetId(presetId);
  const preservedOverrides = {
    downloadDir: job.overrides?.downloadDir,
    filenameTemplate: job.overrides?.filenameTemplate,
    origin: job.overrides?.origin,
  };

  updateJob(jobId, {
    presetId: nextPresetId,
    overrides: preservedOverrides,
    progress: 0,
    speed: undefined,
    eta: undefined,
    phase: "Resolving formats",
    statusDetail:
      job.status === "Stopped"
        ? "Preset changed. Restart to run again with the new preset."
        : "Preset changed. Resume to restart with the new preset.",
    resumeBehavior: "restart",
    fallbackUsed: false,
    fallbackFormat: undefined,
    ffmpegProgressKnown: undefined,
  });

  return true;
}

async function probeMediaDurationSeconds(
  inputPath: string,
  jobId: string,
  addLog: (entry: { level: "info" | "warn" | "error" | "debug"; message: string; jobId?: string }) => void
) {
  try {
    const ffprobe = await resolveTool("ffprobe");
    const probeCmd = Command.create(ffprobe.command, [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=nw=1:nk=1",
      inputPath,
    ]);
    const result = await probeCmd.execute();
    if (result.code !== 0) {
      addLog({
        level: "warn",
        message: `ffprobe duration probe failed (code ${result.code})`,
        jobId,
      });
      return null;
    }

    const raw = result.stdout.trim();
    const duration = Number.parseFloat(raw);
    if (!Number.isFinite(duration) || duration <= 0) {
      addLog({
        level: "warn",
        message: `ffprobe returned invalid duration: ${raw || "<empty>"}`,
        jobId,
      });
      return null;
    }

    return duration;
  } catch (error) {
    addLog({
      level: "warn",
      message: `Could not probe media duration for FFmpeg progress: ${String(error)}`,
      jobId,
    });
    return null;
  }
}

function getSubtitlePreferences(job: DownloadJob) {
  const { presets } = usePresetsStore.getState();
  const preset = resolvePresetById(presets, job.presetId) ?? presets[0];
  const base = normalizeSubtitlePreferences({
    mode: preset?.subtitleOnly ? "only" : preset?.subtitleMode,
    sourcePolicy: preset?.subtitleSourcePolicy,
    languageMode: preset?.subtitleLanguageMode,
    languages: preset?.subtitleLanguages,
    format: preset?.subtitleFormat,
  });

  return normalizeSubtitlePreferences({
    ...base,
    mode: job.overrides?.subtitleOnly
      ? "only"
      : (job.overrides?.subtitleMode ?? base.mode),
    sourcePolicy: job.overrides?.subtitleSourcePolicy ?? base.sourcePolicy,
    languageMode: job.overrides?.subtitleLanguageMode ?? base.languageMode,
    languages:
      job.overrides?.subtitleLanguages && job.overrides.subtitleLanguages.length > 0
        ? job.overrides.subtitleLanguages
        : base.languages,
    format: job.overrides?.subtitleFormat ?? base.format,
  });
}

export async function startDownload(jobId: string) {
  const { jobs, updateJob, removeJob } = useDownloadsStore.getState();

  const { addLog } = useLogsStore.getState();
  const { presets } = usePresetsStore.getState();
  const { settings } = useSettingsStore.getState();

  const job = jobs.find((j) => j.id === jobId);
  if (!job) return;
  if (
    job.status !== "Queued" &&
    job.status !== "Failed" &&
    !ACTIVE_JOB_STATUSES.has(job.status)
  ) {
    return;
  }

  const preset = resolvePresetById(presets, job.presetId) ?? presets[0];
  const subtitlePreferences = getSubtitlePreferences(job);

  const finalizePausedDownload = async (detail = "Paused. Resume to continue.") => {
    const latestJob = useDownloadsStore.getState().jobs.find((candidate) => candidate.id === jobId);
    updateJob(jobId, {
      status: "Paused",
      phase: latestJob?.phase ?? "Downloading streams",
      statusDetail: detail,
      speed: undefined,
      eta: undefined,
      ffmpegProgressKnown: undefined,
      resumeBehavior: latestJob?.resumeBehavior ?? job.resumeBehavior ?? "continue",
    });
  };

  const finalizeStoppedDownload = async (
    detail = "Stopped during processing. Restart to run again."
  ) => {
    const latestJob = useDownloadsStore.getState().jobs.find((candidate) => candidate.id === jobId);
    updateJob(jobId, {
      status: "Stopped",
      phase: latestJob?.phase ?? "Converting with FFmpeg",
      statusDetail: detail,
      speed: undefined,
      eta: undefined,
      ffmpegProgressKnown: undefined,
      resumeBehavior: "restart",
      progress: 0,
    });
  };

  const finalizeHoldRequest = async () => {
    const request = consumeHoldRequest(jobId);
    if (!request) return false;
    if (request === "pause") {
      await finalizePausedDownload();
    } else {
      await finalizeStoppedDownload();
    }
    return true;
  };

  const finalizeSuccessfulDownload = async (
    lastKnownOutputPath?: string,
    explicitOutputPaths?: string[]
  ) => {
    updateJob(jobId, {
      status: "Post-processing",
      phase: "Generating thumbnail",
      statusDetail: "Finalizing download",
      progress: 100,
      ffmpegProgressKnown: undefined,
    });
    fetchMetadata(jobId);

    setTimeout(() => {
      const { settings } = useSettingsStore.getState();
      const finalJob = useDownloadsStore.getState().jobs.find((j) => j.id === jobId);
      const outputPathToUse = lastKnownOutputPath || finalJob?.outputPath;
      const resolvedOutputPaths = explicitOutputPaths?.length
        ? explicitOutputPaths
        : outputPathToUse
          ? [outputPathToUse]
          : finalJob
            ? getExplicitOutputPaths(finalJob)
            : [];

      if (lastKnownOutputPath && finalJob?.outputPath !== lastKnownOutputPath) {
        updateJob(jobId, {
          outputPath: lastKnownOutputPath,
          ...(resolvedOutputPaths.length ? { outputPaths: resolvedOutputPaths } : {}),
        });
      }

      if (settings.notifications && finalJob) {
        const title = finalJob.title || "Download Complete";
        sendDownloadCompleteNotification(
          "Download Finished",
          `${title} has been downloaded successfully.`,
          {
            screen: "downloads",
            targetType: "job",
            targetId: jobId,
            section: "recent",
            reason: "download-finished",
            actionLabel: "Show download",
          }
        );
      }

      if (settings.autoCopyFile && resolvedOutputPaths.length > 0) {
        copyFilesToClipboard(resolvedOutputPaths).catch((e) => {
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

    const doneJob = useDownloadsStore.getState().jobs.find((j) => j.id === jobId);
    if (doneJob) {
      const finalPath = lastKnownOutputPath || doneJob.outputPath;
      const explicitPaths = explicitOutputPaths?.length ? explicitOutputPaths : getExplicitOutputPaths(doneJob);
      let fileSize: number | undefined;
      if (finalPath) {
        try {
          const info = await stat(finalPath);
          fileSize = info.size;
        } catch {
          void 0;
        }
      }
      const entry: HistoryEntry = {
        id: createId(),
        url: doneJob.url,
        title: doneJob.title || doneJob.url,
        thumbnail: doneJob.thumbnail,
        format: doneJob.overrides?.format || doneJob.fallbackFormat,
        fileSize,
        outputPath: finalPath,
        outputPaths: explicitPaths,
        presetId: doneJob.presetId,
        presetName: preset?.name,
        downloadedAt: Date.now(),
        duration: doneJob.createdAt ? Date.now() - doneJob.createdAt : undefined,
        domain: extractDomain(doneJob.url),
        status: "completed",
        overrides: doneJob.overrides,
      };
      useHistoryStore.getState().addEntry(entry);
    }
  };

  const finalizeFailedDownload = async (failDetail: string) => {
    updateJob(jobId, {
      status: "Failed",
      phase: "Resolving formats",
      statusDetail: failDetail,
      ffmpegProgressKnown: undefined,
    });

    const failedJob = useDownloadsStore.getState().jobs.find((j) => j.id === jobId);
    if (failedJob) {
      const entry: HistoryEntry = {
        id: createId(),
        url: failedJob.url,
        title: failedJob.title || failedJob.url,
        thumbnail: failedJob.thumbnail,
        format: failedJob.overrides?.format,
        outputPath: failedJob.outputPath,
        outputPaths: failedJob.outputPaths,
        presetId: failedJob.presetId,
        presetName: preset?.name,
        downloadedAt: Date.now(),
        duration: failedJob.createdAt ? Date.now() - failedJob.createdAt : undefined,
        domain: extractDomain(failedJob.url),
        status: "failed",
        failReason: failDetail,
        overrides: failedJob.overrides,
      };
      useHistoryStore.getState().addEntry(entry);
    }
  };

  if (isInstagramUrl(job.url)) {
    const instagramResult = await downloadInstagramJob({
      job,
      preset,
      settings,
      subtitlePreferences,
      updateJob,
      addLog,
    });

    if (instagramResult.code === 0) {
      await finalizeSuccessfulDownload(instagramResult.lastKnownOutputPath, instagramResult.outputPaths);
    } else {
      await finalizeFailedDownload(instagramResult.failDetail);
    }
    return;
  }

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

  if (subtitlePreferences.mode !== "off") {
    let availability: SubtitleAvailability = {
      hasManualSubtitles: Boolean(job.hasManualSubtitles),
      hasAutoSubtitles: Boolean(job.hasAutoSubtitles),
      availableSubtitleLanguages: job.availableSubtitleLanguages ?? [],
    };

    if (
      job.subtitleStatus !== "available" &&
      job.subtitleStatus !== "unavailable"
    ) {
      try {
        updateJob(jobId, { subtitleStatus: "checking" });
        const info = await fetchMediaInfo(job.url);
        availability = {
          hasManualSubtitles: info.hasManualSubtitles,
          hasAutoSubtitles: info.hasAutoSubtitles,
          availableSubtitleLanguages: info.availableSubtitleLanguages,
        };
        updateJob(jobId, {
          subtitleStatus:
            info.hasManualSubtitles || info.hasAutoSubtitles ? "available" : "unavailable",
          hasManualSubtitles: info.hasManualSubtitles,
          hasAutoSubtitles: info.hasAutoSubtitles,
          availableSubtitleLanguages: info.availableSubtitleLanguages,
        });
      } catch (error) {
        addLog({
          level: "warn",
          message: `Subtitle availability probe failed: ${String(error)}`,
          jobId,
        });
        updateJob(jobId, { subtitleStatus: "error" });
      }
    }

    const subtitlePlan = resolveSubtitlePlan(subtitlePreferences, availability);
    updateJob(jobId, { resolvedSubtitleSource: subtitlePlan.resolvedSource });

    if (subtitlePlan.resolvedSource === "none") {
      addLog({ level: "warn", message: "No subtitles available for this media", jobId });
      if (subtitlePlan.subtitleOnly) {
        updateJob(jobId, {
          status: "Failed",
          phase: "Resolving formats",
          statusDetail: "No subtitles available",
          resolvedSubtitleSource: "none",
        });
        return;
      }
    } else {
      if (subtitlePlan.resolvedSource === "manual") {
        args.push("--write-subs");
      } else {
        args.push("--write-auto-subs");
      }

      args.push(
        "--sub-langs",
        resolveSubtitleLanguages(
          subtitlePreferences,
          settings.preferredSubtitleLanguages
        ).join(",")
      );

      if (subtitlePreferences.format !== "original") {
        args.push("--convert-subs", subtitlePreferences.format);
      }

      if (subtitlePlan.subtitleOnly) {
        args.push("--skip-download");
      }

      addLog({
        level: "info",
        message: `Subtitle plan: ${subtitlePlan.resolvedSource} (${subtitlePreferences.format})`,
        jobId,
      });
    }
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

  if (job.resumeBehavior === "restart") {
    args.push("--no-continue");
    addLog({ level: "info", message: "Restarting paused job from the beginning", jobId });
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
    ffmpegProgressKnown: undefined,
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
    const cmd = Command.create(ytDlp.command, runArgs, { env: ytDlpEnv(), encoding: "raw" });
    let lastKnownOutputPath: string | undefined;
    let formatUnavailable = false;
    let aria2Error = false;

    const outputParser = new OutputParser();
    let lastUpdate = 0;
    const UPDATE_INTERVAL = 500;
    let stdoutBuffer = "";
    let stderrBuffer = "";
    const stdoutDecoder = new TextDecoder();
    const stderrDecoder = new TextDecoder();

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
      stdoutBuffer += decodeShellChunk(stdoutDecoder, chunk);
      const parts = stdoutBuffer.split(/\n/);
      stdoutBuffer = parts.pop() ?? "";
      for (const part of parts) flushStdoutLine(part);
    });

    cmd.stderr.on("data", (chunk) => {
      stderrBuffer += decodeShellChunk(stderrDecoder, chunk);
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
      let settled = false;
      let childRef: Child | null = null;
      const finish = (code: number) => {
        if (settled) return;
        settled = true;
        if (childRef && activeYtDlpChildren.get(jobId)?.pid === childRef.pid) {
          activeYtDlpChildren.delete(jobId);
        }
        resolve({ code, lastKnownOutputPath, formatUnavailable, aria2Error });
      };

      cmd.on("close", (data) => {
        stdoutBuffer += stdoutDecoder.decode();
        stderrBuffer += stderrDecoder.decode();
        flushStdoutLine(stdoutBuffer);
        flushStderrLine(stderrBuffer);
        const code = typeof data.code === "number" ? data.code : 1;
        addLog({ level: "info", message: `Process finished with code ${code}`, jobId });
        finish(code);
      });

      cmd.on("error", (error) => {
        const message = String(error);
        if (message.toLowerCase().includes("invalid utf-8 sequence")) {
          addLog({ level: "warn", message: `Process output decode warning: ${message}`, jobId });
          return;
        }
        addLog({ level: "error", message: `Process error: ${message}`, jobId });
        finish(1);
      });

      cmd.spawn()
        .then((child) => {
          childRef = child;
          activeYtDlpChildren.set(jobId, child);
        })
        .catch((e) => {
          addLog({ level: "error", message: `Failed to spawn process: ${e}`, jobId });
          finish(1);
        });
    });
  };

  const runAttemptWithDownloaderFallback = async (runArgs: string[]) => {
    let effectiveArgs = [...runArgs];
    let attemptResult = await runDownload(effectiveArgs);

    const usesExternalDownloader =
      effectiveArgs.includes("--external-downloader") || effectiveArgs.includes("--downloader");

    if (attemptResult.code !== 0 && usesExternalDownloader && attemptResult.aria2Error) {
      const nativeArgs = stripExternalDownloaderArgs(effectiveArgs);
      const nativeQuoted = nativeArgs.map(arg => arg.includes(" ") ? `"${arg}"` : arg).join(" ");
      addLog({ level: "warn", message: "aria2c error detected, retrying with native downloader", jobId });
      addLog({ level: "info", message: `Retrying without external downloader:\n${ytDlp.path} ${nativeQuoted}`, jobId });
      updateJob(jobId, {
        phase: "Downloading streams",
        statusDetail: "Retrying with native downloader",
      });
      effectiveArgs = nativeArgs;
      attemptResult = await runDownload(effectiveArgs);
    }

    return { effectiveArgs, attemptResult };
  };

  const { effectiveArgs: resolvedInitialArgs, attemptResult: initialResult } =
    await runAttemptWithDownloaderFallback([...args]);
  let result = initialResult;

  if (await finalizeHoldRequest()) {
    return;
  }

  let didFallback = false;

  if (result.code !== 0 && result.formatUnavailable) {
    const fallbackAttempts = buildFallbackAttempts(resolvedInitialArgs);

    for (const [index, attempt] of fallbackAttempts.entries()) {
      updateJob(jobId, {
        phase: "Resolving formats",
        statusDetail: `Trying fallback format ${index + 1}/${fallbackAttempts.length}: ${attempt.format}`,
      });
      const fallbackQuoted = attempt.args.map(arg => arg.includes(" ") ? `"${arg}"` : arg).join(" ");
      addLog({ level: "warn", message: `Falling back to format: ${attempt.format}`, jobId });
      addLog({ level: "info", message: `Retrying with fallback format:\n${ytDlp.path} ${fallbackQuoted}`, jobId });
      const fallbackRun = await runAttemptWithDownloaderFallback(attempt.args);
      result = fallbackRun.attemptResult;
      if (await finalizeHoldRequest()) {
        return;
      }
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
      const inputDurationSeconds = await probeMediaDurationSeconds(inputPath, jobId, addLog);

      updateJob(jobId, {
        status: "Post-processing",
        phase: "Converting with FFmpeg",
        statusDetail: inputDurationSeconds
          ? "Converting to target format with FFmpeg"
          : "Converting to target format",
        progress: 0,
        speed: undefined,
        eta: undefined,
        ffmpegProgressKnown: Boolean(inputDurationSeconds),
      });

      const ffmpegArgs = [
        "-progress",
        "pipe:1",
        "-nostats",
        ...(inputDurationSeconds ? ["-stats_period", "0.5"] : []),
        "-i",
        inputPath,
        ...conversionArgs,
        "-y",
        tmpPath,
      ];
      const ffmpegQuoted = ffmpegArgs.map(a => a.includes(" ") ? `"${a}"` : a).join(" ");
      addLog({ level: "info", message: `Running separate FFmpeg conversion:\n${ffmpeg.path} ${ffmpegQuoted}`, jobId });

      const ffmpegCmd = Command.create(ffmpeg.command, ffmpegArgs);
      const ffmpegResult = await new Promise<{ code: number; stderr: string }>((resolve) => {
        let stdoutBuffer = "";
        let stderrBuffer = "";
        let childRef: Child | null = null;
        const progressState: {
          outTimeUs?: number;
          speed?: string;
        } = {};
        let lastProgressUpdate = 0;

        const flushProgressLine = (line: string) => {
          const trimmed = line.replace(/\r/g, "").trim();
          if (!trimmed) return;

          const eqIndex = trimmed.indexOf("=");
          if (eqIndex === -1) {
            addLog({ level: "info", message: `[ffmpeg] ${trimmed}`, jobId });
            return;
          }

          const key = trimmed.slice(0, eqIndex);
          const value = trimmed.slice(eqIndex + 1);

          if (key === "out_time_us" || key === "out_time_ms") {
            const parsed = Number.parseInt(value, 10);
            if (Number.isFinite(parsed)) {
              progressState.outTimeUs = parsed;
            }
          }

          if (key === "speed") {
            progressState.speed = value.trim();
          }

          if (key === "progress") {
            if (value === "continue" || value === "end") {
              const now = Date.now();
              const shouldUpdate = value === "end" || now - lastProgressUpdate >= 250;

              if (inputDurationSeconds && shouldUpdate) {
                const outTimeUs = progressState.outTimeUs ?? 0;
                const percent = Math.max(
                  0,
                  Math.min(100, (outTimeUs / (inputDurationSeconds * 1_000_000)) * 100)
                );
                updateJob(jobId, {
                  progress: percent,
                  speed: progressState.speed,
                  statusDetail:
                    value === "end"
                      ? "Wrapping up FFmpeg conversion"
                      : `Converting to target format (${Math.round(percent)}%)`,
                });
                lastProgressUpdate = now;
              }
            }
            return;
          }
        };

        const flushStderrLine = (line: string) => {
          const trimmed = line.replace(/\r/g, "");
          if (!trimmed) return;
          addLog({ level: "info", message: `[ffmpeg] ${trimmed}`, jobId });
        };

        ffmpegCmd.stdout.on("data", (chunk) => {
          stdoutBuffer += chunk;
          const parts = stdoutBuffer.split(/\n/);
          stdoutBuffer = parts.pop() ?? "";
          for (const part of parts) flushProgressLine(part);
        });

        ffmpegCmd.stderr.on("data", (chunk) => {
          stderrBuffer += chunk;
          const parts = stderrBuffer.split(/\n/);
          stderrBuffer = parts.pop() ?? "";
          for (const part of parts) flushStderrLine(part);
        });

        ffmpegCmd.on("close", (data) => {
          flushProgressLine(stdoutBuffer);
          flushStderrLine(stderrBuffer);
          if (childRef && activeFfmpegChildren.get(jobId)?.pid === childRef.pid) {
            activeFfmpegChildren.delete(jobId);
          }
          resolve({
            code: typeof data.code === "number" ? data.code : 1,
            stderr: stderrBuffer,
          });
        });

        ffmpegCmd.on("error", (error) => {
          const message = String(error);
          if (childRef && activeFfmpegChildren.get(jobId)?.pid === childRef.pid) {
            activeFfmpegChildren.delete(jobId);
          }
          addLog({ level: "error", message: `FFmpeg process error: ${message}`, jobId });
          resolve({ code: 1, stderr: message });
        });

        ffmpegCmd.spawn()
          .then((child) => {
            childRef = child;
            activeFfmpegChildren.set(jobId, child);
          })
          .catch((error) => {
            const message = String(error);
            addLog({ level: "error", message: `Failed to spawn FFmpeg: ${message}`, jobId });
            resolve({ code: 1, stderr: message });
          });
      });

      const holdRequest = consumeHoldRequest(jobId);
      if (holdRequest) {
        try { await deleteFile(tmpPath); } catch { void 0; }
        if (holdRequest === "stop") {
          await finalizeStoppedDownload("Stopped during FFmpeg processing. Restart to run again.");
        } else {
          await finalizePausedDownload();
        }
        return;
      }

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
    await finalizeSuccessfulDownload(result.lastKnownOutputPath);
  } else {
    if (await finalizeHoldRequest()) {
      return;
    }
    if (result.formatUnavailable) {
      addLog({ level: "error", message: "Fallback failed: format unavailable after retry", jobId });
    }
    const failDetail = result.formatUnavailable
      ? "Failed to resolve a compatible format"
      : "Download failed (see logs)";
    await finalizeFailedDownload(failDetail);
  }
}
