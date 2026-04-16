import { Command } from "@tauri-apps/plugin-shell";
import { downloadDir as defaultDownloadDir, join } from "@tauri-apps/api/path";
import { exists, mkdir } from "@tauri-apps/plugin-fs";
import type { DownloadJob } from "@/store/downloads";
import type { Preset } from "@/store/presets";
import type { Settings } from "@/store/settings";
import type { SubtitlePreferences } from "@/lib/subtitles";
import { deleteFile, downloadUrlToFile } from "@/lib/commands";
import { ensureFilenameTemplateExtension } from "@/lib/output-paths";
import {
  extractInstagramShortcode,
  getInstagramResourceType,
  resolveInstagramWithDownloadgram,
  type InstagramMediaItem,
  type InstagramResolveResult,
} from "@/lib/media-engine";
import { resolveTool } from "./tool-env";

type InstagramDownloadResult =
  | {
      code: 0;
      lastKnownOutputPath: string;
      outputPaths: string[];
      resolved: InstagramResolveResult;
    }
  | {
      code: 1;
      failDetail: string;
    };

export interface InstagramMediaSummary {
  kind: InstagramResolveResult["kind"];
  itemCount: number;
  hasImage: boolean;
  hasVideo: boolean;
  isImageOnly: boolean;
  isVideoOnly: boolean;
  isMixedCarousel: boolean;
}

const VIDEO_CONTAINER_OVERRIDES = new Set(["webm", "mkv", "mov", "avi"]);

type PostProcessPlan =
  | {
      mode: "none";
    }
  | {
      mode: "audio" | "video";
      outputExt: string;
      ffmpegArgs: string[];
      label: string;
    };

type PlannedInstagramItem = {
  item: InstagramMediaItem;
  destination: string;
  downloadPath: string;
  shouldPostProcess: boolean;
};

const INSTAGRAM_CAROUSEL_DOWNLOAD_CONCURRENCY = 2;
const INSTAGRAM_STATUS_PROGRESS_SHARE = {
  downloadOnly: 95,
  withPostProcess: 70,
} as const;

export async function downloadInstagramJob(options: {
  job: DownloadJob;
  preset: Preset;
  settings: Settings;
  subtitlePreferences: SubtitlePreferences;
  updateJob: (id: string, updates: Partial<DownloadJob>) => void;
  addLog: (entry: {
    level: "info" | "warn" | "error" | "debug" | "command";
    message: string;
    jobId?: string;
    command?: string;
  }) => void;
}): Promise<InstagramDownloadResult> {
  const { job, preset, settings, subtitlePreferences, updateJob, addLog } =
    options;

  const unsupportedReason = getUnsupportedReason(
    job,
    preset,
    subtitlePreferences
  );
  if (unsupportedReason) {
    addLog({ level: "warn", message: unsupportedReason, jobId: job.id });
    return { code: 1, failDetail: unsupportedReason };
  }

  updateJob(job.id, {
    phase: "Resolving formats",
    statusDetail: "Resolving Instagram media",
    thumbnail: undefined,
    thumbnailStatus: "pending",
    thumbnailError: undefined,
    subtitleStatus: "unavailable",
    hasManualSubtitles: false,
    hasAutoSubtitles: false,
    availableSubtitleLanguages: [],
    resolvedSubtitleSource: "none",
  });

  let resolved: InstagramResolveResult;
  try {
    resolved = await resolveInstagramWithDownloadgram(job.url);
  } catch (error) {
    return {
      code: 1,
      failDetail: `Instagram resolution failed: ${String(error)}`,
    };
  }

  const title = buildInstagramTitle(job.url, resolved);
  const rootDir = await resolveRootDirectory(job, settings);
  const filenameTemplate = getFilenameTemplate(job, preset, settings);
  const postProcessPlan = buildPostProcessPlan(job, preset);
  const activePostProcessPlan =
    postProcessPlan.mode === "none" ? null : postProcessPlan;

  if (
    postProcessPlan.mode === "audio" &&
    !resolved.items.some((item) => item.type === "video")
  ) {
    return {
      code: 1,
      failDetail:
        "This Instagram URL does not contain any video items to extract audio from.",
    };
  }

  updateJob(job.id, {
    title,
    ...(resolved.items[0]?.thumbnailUrl
      ? { thumbnail: resolved.items[0].thumbnailUrl }
      : {}),
    ...(resolved.items[0]?.thumbnailUrl
      ? { thumbnailStatus: "ready" as const }
      : {}),
  });

  addLog({
    level: "info",
    message: `Instagram resolver returned ${resolved.items.length} media item${resolved.items.length === 1 ? "" : "s"} via ${resolved.providerInstance}`,
    jobId: job.id,
  });

  const renderedBase = renderTemplateStem(filenameTemplate, {
    title,
    shortcode: resolved.shortcode,
    jobId: job.id,
  });

  let outputPath: string;
  if (resolved.kind === "carousel") {
    outputPath = await prepareCollectionDirectory(
      rootDir,
      renderedBase,
      settings.fileCollision
    );
  } else {
    const item = resolved.items[0];
    const ext = getPlannedOutputExtension(item, postProcessPlan);
    const singleName = renderSingleFilename(filenameTemplate, {
      title,
      shortcode: resolved.shortcode,
      jobId: job.id,
      ext,
    });
    const singlePath = await resolveFilePath(
      rootDir,
      singleName,
      settings.fileCollision
    );
    if (!singlePath) {
      outputPath = await join(
        rootDir,
        sanitizePathSegment(singleName) || `instagram.${ext}`
      );
    } else {
      outputPath = singlePath;
    }
  }

  if (resolved.kind === "carousel") {
    await mkdir(outputPath, { recursive: true });
  }

  let firstWrittenPath: string | null = null;
  const writtenPathByIndex = new Map<number, string>();
  let wroteAny = false;
  const plannedItems: PlannedInstagramItem[] = [];

  for (const item of resolved.items) {
    if (item.type === "image" && postProcessPlan.mode === "audio") {
      addLog({
        level: "info",
        message: `Skipping Instagram image ${item.index + 1}/${resolved.items.length} for audio extraction preset`,
        jobId: job.id,
      });
      continue;
    }

    const plannedExt = getPlannedOutputExtension(item, postProcessPlan);
    const existingDestination =
      resolved.kind === "carousel"
        ? await getCollectionItemPath(outputPath, item, plannedExt)
        : outputPath;
    const destination =
      resolved.kind === "carousel"
        ? await resolveCollectionItemPath(
            outputPath,
            item,
            settings.fileCollision,
            plannedExt
          )
        : outputPath;

    if (!destination) {
      writtenPathByIndex.set(item.index, existingDestination);
      addLog({
        level: "info",
        message: `Skipping existing Instagram item ${item.index + 1}/${resolved.items.length}`,
        jobId: job.id,
      });
      continue;
    }

    const sourceExt = inferItemExtension(item);
    const shouldPostProcess =
      item.type === "video" && activePostProcessPlan !== null;
    const downloadPath = shouldPostProcess
      ? `${destination}.source.${sourceExt}`
      : destination;

    plannedItems.push({
      item,
      destination,
      downloadPath,
      shouldPostProcess,
    });
  }

  const expectedOutputPaths = resolved.items
    .map(
      (item) =>
        writtenPathByIndex.get(item.index) ??
        plannedItems.find((candidate) => candidate.item.index === item.index)
          ?.destination
    )
    .filter((value): value is string => Boolean(value));

  if (plannedItems.length > 0) {
    const hasMultiplePlannedItems = plannedItems.length > 1;
    updateJob(job.id, {
      status: "Downloading",
      phase: "Downloading streams",
      statusDetail: getInstagramDownloadStartLabel(
        plannedItems.length,
        Math.min(plannedItems.length, INSTAGRAM_CAROUSEL_DOWNLOAD_CONCURRENCY)
      ),
      progress: 0,
      speed: undefined,
      eta: undefined,
      outputPaths: expectedOutputPaths,
      ...(resolved.kind === "carousel"
        ? { outputPath }
        : { outputPath: plannedItems[0]?.destination ?? outputPath }),
    });

    addLog({
      level: "info",
      message: hasMultiplePlannedItems
        ? `Instagram carousel download started with ${Math.min(plannedItems.length, INSTAGRAM_CAROUSEL_DOWNLOAD_CONCURRENCY)} parallel fetches for ${plannedItems.length} item(s)`
        : "Downloading Instagram media",
      jobId: job.id,
    });
  }

  let completedDownloads = 0;
  try {
    await runWithConcurrency(
      plannedItems,
      INSTAGRAM_CAROUSEL_DOWNLOAD_CONCURRENCY,
      async (planned) => {
        addLog({
          level: "info",
          message: `Downloading Instagram ${planned.item.type} ${planned.item.index + 1}/${resolved.items.length} → ${planned.destination}`,
          jobId: job.id,
        });

        await downloadUrlToFile(
          planned.item.downloadUrl,
          planned.downloadPath,
          job.url
        );
        wroteAny = true;
        firstWrittenPath ??= planned.destination;
        completedDownloads += 1;

        if (!planned.shouldPostProcess) {
          writtenPathByIndex.set(planned.item.index, planned.destination);
        }

        const hasPostProcessItems = plannedItems.some(
          (candidate) => candidate.shouldPostProcess
        );
        const downloadShare = hasPostProcessItems
          ? INSTAGRAM_STATUS_PROGRESS_SHARE.withPostProcess
          : INSTAGRAM_STATUS_PROGRESS_SHARE.downloadOnly;
        updateJob(job.id, {
          status: "Downloading",
          phase: "Downloading streams",
          statusDetail: getInstagramDownloadProgressLabel(
            completedDownloads,
            plannedItems.length,
            hasPostProcessItems
          ),
          progress: Math.max(
            1,
            Math.round(
              (completedDownloads / plannedItems.length) * downloadShare
            )
          ),
          outputPaths: expectedOutputPaths,
          ...(resolved.kind === "carousel"
            ? { outputPath }
            : { outputPath: planned.destination }),
        });
      }
    );
  } catch (error) {
    return {
      code: 1,
      failDetail: `Instagram download failed: ${String(error)}`,
    };
  }

  const postProcessItems = plannedItems.filter(
    (planned) => planned.shouldPostProcess
  );
  for (let index = 0; index < postProcessItems.length; index += 1) {
    const planned = postProcessItems[index];
    const converted = await runFfmpegPostProcess({
      job,
      item: planned.item,
      updateJob,
      addLog,
      inputPath: planned.downloadPath,
      outputPath: planned.destination,
      plan: activePostProcessPlan!,
    });
    if (!converted.ok) {
      return {
        code: 1,
        failDetail: converted.failDetail,
      };
    }
    await deleteFile(planned.downloadPath).catch(() => {
      void 0;
    });
    writtenPathByIndex.set(planned.item.index, planned.destination);
    updateJob(job.id, {
      status: "Post-processing",
      phase: "Converting with FFmpeg",
      progress: 70 + Math.round(((index + 1) / postProcessItems.length) * 25),
      outputPaths: expectedOutputPaths,
      ...(resolved.kind === "carousel"
        ? { outputPath }
        : { outputPath: planned.destination }),
    });
  }

  if (!wroteAny) {
    addLog({
      level: "info",
      message:
        "Instagram download skipped because the target files already exist",
      jobId: job.id,
    });
  }

  const writtenPaths = resolved.items
    .map((item) => writtenPathByIndex.get(item.index))
    .filter((value): value is string => Boolean(value));
  const lastKnownOutputPath =
    resolved.kind === "carousel"
      ? outputPath
      : (firstWrittenPath ?? outputPath);
  updateJob(job.id, {
    outputPath: lastKnownOutputPath,
    outputPaths: writtenPaths.length ? writtenPaths : [lastKnownOutputPath],
    title,
    progress: 100,
    phase: "Generating thumbnail",
    statusDetail: "Finalizing Instagram download",
  });

  return {
    code: 0,
    lastKnownOutputPath,
    outputPaths: writtenPaths.length ? writtenPaths : [lastKnownOutputPath],
    resolved,
  };
}

async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<void>
) {
  if (items.length === 0) return;

  const limit = Math.max(1, Math.min(concurrency, items.length));
  let cursor = 0;

  await Promise.all(
    Array.from({ length: limit }, async () => {
      while (cursor < items.length) {
        const currentIndex = cursor;
        cursor += 1;
        await worker(items[currentIndex], currentIndex);
      }
    })
  );
}

function getInstagramDownloadStartLabel(
  totalItems: number,
  parallelCount: number
) {
  if (totalItems <= 1) {
    return "Downloading Instagram media";
  }

  return `Downloading carousel (${parallelCount} at a time)`;
}

function getInstagramDownloadProgressLabel(
  completedDownloads: number,
  totalItems: number,
  hasPostProcessItems: boolean
) {
  if (completedDownloads >= totalItems) {
    return hasPostProcessItems
      ? "Downloads finished, preparing conversion"
      : "Finalizing Instagram download";
  }

  if (totalItems <= 1) {
    return "Downloading Instagram media";
  }

  return `Carousel downloaded ${completedDownloads}/${totalItems}`;
}

export async function fetchInstagramMediaInfo(url: string) {
  const resolved = await resolveInstagramWithDownloadgram(url);
  return {
    title: buildInstagramTitle(url, resolved),
    thumbnailUrl: resolved.items[0]?.thumbnailUrl ?? "",
    hasManualSubtitles: false,
    hasAutoSubtitles: false,
    availableSubtitleLanguages: [] as string[],
  };
}

export async function inspectInstagramMedia(
  url: string
): Promise<InstagramMediaSummary> {
  const resolved = await resolveInstagramWithDownloadgram(url);
  const hasImage = resolved.items.some((item) => item.type === "image");
  const hasVideo = resolved.items.some((item) => item.type === "video");

  return {
    kind: resolved.kind,
    itemCount: resolved.items.length,
    hasImage,
    hasVideo,
    isImageOnly: hasImage && !hasVideo,
    isVideoOnly: hasVideo && !hasImage,
    isMixedCarousel: resolved.kind === "carousel" && hasImage && hasVideo,
  };
}

function getUnsupportedReason(
  job: DownloadJob,
  preset: Preset,
  subtitlePreferences: SubtitlePreferences
): string | null {
  if (subtitlePreferences.mode !== "off") {
    return "Instagram DownloadGram path does not support subtitles yet.";
  }

  const overrideFormat = job.overrides?.format?.toLowerCase();
  if (overrideFormat === "avi") {
    return "Instagram DownloadGram path does not support AVI conversion.";
  }
  const args = buildEffectivePresetArgs(job, preset);
  const mergeIndex = args.indexOf("--merge-output-format");
  const mergeFormat =
    mergeIndex !== -1 ? args[mergeIndex + 1]?.toLowerCase() : "";
  if (mergeFormat === "avi") {
    return "Instagram DownloadGram path does not support AVI conversion.";
  }

  return null;
}

async function resolveRootDirectory(
  job: DownloadJob,
  settings: Settings
): Promise<string> {
  const configured = job.overrides?.downloadDir || settings.defaultDownloadDir;
  if (configured.trim()) return configured;
  return defaultDownloadDir();
}

function getFilenameTemplate(
  job: DownloadJob,
  preset: Preset,
  settings: Settings
): string {
  if (job.overrides?.filenameTemplate?.trim()) {
    return ensureFilenameTemplateExtension(job.overrides.filenameTemplate);
  }
  if (preset?.filenameTemplate?.trim()) {
    return ensureFilenameTemplateExtension(preset.filenameTemplate);
  }

  return settings.fileCollision === "rename"
    ? "%(title)s [%(id)s].%(ext)s"
    : "%(title)s.%(ext)s";
}

function buildInstagramTitle(
  url: string,
  resolved: InstagramResolveResult
): string {
  const shortcode = resolved.shortcode || extractInstagramShortcode(url);
  const resourceType = resolved.resourceType || getInstagramResourceType(url);
  switch (resourceType) {
    case "reel":
      return `Instagram reel ${shortcode}`;
    case "tv":
      return `Instagram IGTV ${shortcode}`;
    case "post":
      return resolved.kind === "carousel"
        ? `Instagram carousel ${shortcode}`
        : `Instagram post ${shortcode}`;
    default:
      return `Instagram media ${shortcode}`;
  }
}

async function prepareCollectionDirectory(
  rootDir: string,
  baseName: string,
  collision: Settings["fileCollision"]
): Promise<string> {
  const safeBase = sanitizePathSegment(baseName || "instagram-carousel");
  let candidate = await join(rootDir, safeBase);

  if (collision !== "rename") {
    return candidate;
  }

  let counter = 2;
  while (await exists(candidate)) {
    candidate = await join(rootDir, `${safeBase} (${counter})`);
    counter += 1;
  }
  return candidate;
}

async function resolveCollectionItemPath(
  collectionDir: string,
  item: InstagramMediaItem,
  collision: Settings["fileCollision"],
  ext: string
): Promise<string | null> {
  return resolveFilePath(
    collectionDir,
    buildCollectionItemFilename(item, ext),
    collision
  );
}

async function getCollectionItemPath(
  collectionDir: string,
  item: InstagramMediaItem,
  ext: string
): Promise<string> {
  return join(collectionDir, buildCollectionItemFilename(item, ext));
}

async function resolveFilePath(
  dir: string,
  filename: string,
  collision: Settings["fileCollision"]
): Promise<string | null> {
  const safeName = sanitizePathSegment(filename) || "instagram-file";
  let candidate = await join(dir, safeName);

  if (collision === "overwrite") {
    return candidate;
  }

  if (collision === "skip") {
    return (await exists(candidate)) ? null : candidate;
  }

  const { stem, ext } = splitExtension(safeName);
  let counter = 2;
  while (await exists(candidate)) {
    candidate = await join(dir, `${stem} (${counter})${ext}`);
    counter += 1;
  }
  return candidate;
}

function buildCollectionItemFilename(item: InstagramMediaItem, ext: string) {
  const base = `${String(item.index + 1).padStart(2, "0")}`;
  return `${base}.${ext}`;
}

function renderTemplateStem(
  template: string,
  values: { title: string; shortcode: string; jobId: string }
): string {
  const withoutExtToken = template.replace(/\.?%\((?:ext)\)s/gi, "");
  const rendered = withoutExtToken
    .replace(/%\((title)\)s/gi, values.title)
    .replace(/%\((id)\)s/gi, values.shortcode || values.jobId)
    .replace(/%\((display_id)\)s/gi, values.shortcode || values.jobId)
    .replace(/%\((webpage_url_basename)\)s/gi, values.shortcode || values.jobId)
    .replace(/%\(([^)]+)\)s/gi, "");

  return (
    sanitizePathSegment(rendered.trim()) ||
    sanitizePathSegment(values.title) ||
    "instagram"
  );
}

function renderSingleFilename(
  template: string,
  values: { title: string; shortcode: string; jobId: string; ext: string }
): string {
  const rendered = template
    .replace(/%\((title)\)s/gi, values.title)
    .replace(/%\((id)\)s/gi, values.shortcode || values.jobId)
    .replace(/%\((display_id)\)s/gi, values.shortcode || values.jobId)
    .replace(/%\((webpage_url_basename)\)s/gi, values.shortcode || values.jobId)
    .replace(/%\((ext)\)s/gi, values.ext)
    .replace(/%\(([^)]+)\)s/gi, "");

  const withExt = rendered.includes(`.${values.ext}`)
    ? rendered
    : `${rendered}.${values.ext}`;
  return sanitizePathSegment(withExt.trim()) || `instagram.${values.ext}`;
}

function sanitizePathSegment(input: string): string {
  let sanitized = "";

  for (const char of input) {
    const code = char.charCodeAt(0);
    const isControl = code >= 0 && code <= 31;
    const isReserved = '<>:"/\\|?*'.includes(char);
    sanitized += isControl || isReserved ? "-" : char;
  }

  return sanitized.replace(/\s+/g, " ").replace(/\.+$/g, "").trim();
}

function inferItemExtension(item: InstagramMediaItem): string {
  const filename = (item.suggestedFilename || "").toLowerCase();
  const source = (item.sourceUrl || "").toLowerCase();
  const match = `${filename} ${source}`.match(
    /\.(jpg|jpeg|png|webp|gif|mp4|mov|webm)(\b|$)/
  );
  if (match?.[1]) {
    return match[1] === "jpeg" ? "jpg" : match[1];
  }
  return item.type === "video" ? "mp4" : "jpg";
}

function splitExtension(filename: string): { stem: string; ext: string } {
  const match = filename.match(/^(.*?)(\.[^.]+)?$/);
  const stem = match?.[1] || filename;
  const ext = match?.[2] || "";
  return { stem, ext };
}

function getPlannedOutputExtension(
  item: InstagramMediaItem,
  plan: PostProcessPlan
): string {
  if (item.type !== "video" || plan.mode === "none") {
    return inferItemExtension(item);
  }
  return plan.outputExt;
}

function buildEffectivePresetArgs(job: DownloadJob, preset: Preset): string[] {
  const args = [...preset.args];
  const overrideFormat = job.overrides?.format;
  if (!overrideFormat) {
    return args;
  }

  const removeFlagWithValue = (flag: string) => {
    const idx = args.indexOf(flag);
    if (idx !== -1) args.splice(idx, 2);
  };
  const removeFlag = (flag: string) => {
    const idx = args.indexOf(flag);
    if (idx !== -1) args.splice(idx, 1);
  };

  const formatIndex = args.indexOf("-f");
  if (formatIndex !== -1) {
    args.splice(formatIndex, 2);
  }

  switch (overrideFormat) {
    case "best":
      args.push("-f", "bestvideo+bestaudio/best");
      break;
    case "mp4":
      args.push(
        "-f",
        "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best"
      );
      break;
    case "webm":
      args.push(
        "-f",
        "bestvideo[ext=webm]+bestaudio[ext=webm]/best[ext=webm]/best"
      );
      break;
    case "mp3":
      removeFlag("-x");
      removeFlagWithValue("--audio-format");
      removeFlagWithValue("--audio-quality");
      args.push(
        "-f",
        "bestaudio",
        "-x",
        "--audio-format",
        "mp3",
        "--audio-quality",
        "0"
      );
      break;
    case "m4a":
      removeFlag("-x");
      removeFlagWithValue("--audio-format");
      removeFlagWithValue("--audio-quality");
      args.push("-f", "bestaudio", "-x", "--audio-format", "m4a");
      break;
    case "flac":
      removeFlag("-x");
      removeFlagWithValue("--audio-format");
      removeFlagWithValue("--audio-quality");
      args.push("-f", "bestaudio", "-x", "--audio-format", "flac");
      break;
    case "wav":
      removeFlag("-x");
      removeFlagWithValue("--audio-format");
      removeFlagWithValue("--audio-quality");
      args.push("-f", "bestaudio", "-x", "--audio-format", "wav");
      break;
    case "alac":
      removeFlag("-x");
      removeFlagWithValue("--audio-format");
      removeFlagWithValue("--audio-quality");
      args.push("-f", "bestaudio", "-x", "--audio-format", "alac");
      break;
    case "mkv":
      args.push("--merge-output-format", "mkv");
      break;
    default:
      args.push("-f", overrideFormat);
      break;
  }

  return args;
}

function buildPostProcessPlan(
  job: DownloadJob,
  preset: Preset
): PostProcessPlan {
  const args = buildEffectivePresetArgs(job, preset);
  const formatIndex = args.indexOf("-f");
  const formatValue = formatIndex !== -1 ? (args[formatIndex + 1] ?? "") : "";
  const audioFormatIndex = args.indexOf("--audio-format");
  const audioFormat =
    audioFormatIndex !== -1
      ? (args[audioFormatIndex + 1] ?? "").toLowerCase()
      : "";
  const mergeIndex = args.indexOf("--merge-output-format");
  const mergeFormat =
    mergeIndex !== -1 ? (args[mergeIndex + 1] ?? "").toLowerCase() : "";
  const recodeIndex = args.indexOf("--recode-video");
  const recodeFormat =
    recodeIndex !== -1 ? (args[recodeIndex + 1] ?? "").toLowerCase() : "";
  const ppIndex = args.indexOf("--postprocessor-args");
  const postprocessorArgs = ppIndex !== -1 ? (args[ppIndex + 1] ?? "") : "";

  const audioOnly =
    args.includes("-x") ||
    args.includes("--audio-format") ||
    (formatValue.startsWith("bestaudio") && !formatValue.includes("+"));

  if (audioOnly) {
    switch (audioFormat || "m4a") {
      case "mp3":
        return {
          mode: "audio",
          outputExt: "mp3",
          ffmpegArgs: ["-vn", "-c:a", "libmp3lame", "-q:a", "0"],
          label: "Extracting MP3 audio",
        };
      case "flac":
        return {
          mode: "audio",
          outputExt: "flac",
          ffmpegArgs: ["-vn", "-c:a", "flac"],
          label: "Extracting FLAC audio",
        };
      case "wav":
        return {
          mode: "audio",
          outputExt: "wav",
          ffmpegArgs: ["-vn", "-c:a", "pcm_s16le"],
          label: "Extracting WAV audio",
        };
      case "alac":
        return {
          mode: "audio",
          outputExt: "m4a",
          ffmpegArgs: ["-vn", "-c:a", "alac"],
          label: "Extracting ALAC audio",
        };
      case "m4a":
      default:
        return {
          mode: "audio",
          outputExt: "m4a",
          ffmpegArgs: ["-vn", "-c:a", "aac", "-b:a", "192k"],
          label: "Extracting M4A audio",
        };
    }
  }

  if (postprocessorArgs.includes("VideoConvertor:")) {
    const ffmpegArgs = postprocessorArgs
      .replace("VideoConvertor:", "")
      .split(/\s+/)
      .filter(Boolean);
    return {
      mode: "video",
      outputExt: recodeFormat || mergeFormat || "mp4",
      ffmpegArgs,
      label: "Converting video with FFmpeg",
    };
  }

  if (recodeFormat) {
    return {
      mode: "video",
      outputExt: recodeFormat,
      ffmpegArgs: ["-c:v", "copy", "-c:a", "copy"],
      label: `Rewrapping video as ${recodeFormat.toUpperCase()}`,
    };
  }

  if (mergeFormat === "mkv") {
    return {
      mode: "video",
      outputExt: "mkv",
      ffmpegArgs: ["-c:v", "copy", "-c:a", "copy"],
      label: "Rewrapping video as MKV",
    };
  }

  if (
    mergeFormat === "mp4" ||
    /\[ext=mp4\]/i.test(formatValue) ||
    /\[vcodec\^=avc1\]/i.test(formatValue)
  ) {
    return {
      mode: "video",
      outputExt: "mp4",
      ffmpegArgs: [
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-movflags",
        "+faststart",
      ],
      label: "Converting video to MP4",
    };
  }

  if (mergeFormat === "webm" || /\[ext=webm\]/i.test(formatValue)) {
    return {
      mode: "video",
      outputExt: "webm",
      ffmpegArgs: [
        "-c:v",
        "libvpx-vp9",
        "-crf",
        "32",
        "-b:v",
        "0",
        "-c:a",
        "libopus",
        "-b:a",
        "128k",
      ],
      label: "Converting video to WebM",
    };
  }

  if (
    VIDEO_CONTAINER_OVERRIDES.has((job.overrides?.format || "").toLowerCase())
  ) {
    const format = (job.overrides?.format || "").toLowerCase();
    if (format === "mkv") {
      return {
        mode: "video",
        outputExt: "mkv",
        ffmpegArgs: ["-c:v", "copy", "-c:a", "copy"],
        label: "Rewrapping video as MKV",
      };
    }
    if (format === "webm") {
      return {
        mode: "video",
        outputExt: "webm",
        ffmpegArgs: [
          "-c:v",
          "libvpx-vp9",
          "-crf",
          "32",
          "-b:v",
          "0",
          "-c:a",
          "libopus",
          "-b:a",
          "128k",
        ],
        label: "Converting video to WebM",
      };
    }
    if (format === "mov") {
      return {
        mode: "video",
        outputExt: "mov",
        ffmpegArgs: ["-c:v", "copy", "-c:a", "copy"],
        label: "Rewrapping video as MOV",
      };
    }
  }

  return { mode: "none" };
}

async function runFfmpegPostProcess(options: {
  job: DownloadJob;
  item: InstagramMediaItem;
  updateJob: (id: string, updates: Partial<DownloadJob>) => void;
  addLog: (entry: {
    level: "info" | "warn" | "error" | "debug" | "command";
    message: string;
    jobId?: string;
    command?: string;
  }) => void;
  inputPath: string;
  outputPath: string;
  plan: Exclude<PostProcessPlan, { mode: "none" }>;
}): Promise<{ ok: true } | { ok: false; failDetail: string }> {
  const { job, item, updateJob, addLog, inputPath, outputPath, plan } = options;
  const ffmpeg = await resolveTool("ffmpeg");
  const ffmpegArgs = ["-y", "-i", inputPath, ...plan.ffmpegArgs, outputPath];
  const quoted = ffmpegArgs
    .map((arg) => (arg.includes(" ") ? `"${arg}"` : arg))
    .join(" ");

  updateJob(job.id, {
    status: "Post-processing",
    phase: "Converting with FFmpeg",
    statusDetail:
      plan.mode === "audio"
        ? `Extracting audio from Instagram video ${item.index + 1}`
        : `Converting Instagram video ${item.index + 1}`,
    ffmpegProgressKnown: false,
    speed: undefined,
    eta: undefined,
  });

  addLog({
    level: "info",
    message: `Running Instagram FFmpeg post-process (${plan.label}):\n${ffmpeg.path} ${quoted}`,
    jobId: job.id,
  });

  const cmd = Command.create(ffmpeg.command, ffmpegArgs);
  const result = await cmd.execute();
  if (result.stdout.trim()) {
    addLog({
      level: "info",
      message: `[ffmpeg] ${result.stdout.trim().slice(-400)}`,
      jobId: job.id,
    });
  }
  if (result.stderr.trim()) {
    addLog({
      level: result.code === 0 ? "info" : "error",
      message: `[ffmpeg] ${result.stderr.trim().slice(-800)}`,
      jobId: job.id,
    });
  }

  if (result.code !== 0) {
    return {
      ok: false,
      failDetail: `FFmpeg post-process failed for Instagram item ${item.index + 1}`,
    };
  }

  return { ok: true };
}
