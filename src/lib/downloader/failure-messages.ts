import type { LogEntry } from "@/store/logs";

/**
 * Map raw yt-dlp / network stderr text to a short, user-facing failure reason.
 * Returns null when nothing matches so callers can keep a generic fallback.
 */
export function classifyYtDlpFailure(text: string): string | null {
  const raw = text.trim();
  if (!raw) return null;
  const s = raw.toLowerCase();

  if (
    /sign in to confirm|confirm you.?re not a bot|login required|members-only|join this channel|private video|this video is private|video unavailable|not available on this app/i.test(
      raw
    ) ||
    /http error 401|http error 403|status code 403|status code 401/.test(s)
  ) {
    return "This video needs login. Import a cookies.txt file in Settings → Download Engine (Chrome auto-read no longer works).";
  }

  if (/age.?restrict|confirm your age|age-gated/i.test(raw)) {
    return "Age-restricted video. Sign in via cookies.txt (export from a browser where you can watch it), then retry.";
  }

  if (
    /geo.?restrict|not available in your country|blocked in your country|copyright.*your country/i.test(
      raw
    )
  ) {
    return "This media is blocked in your region (geo-restricted).";
  }

  if (/http error 429|too many requests|rate.?limit/i.test(s)) {
    return "The site rate-limited you. Wait a bit, then retry (or lower max concurrent downloads).";
  }

  if (
    /unable to download webpage|urlopen error|name or service not known|temporary failure in name resolution|network is unreachable|connection reset|connection timed out|timed out|ssl:|certificate verify failed/i.test(
      s
    )
  ) {
    return "Network error while contacting the site. Check your connection and retry.";
  }

  if (/ffmpeg.*(not found|is not installed)|ffprobe.*(not found)|is not a valid executable/i.test(s)) {
    return "FFmpeg is missing or broken. Open Tools and install or repair FFmpeg.";
  }

  if (/aria2c.*(not found|failed)|unable to run.*aria2/i.test(s)) {
    return "aria2 failed. Retry, or turn off aria2 in Settings / Tools if downloads keep failing.";
  }

  if (/requested format is not available|format is not available|no video formats|no formats found/i.test(s)) {
    return "No compatible format for this preset. Try another preset (e.g. Best) or check Tools for a current yt-dlp.";
  }

  if (/unsupported url|no suitable extractor|unable to extract/i.test(s)) {
    return "This URL is not supported (or the site layout changed). Update yt-dlp from Tools and try again.";
  }

  if (/is not a valid url|invalid url|empty hostname/i.test(s)) {
    return "The URL looks invalid. Paste a full http(s) link and try again.";
  }

  if (/file name too long|no space left|disk quota exceeded|permission denied|access is denied/i.test(s)) {
    return "Could not write the file (disk full, path too long, or permissions). Check the download folder and free space.";
  }

  if (/download archive.*(already|skip)|has already been recorded in the archive/i.test(s)) {
    return "Skipped because this URL is already in the download archive.";
  }

  // Prefer last ERROR:/ERROR - style line as a cleaned snippet when nothing else matches.
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.replace(/^STDERR:\s*/i, "").trim())
    .filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const line = lines[i];
    if (/^warning:/i.test(line) || /\bwarning\b/i.test(line)) continue;
    if (/^error:/i.test(line) || /\[download\]\s*error/i.test(line) || /error/i.test(line)) {
      const cleaned = line
        .replace(/^error:\s*/i, "")
        .replace(/^\[download\]\s*/i, "")
        .trim();
      if (cleaned.length >= 12 && cleaned.length <= 220) {
        return cleaned;
      }
    }
  }

  return null;
}

export function collectJobLogHints(
  logs: LogEntry[],
  jobId: string,
  maxLines = 10
): string[] {
  return logs
    .filter(
      (entry) =>
        entry.jobId === jobId && (entry.level === "error" || entry.level === "warn")
    )
    .slice(-maxLines)
    .map((entry) => entry.message.replace(/^STDERR:\s*/i, "").trim())
    .filter(Boolean);
}
