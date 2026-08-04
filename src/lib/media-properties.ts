import { stat } from "@tauri-apps/plugin-fs";
import { resolveTool } from "@/lib/downloader/tool-env";
import { runResolvedTool } from "@/lib/process/app-bin";

export type MediaProbeInfo = {
  width?: number;
  height?: number;
  fps?: number;
  videoCodec?: string;
  audioCodec?: string;
  videoBitrate?: number;
  audioBitrate?: number;
  durationSeconds?: number;
  container?: string;
  sizeBytes?: number;
};

export type MediaStoredMeta = {
  title?: string;
  url?: string;
  outputPath?: string;
  fileSize?: number;
  mediaDurationSeconds?: number;
  format?: string;
  domain?: string;
  presetName?: string;
  downloadedAt?: number;
  createdAt?: number;
  failReason?: string;
};

export type MediaPropertyRow = { label: string; value: string };

type FfprobeStream = {
  codec_type?: string;
  codec_name?: string;
  width?: number;
  height?: number;
  avg_frame_rate?: string;
  r_frame_rate?: string;
  bit_rate?: string;
};

type FfprobeFormat = {
  format_name?: string;
  duration?: string;
  bit_rate?: string;
  size?: string;
};

type FfprobeJson = {
  streams?: FfprobeStream[];
  format?: FfprobeFormat;
};

const probeCache = new Map<string, MediaProbeInfo | null>();

function parseFrameRate(raw?: string): number | undefined {
  if (!raw || raw === "0/0") return undefined;
  if (raw.includes("/")) {
    const [n, d] = raw.split("/").map(Number);
    if (Number.isFinite(n) && Number.isFinite(d) && d !== 0) {
      const fps = n / d;
      return fps > 0 ? fps : undefined;
    }
    return undefined;
  }
  const fps = Number(raw);
  return Number.isFinite(fps) && fps > 0 ? fps : undefined;
}

function parsePositiveNumber(raw?: string | number): number | undefined {
  const n = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export function formatBytes(bytes?: number): string | undefined {
  if (!bytes || bytes <= 0) return undefined;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function formatDuration(seconds?: number): string | undefined {
  if (!seconds || !Number.isFinite(seconds) || seconds <= 0) return undefined;
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function formatBitrate(bps?: number): string | undefined {
  if (!bps || !Number.isFinite(bps) || bps <= 0) return undefined;
  if (bps >= 1_000_000) return `${(bps / 1_000_000).toFixed(2)} Mbps`;
  if (bps >= 1_000) return `${(bps / 1_000).toFixed(0)} kbps`;
  return `${Math.round(bps)} bps`;
}

export async function probeMediaFile(path: string): Promise<MediaProbeInfo | null> {
  if (probeCache.has(path)) {
    return probeCache.get(path) ?? null;
  }

  try {
    const ffprobe = await resolveTool("ffprobe");
    const result = await runResolvedTool(
      ffprobe,
      "ffprobe",
      [
        "-v",
        "quiet",
        "-print_format",
        "json",
        "-show_format",
        "-show_streams",
        path,
      ],
      { timeoutMs: 20000 }
    );
    if (result.code !== 0) {
      probeCache.set(path, null);
      return null;
    }

    const parsed = JSON.parse(result.stdout) as FfprobeJson;
    const streams = parsed.streams ?? [];
    const video = streams.find((s) => s.codec_type === "video");
    const audio = streams.find((s) => s.codec_type === "audio");
    const format = parsed.format;

    let sizeBytes = parsePositiveNumber(format?.size);
    try {
      const info = await stat(path);
      if (typeof info.size === "number" && info.size > 0) sizeBytes = info.size;
    } catch {
      void 0;
    }

    const info: MediaProbeInfo = {
      width: parsePositiveNumber(video?.width),
      height: parsePositiveNumber(video?.height),
      fps: parseFrameRate(video?.avg_frame_rate) ?? parseFrameRate(video?.r_frame_rate),
      videoCodec: video?.codec_name || undefined,
      audioCodec: audio?.codec_name || undefined,
      videoBitrate: parsePositiveNumber(video?.bit_rate),
      audioBitrate: parsePositiveNumber(audio?.bit_rate),
      durationSeconds: parsePositiveNumber(format?.duration),
      container: format?.format_name?.split(",")[0]?.trim() || undefined,
      sizeBytes,
    };

    const hasAny = Object.values(info).some((v) => v !== undefined);
    const value = hasAny ? info : null;
    probeCache.set(path, value);
    return value;
  } catch {
    probeCache.set(path, null);
    return null;
  }
}

export function buildMediaPropertyRows(
  stored: MediaStoredMeta,
  probe: MediaProbeInfo | null
): MediaPropertyRow[] {
  const rows: MediaPropertyRow[] = [];
  const push = (label: string, value?: string) => {
    if (value && value.trim()) rows.push({ label, value: value.trim() });
  };

  const width = probe?.width;
  const height = probe?.height;
  const resolution =
    width && height ? `${width}×${height}` : height ? `${height}p` : undefined;

  push("Title", stored.title);
  push("URL", stored.url);
  push("Resolution", resolution);
  push(
    "Frame rate",
    probe?.fps ? `${Number.isInteger(probe.fps) ? probe.fps : probe.fps.toFixed(2)} fps` : undefined
  );
  push("Video codec", probe?.videoCodec);
  push("Audio codec", probe?.audioCodec);
  push("Video bitrate", formatBitrate(probe?.videoBitrate));
  push("Audio bitrate", formatBitrate(probe?.audioBitrate));
  push(
    "Duration",
    formatDuration(probe?.durationSeconds ?? stored.mediaDurationSeconds)
  );
  push("Container", probe?.container || stored.format);
  push("File size", formatBytes(probe?.sizeBytes ?? stored.fileSize));
  push("Path", stored.outputPath);
  push("Domain", stored.domain);
  push("Preset", stored.presetName);
  const when = stored.downloadedAt ?? stored.createdAt;
  if (when) push("Date", new Date(when).toLocaleString());

  return rows;
}
