import { Command } from "@tauri-apps/plugin-shell";
import { resolveTool, ytDlpEnv } from "./tool-env";

export type UrlProbeResult = "supported" | "unsupported" | "unknown";

export async function probeMediaUrl(url: string): Promise<UrlProbeResult> {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return "unsupported";
    }
  } catch {
    return "unsupported";
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
