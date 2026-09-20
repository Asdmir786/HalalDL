export const MAX_DEEP_LINK_LENGTH = 8_192;
export const MAX_DOWNLOAD_URL_LENGTH = 4_096;

export type DeepLinkScreen =
  | "downloads"
  | "presets"
  | "tools"
  | "logs"
  | "history"
  | "settings";

export type ParsedDeepLink =
  | { action: "open"; screen?: DeepLinkScreen }
  | { action: "attention"; searchParams: URLSearchParams }
  | {
      action: "download";
      targetUrl: string;
      preset?: string;
      advanced: boolean;
      startImmediately: boolean;
    };

const SCREENS = new Set<DeepLinkScreen>([
  "downloads",
  "presets",
  "tools",
  "logs",
  "history",
  "settings",
]);

function getAction(url: URL): string {
  return (url.hostname || url.pathname.replace(/^\/+/, "")).toLowerCase();
}

function parseDownloadTarget(value: string | null): string | null {
  if (!value || value.length > MAX_DOWNLOAD_URL_LENGTH) return null;

  try {
    const target = new URL(value);
    if (target.protocol !== "http:" && target.protocol !== "https:") return null;
    if (target.username || target.password) return null;
    return target.toString();
  } catch {
    return null;
  }
}

export function parseHalalDlDeepLink(rawUrl: string): ParsedDeepLink | null {
  if (!rawUrl || rawUrl.length > MAX_DEEP_LINK_LENGTH) return null;

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return null;
  }

  if (parsed.protocol !== "halaldl:" || parsed.username || parsed.password || parsed.port) {
    return null;
  }

  const action = getAction(parsed);

  if (action === "open") {
    const requestedScreen = parsed.searchParams.get("screen");
    return {
      action,
      screen:
        requestedScreen && SCREENS.has(requestedScreen as DeepLinkScreen)
          ? (requestedScreen as DeepLinkScreen)
          : undefined,
    };
  }

  if (action === "attention") {
    return { action, searchParams: parsed.searchParams };
  }

  if (action !== "download") return null;

  const targetUrl = parseDownloadTarget(parsed.searchParams.get("url"));
  if (!targetUrl) return null;

  const requestedPreset = parsed.searchParams.get("preset")?.trim();
  const preset = requestedPreset && requestedPreset.length <= 128 ? requestedPreset : undefined;
  const start = parsed.searchParams.get("start");

  return {
    action,
    targetUrl,
    preset,
    advanced: parsed.searchParams.get("advanced") === "1",
    // External links are safe-by-default. Starting requires an explicit flag.
    startImmediately: start === "1" || start === "start",
  };
}
