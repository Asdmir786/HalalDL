import { Command } from "@tauri-apps/plugin-shell";
import { useDownloadsStore } from "@/store/downloads";
import { useLogsStore } from "@/store/logs";
import { appDataDir, join } from "@tauri-apps/api/path";
import { BaseDirectory, exists, mkdir } from "@tauri-apps/plugin-fs";
import { convertFileSrc } from "@tauri-apps/api/core";
import { deleteFile } from "@/lib/commands";
import { resolveTool } from "./tool-env";

export async function ensureThumbnailDir(): Promise<string> {
  if (!(await exists("thumbnails", { baseDir: BaseDirectory.AppData }))) {
    await mkdir("thumbnails", { baseDir: BaseDirectory.AppData, recursive: true });
  }
  const dataDir = await appDataDir();
  const thumbsDir = await join(dataDir, "thumbnails");
  return thumbsDir;
}

export function thumbnailRelativePathForJob(jobId: string): string {
  return `thumbnails/${jobId}.jpg`;
}

export async function thumbnailAssetUrl(relPath: string): Promise<string> {
  const dataDir = await appDataDir();
  const absPath = await join(dataDir, relPath);
  return convertFileSrc(absPath);
}

export async function generateThumbnailFromMediaUrl(jobId: string, mediaUrl: string) {
  const { updateJob } = useDownloadsStore.getState();
  const { addLog } = useLogsStore.getState();

  try {
    updateJob(jobId, {
      phase: "Generating thumbnail",
      statusDetail: "",
      thumbnailStatus: "generating",
      thumbnailError: undefined,
    });
    const ffmpeg = await resolveTool("ffmpeg");
    const thumbsDir = await ensureThumbnailDir();
    const outputPath = await join(thumbsDir, `${jobId}.jpg`);
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

    if (primaryOutput.code === 0 && (await exists(outputRelativePath, { baseDir: BaseDirectory.AppData }))) {
      addLog({ level: "info", message: `[thumb] Primary extraction succeeded`, jobId });
      const assetUrl = await thumbnailAssetUrl(outputRelativePath);
      updateJob(jobId, { thumbnail: assetUrl, thumbnailStatus: "ready" });
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

    if (fallbackOutput.code === 0 && (await exists(outputRelativePath, { baseDir: BaseDirectory.AppData }))) {
      addLog({ level: "info", message: `[thumb] Fallback extraction succeeded`, jobId });
      const assetUrl = await thumbnailAssetUrl(outputRelativePath);
      updateJob(jobId, { thumbnail: assetUrl, thumbnailStatus: "ready" });
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

export async function cleanupThumbnailByJobId(jobId: string) {
  const { addLog } = useLogsStore.getState();
  try {
    const dataDir = await appDataDir();
    for (const ext of ["jpg", "webp", "png", "jpeg"]) {
      const relPath = `thumbnails/${jobId}.${ext}`;
      if (await exists(relPath, { baseDir: BaseDirectory.AppData })) {
        const absPath = await join(dataDir, relPath);
        await deleteFile(absPath);
      }
    }
  } catch (e) {
    addLog({ level: "warn", message: `Thumbnail cleanup failed: ${String(e)}`, jobId });
  }
}
