import { createId } from "@/lib/id";
import { runResolvedTool } from "@/lib/process/app-bin";
import { resolveTool } from "@/lib/downloader/tool-env";
import { extractDomain, useHistoryStore, type HistoryEntry } from "@/store/history";
import type { MediaChapter } from "@/lib/chapters";

function formatFfmpegTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  return [hours, minutes, remainingSeconds]
    .map((part) => String(Math.floor(part)).padStart(2, "0"))
    .join(":");
}

function sanitizeStem(value: string): string {
  const cleaned = value
    .split("")
    .filter((character) => character >= " ")
    .join("")
    .replace(/[<>:"/\\|?*]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/g, "");
  return (cleaned || "HalalDL clip").slice(0, 120);
}

function outputPathFor(inputPath: string, name: string, audioOnly: boolean): string {
  const separator = inputPath.includes("\\") ? "\\" : "/";
  const directoryIndex = Math.max(inputPath.lastIndexOf("\\"), inputPath.lastIndexOf("/"));
  const directory = directoryIndex >= 0 ? inputPath.slice(0, directoryIndex + 1) : "";
  const extension = audioOnly ? "m4a" : "mp4";
  return `${directory}${sanitizeStem(name)}.${extension}`.replace(/\//g, separator);
}

export async function exportLocalClip(input: {
  entry: HistoryEntry;
  inputPath: string;
  startSeconds: number;
  endSeconds: number;
  name: string;
  audioOnly: boolean;
}): Promise<HistoryEntry> {
  const duration = input.endSeconds - input.startSeconds;
  if (!Number.isFinite(duration) || duration <= 0) throw new Error("Choose an end time after the start time.");

  const outputPath = outputPathFor(input.inputPath, input.name, input.audioOnly);
  const ffmpeg = await resolveTool("ffmpeg");
  const args = [
    "-hide_banner",
    "-nostdin",
    "-ss",
    formatFfmpegTime(input.startSeconds),
    "-i",
    input.inputPath,
    "-t",
    formatFfmpegTime(duration),
    ...(input.audioOnly
      ? ["-map", "0:a:0?", "-vn", "-c:a", "aac", "-b:a", "192k"]
      : ["-map", "0:v:0?", "-map", "0:a?", "-c:v", "libx264", "-crf", "20", "-preset", "medium", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart"]),
    "-n",
    outputPath,
  ];
  const result = await runResolvedTool(ffmpeg, "ffmpeg", args, { timeoutMs: 30 * 60 * 1000 });
  if (result.code !== 0) {
    const detail = (result.stderr || result.stdout).replace(/\s+/g, " ").trim().slice(-500);
    throw new Error(detail || "FFmpeg could not create the clip.");
  }

  const clipEntry: HistoryEntry = {
    id: createId(),
    url: input.entry.url,
    title: sanitizeStem(input.name),
    outputPath,
    outputPaths: [outputPath],
    mediaDurationSeconds: duration,
    presetId: "local-clip",
    presetName: input.audioOnly ? "Audio clip" : "Video clip",
    downloadedAt: Date.now(),
    duration: duration * 1000,
    domain: extractDomain(input.entry.url),
    status: "completed",
    tags: ["clip"],
    sourceRef: input.entry.sourceRef,
    collectionId: input.entry.collectionId,
  };
  useHistoryStore.getState().addEntry(clipEntry);
  return clipEntry;
}

export function getStoredChapters(entry: HistoryEntry): MediaChapter[] {
  return (entry.chapters ?? []).filter(
    (chapter) =>
      Number.isFinite(chapter.startTime) &&
      chapter.startTime >= 0 &&
      (chapter.endTime === undefined || chapter.endTime > chapter.startTime)
  );
}
