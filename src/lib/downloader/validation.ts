import { Command } from "@tauri-apps/plugin-shell";
import { isInstagramUrl, resolveInstagramWithDownloadgram } from "@/lib/media-engine";
import { resolveTool, ytDlpEnv } from "./tool-env";

export type UrlProbeResult = "supported" | "unsupported" | "unknown";

const FAST_SUPPORTED_HOSTS = [
  "youtube.com",
  "youtu.be",
  "tiktok.com",
  "instagram.com",
  "facebook.com",
  "fb.watch",
  "x.com",
  "twitter.com",
  "twitch.tv",
  "vimeo.com",
  "soundcloud.com",
];

export function pickSupportedUrlFromText(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const match = trimmed.match(/https?:\/\/\S+/i);
  const candidate = (match ? match[0] : trimmed).replace(/[)\].,;]+$/, "");
  const parsed = parseProbeUrl(candidate);
  if (!parsed) return null;

  const host = parsed.hostname.toLowerCase();
  const supported = FAST_SUPPORTED_HOSTS.some(
    (candidateHost) => host === candidateHost || host.endsWith(`.${candidateHost}`)
  );

  return supported ? parsed.toString() : null;
}

function parseProbeUrl(url: string): URL | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function getProbeHostLabel(url: string): string | null {
  const parsed = parseProbeUrl(url);
  if (!parsed) return null;
  return parsed.hostname.replace(/^www\./i, "").toLowerCase();
}

export function quickProbeMediaUrl(url: string): UrlProbeResult {
  const parsed = parseProbeUrl(url);
  if (!parsed) {
    return "unsupported";
  }

  const host = parsed.hostname.toLowerCase();
  const isKnownHost = FAST_SUPPORTED_HOSTS.some(
    (candidate) => host === candidate || host.endsWith(`.${candidate}`)
  );

  return isKnownHost ? "supported" : "unknown";
}

export async function probeMediaUrl(url: string): Promise<UrlProbeResult> {
  const quickResult = quickProbeMediaUrl(url);
  if (quickResult === "unsupported") {
    return "unsupported";
  }

  if (isInstagramUrl(url)) {
    try {
      const resolved = await resolveInstagramWithDownloadgram(url);
      return resolved.items.length > 0 ? "supported" : "unknown";
    } catch {
      return "unknown";
    }
  }

  try {
    const ytDlp = await resolveTool("yt-dlp");
    const cmd = Command.create(
      ytDlp.command,
      [
        "--skip-download",
        "--no-playlist",
        "--flat-playlist",
        "--print",
        "%(id)s",
        url,
      ],
      { env: ytDlpEnv() }
    );

    const output = await cmd.execute();
    if (output.code === 0 && output.stdout.trim()) {
      return "supported";
    }

    const stderr = output.stderr.toLowerCase();
    if (
      stderr.includes("unsupported url") ||
      stderr.includes("no suitable extractor") ||
      stderr.includes("unable to extract")
    ) {
      return "unsupported";
    }

    return "unknown";
  } catch {
    return "unknown";
  }
}
