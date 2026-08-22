import { isYouTubeUrl } from "./tool-env";

/** Prefer TV/Android players so the web client’s 429 / bot-check is not the only path. */
const YOUTUBE_EXTRACTOR_ARGS = "youtube:player_client=tv,android,web";

export function shouldSkipAria2ForUrl(url: string): boolean {
  return isYouTubeUrl(url);
}

/**
 * YouTube 429s are often IP/client fingerprints, not a cooldown.
 * Waiting days does nothing if every request still looks like a scraper.
 */
export function appendYoutubeReliabilityArgs(
  args: string[],
  url: string,
  options: { forDownload?: boolean } = {}
): void {
  if (!isYouTubeUrl(url)) return;

  if (!args.includes("--extractor-args")) {
    args.push("--extractor-args", YOUTUBE_EXTRACTOR_ARGS);
  }
  if (!args.includes("--force-ipv4")) {
    args.push("--force-ipv4");
  }
  if (!args.includes("--sleep-requests")) {
    args.push("--sleep-requests", "1");
  }

  if (!options.forDownload) return;

  if (!args.includes("--retries")) {
    args.push("--retries", "8");
  }
  if (!args.includes("--fragment-retries")) {
    args.push("--fragment-retries", "8");
  }
  if (!args.includes("--retry-sleep")) {
    args.push("--retry-sleep", "http:3");
  }
}
