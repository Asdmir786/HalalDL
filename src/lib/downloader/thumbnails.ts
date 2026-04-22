import { Command } from "@tauri-apps/plugin-shell";
import { useDownloadsStore } from "@/store/downloads";
import { useLogsStore } from "@/store/logs";
import { exists, mkdir } from "@tauri-apps/plugin-fs";
import { convertFileSrc } from "@tauri-apps/api/core";
import { deleteFile } from "@/lib/commands";
import { resolveTool } from "./tool-env";
import { useSettingsStore } from "@/store/settings";
import { getAppPaths } from "@/lib/app-paths";

export async function ensureThumbnailDir(): Promise<string> {
  const { thumbnailsDir } = await getAppPaths();
  if (!(await exists(thumbnailsDir))) {
    await mkdir(thumbnailsDir, { recursive: true });
  }
  return thumbnailsDir;
}

export function thumbnailRelativePathForJob(jobId: string): string {
  return `thumbnails/${jobId}.jpg`;
}

export async function thumbnailAssetUrl(relPath: string): Promise<string> {
  const { dataDir } = await getAppPaths();
  const separator = dataDir.includes("\\") ? "\\" : "/";
  const absPath = `${dataDir}${separator}${relPath.replace(/\//g, separator)}`;
  return convertFileSrc(absPath);
}

export async function generateThumbnailFromMediaUrl(jobId: string, mediaUrl: string) {
  const { updateJob } = useDownloadsStore.getState();
  const { addLog } = useLogsStore.getState();
  const shouldGenerateContactSheet = useSettingsStore.getState().settings.generateThumbnailContactSheets;

  try {
    updateJob(jobId, {
      phase: "Generating thumbnail",
      statusDetail: "",
      thumbnailStatus: "generating",
      thumbnailError: undefined,
    });
    const ffmpeg = await resolveTool("ffmpeg");
    const thumbsDir = await ensureThumbnailDir();
    const separator = thumbsDir.includes("\\") ? "\\" : "/";
    const outputPath = `${thumbsDir}${separator}${jobId}.jpg`;
    const outputRelativePath = thumbnailRelativePathForJob(jobId);
    const filter = "blackframe=amount=98:threshold=32,select='lt(lavfi.blackframe.pblack,98)',scale=320:-1";

    addLog({ level: "info", message: `[thumb] ffmpeg primary: extracting frame from ${mediaUrl.substring(0, 150)}...`, jobId });
    addLog({ level: "info", message: `[thumb] ffmpeg output path: ${outputPath}`, jobId });

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
    addLog({ level: "info", message: `[thumb] ffmpeg primary exit code: ${primaryOutput.code}`, jobId });
    if (primaryOutput.stderr.trim()) {
      const stderrTail = primaryOutput.stderr.trim().slice(-300);
      addLog({ level: "info", message: `[thumb] ffmpeg primary stderr (tail): ${stderrTail}`, jobId });
    }

    if (primaryOutput.code === 0 && (await exists(outputPath))) {
      addLog({ level: "info", message: `[thumb] Primary extraction succeeded`, jobId });
      const assetUrl = await thumbnailAssetUrl(outputRelativePath);
      updateJob(jobId, { thumbnail: assetUrl, thumbnailStatus: "ready" });
      if (shouldGenerateContactSheet) {
        await generateThumbnailContactSheet(jobId, mediaUrl);
      }
      return;
    }

    addLog({ level: "warn", message: `[thumb] Primary extraction failed, trying simple fallback`, jobId });

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
    addLog({ level: "info", message: `[thumb] ffmpeg fallback exit code: ${fallbackOutput.code}`, jobId });
    if (fallbackOutput.stderr.trim()) {
      const stderrTail = fallbackOutput.stderr.trim().slice(-300);
      addLog({ level: "info", message: `[thumb] ffmpeg fallback stderr (tail): ${stderrTail}`, jobId });
    }

    if (fallbackOutput.code === 0 && (await exists(outputPath))) {
      addLog({ level: "info", message: `[thumb] Fallback extraction succeeded`, jobId });
      const assetUrl = await thumbnailAssetUrl(outputRelativePath);
      updateJob(jobId, { thumbnail: assetUrl, thumbnailStatus: "ready" });
      if (shouldGenerateContactSheet) {
        await generateThumbnailContactSheet(jobId, mediaUrl);
      }
      return;
    }

    addLog({ level: "warn", message: `[thumb] Both ffmpeg extraction attempts failed`, jobId });
    updateJob(jobId, {
      thumbnailStatus: "failed",
      thumbnailError: "Could not generate thumbnail",
    });
  } catch (e) {
    addLog({ level: "warn", message: `[thumb] Exception: ${String(e)}`, jobId });
    updateJob(jobId, {
      thumbnailStatus: "failed",
      thumbnailError: String(e),
    });
  }
}

export async function generateThumbnailContactSheet(jobId: string, mediaUrl: string) {
  const { updateJob } = useDownloadsStore.getState();
  const { addLog } = useLogsStore.getState();

  try {
    const ffmpeg = await resolveTool("ffmpeg");
    const thumbsDir = await ensureThumbnailDir();
    const separator = thumbsDir.includes("\\") ? "\\" : "/";
    const outputPath = `${thumbsDir}${separator}${jobId}-sheet.jpg`;
    const outputRelativePath = `thumbnails/${jobId}-sheet.jpg`;
    const filter = "fps=1/10,scale=180:-1:force_original_aspect_ratio=decrease,tile=3x3:padding=6:margin=6";

    addLog({ level: "info", message: `[thumb] ffmpeg contact sheet: ${outputPath}`, jobId });

    const command = Command.create(ffmpeg.command, [
      "-y",
      "-i",
      mediaUrl,
      "-frames:v",
      "1",
      "-vf",
      filter,
      outputPath,
    ]);

    const result = await command.execute();
    addLog({ level: "info", message: `[thumb] ffmpeg contact sheet exit code: ${result.code}`, jobId });
    if (result.stderr.trim()) {
      addLog({ level: "info", message: `[thumb] contact sheet stderr (tail): ${result.stderr.trim().slice(-300)}`, jobId });
    }

    if (result.code === 0 && (await exists(outputPath))) {
      const assetUrl = await thumbnailAssetUrl(outputRelativePath);
      updateJob(jobId, { thumbnailSheet: assetUrl });
      addLog({ level: "info", message: "[thumb] Contact sheet ready", jobId });
      return;
    }

    addLog({ level: "warn", message: "[thumb] Contact sheet generation failed", jobId });
  } catch (e) {
    addLog({ level: "warn", message: `[thumb] Contact sheet exception: ${String(e)}`, jobId });
  }
}

export async function cleanupThumbnailByJobId(jobId: string) {
  const { addLog } = useLogsStore.getState();
  try {
    const { thumbnailsDir } = await getAppPaths();
    for (const ext of ["jpg", "webp", "png", "jpeg"]) {
      const absPath = `${thumbnailsDir}${thumbnailsDir.includes("\\") ? "\\" : "/"}${jobId}.${ext}`;
      if (await exists(absPath)) {
        await deleteFile(absPath);
      }
    }
    const sheetAbsPath = `${thumbnailsDir}${thumbnailsDir.includes("\\") ? "\\" : "/"}${jobId}-sheet.jpg`;
    if (await exists(sheetAbsPath)) {
      const absPath = sheetAbsPath;
      await deleteFile(absPath);
    }
  } catch (e) {
    addLog({ level: "warn", message: `Thumbnail cleanup failed: ${String(e)}`, jobId });
  }
}
