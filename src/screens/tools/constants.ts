import { NIGHTLY_CAPABLE_TOOLS, type ToolChannel } from "@/store/tools";

export const TOOL_URLS: Record<string, string> = {
  "yt-dlp": "https://github.com/yt-dlp/yt-dlp",
  ffmpeg: "https://ffmpeg.org/",
  aria2: "https://aria2.github.io/",
  deno: "https://deno.land/",
};

export const TOOL_DESCRIPTIONS: Record<string, string> = {
  "yt-dlp": "Core media downloader engine",
  ffmpeg: "Audio & video processing",
  aria2: "Multi-connection downloads",
  deno: "JavaScript runtime for challenges",
};

export function getLatestTrackForTool(toolId: string, channel: ToolChannel): ToolChannel | "stable" {
  return (NIGHTLY_CAPABLE_TOOLS as readonly string[]).includes(toolId)
    ? channel
    : "stable";
}

export function getLatestSourceForTool(toolId: string, track: ToolChannel | "stable"): string {
  switch (toolId) {
    case "yt-dlp":
      return track === "nightly"
        ? "https://api.github.com/repos/yt-dlp/yt-dlp-nightly-builds/releases/latest"
        : "https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest";
    case "ffmpeg":
      return track === "nightly"
        ? "https://www.gyan.dev/ffmpeg/builds/git-version"
        : "https://www.gyan.dev/ffmpeg/builds/release-version";
    case "aria2":
      return "https://api.github.com/repos/aria2/aria2/releases/latest";
    case "deno":
      return "https://dl.deno.land/release-latest.txt";
    default:
      return "unknown source";
  }
}

export interface DownloadProgress {
  tool: string;
  percentage: number;
  status: string;
}
