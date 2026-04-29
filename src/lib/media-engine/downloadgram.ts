import { postFormForText } from "@/lib/commands";

type MediaType = "image" | "video";
type ResolveKind = "single" | "carousel";

interface DownloadGramProvider {
  id: "downloadgram-app" | "downloadgram-website";
  endpoint: string;
  referer: string;
  origin: string;
  formFields?: Record<string, string>;
}

export interface InstagramMediaItem {
  id: string;
  index: number;
  type: MediaType;
  downloadUrl: string;
  thumbnailUrl: string | null;
  sourceUrl: string | null;
  suggestedFilename: string | null;
  provider: DownloadGramProvider["id"];
}

export interface InstagramResolveResult {
  provider: "downloadgram";
  providerInstance: DownloadGramProvider["id"];
  sourceUrl: string;
  shortcode: string;
  resourceType: "post" | "reel" | "tv" | "unknown";
  kind: ResolveKind;
  items: InstagramMediaItem[];
  resolvedAt: string;
}

const DOWNLOADGRAM_PROVIDERS: readonly DownloadGramProvider[] = [
  {
    id: "downloadgram-app",
    endpoint: "https://api.downloadgram.app/media",
    referer: "https://www.downloadgram.app/",
    origin: "https://www.downloadgram.app",
  },
  {
    id: "downloadgram-website",
    endpoint: "https://downloadgram.website/core/ajax.php",
    referer: "https://downloadgram.website/",
    origin: "https://downloadgram.website",
    formFields: {
      host: "instagram",
    },
  },
] as const;

const INNER_HTML_START = "['innerHTML']='";
const ALERT_START = "pushAlert(";
const INVALID_LINK_TARGETS = new Set(["", "#"]);

export function isInstagramUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === "instagram.com" || host.endsWith(".instagram.com");
  } catch {
    return false;
  }
}

export async function resolveInstagramWithDownloadgram(
  url: string
): Promise<InstagramResolveResult> {
  if (!isInstagramUrl(url)) {
    throw new Error("DownloadGram resolver only accepts Instagram URLs.");
  }

  let lastError: Error | null = null;

  for (const provider of DOWNLOADGRAM_PROVIDERS) {
    try {
      const body = new URLSearchParams({
        url,
        ...provider.formFields,
        lang: "en",
      }).toString();
      const responseText = await postFormForText(
        provider.endpoint,
        body,
        provider.referer,
        provider.origin
      );
      const html = extractHtmlFragment(responseText);
      const items = parseDownloadGramHtml(html, provider.id);

      if (items.length === 0) {
        throw new Error("DownloadGram returned no downloadable media items.");
      }

      return {
        provider: "downloadgram",
        providerInstance: provider.id,
        sourceUrl: url,
        shortcode: extractInstagramShortcode(url),
        resourceType: getInstagramResourceType(url),
        kind: items.length > 1 ? "carousel" : "single",
        items,
        resolvedAt: new Date().toISOString(),
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  throw lastError ?? new Error("DownloadGram resolution failed.");
}

function extractHtmlFragment(responseText: string): string {
  const trimmed = responseText.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      const parsed = JSON.parse(trimmed) as {
        error?: unknown;
        message?: unknown;
      };
      const detail =
        typeof parsed.message === "string"
          ? parsed.message
          : typeof parsed.error === "string"
            ? parsed.error
            : "";
      if (detail) {
        throw new Error(`DownloadGram API error: ${detail}`);
      }
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
    }
  }

  const alertIndex = responseText.indexOf(ALERT_START);
  if (alertIndex !== -1) {
    const startQuote = responseText.indexOf("'", alertIndex);
    const endQuote = responseText.indexOf("')", startQuote);
    if (startQuote !== -1 && endQuote !== -1 && endQuote > startQuote) {
      const alertText = decodeJsSingleQuotedString(
        responseText.slice(startQuote + 1, endQuote)
      ).trim();
      if (alertText) {
        throw new Error(alertText);
      }
    }
  }

  const start = responseText.indexOf(INNER_HTML_START);
  if (start === -1) {
    if (trimmed.startsWith("<")) {
      return trimmed;
    }
    throw new Error("Could not find DownloadGram HTML payload.");
  }

  const raw = readQuotedJsString(responseText, start + INNER_HTML_START.length);
  const html = decodeJsSingleQuotedString(raw).trim();
  if (!html) {
    throw new Error("DownloadGram returned an empty HTML payload.");
  }

  return html;
}

function readQuotedJsString(source: string, startIndex: number): string {
  let out = "";
  for (let i = startIndex; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === "'" && source[i - 1] !== "\\") {
      return out;
    }
    out += ch;
  }
  throw new Error("DownloadGram payload string was not terminated.");
}

function decodeJsSingleQuotedString(raw: string): string {
  let out = "";

  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i];
    if (ch !== "\\") {
      out += ch;
      continue;
    }

    const next = raw[i + 1];
    if (!next) {
      out += "\\";
      continue;
    }

    switch (next) {
      case "x": {
        const value = raw.slice(i + 2, i + 4);
        if (/^[0-9a-fA-F]{2}$/.test(value)) {
          out += String.fromCharCode(Number.parseInt(value, 16));
          i += 3;
          continue;
        }
        break;
      }
      case "u": {
        const value = raw.slice(i + 2, i + 6);
        if (/^[0-9a-fA-F]{4}$/.test(value)) {
          out += String.fromCharCode(Number.parseInt(value, 16));
          i += 5;
          continue;
        }
        break;
      }
      case "n":
        out += "\n";
        i += 1;
        continue;
      case "r":
        out += "\r";
        i += 1;
        continue;
      case "t":
        out += "\t";
        i += 1;
        continue;
      case "b":
        out += "\b";
        i += 1;
        continue;
      case "f":
        out += "\f";
        i += 1;
        continue;
      case "\\":
      case "'":
      case '"':
        out += next;
        i += 1;
        continue;
      default:
        break;
    }

    out += next;
    i += 1;
  }

  return out;
}

function parseDownloadGramHtml(
  html: string,
  provider: DownloadGramProvider["id"]
): InstagramMediaItem[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const blocks = Array.from(
    doc.querySelectorAll(
      provider === "downloadgram-website"
        ? ".story-container"
        : ".download-items"
    )
  );
  const providerBaseUrl = getProviderBaseUrl(provider);

  return blocks
    .map((block, index) => {
      const anchor = block.querySelector<HTMLAnchorElement>("a[href]");
      const normalizedDownloadUrl = normalizeDownloadGramUrl(
        anchor?.getAttribute("href"),
        providerBaseUrl
      );
      if (!normalizedDownloadUrl) return null;

      const image = block.querySelector<HTMLImageElement>("img[src]");
      const icon = block.querySelector<HTMLElement>(".format-icon i");
      const thumbnailUrl = normalizeDownloadGramUrl(
        image?.getAttribute("src"),
        providerBaseUrl
      );
      const resolvedDownload = resolveProviderDownloadUrl(
        normalizedDownloadUrl,
        provider
      );
      const type = inferMediaType(
        resolvedDownload.downloadUrl,
        icon?.className ?? ""
      );

      return {
        sourceUrl: resolvedDownload.sourceUrl,
        suggestedFilename: resolvedDownload.suggestedFilename,
        id: buildItemId(resolvedDownload.downloadUrl, index),
        index,
        type,
        downloadUrl: resolvedDownload.downloadUrl,
        thumbnailUrl,
        provider,
      } satisfies InstagramMediaItem;
    })
    .filter((item): item is InstagramMediaItem => item !== null);
}

function getProviderBaseUrl(provider: DownloadGramProvider["id"]): string {
  return (
    DOWNLOADGRAM_PROVIDERS.find((candidate) => candidate.id === provider)
      ?.origin ?? "https://www.downloadgram.app"
  );
}

function normalizeDownloadGramUrl(
  rawValue: string | null | undefined,
  baseUrl: string
): string | null {
  const trimmed = rawValue?.trim() ?? "";
  if (INVALID_LINK_TARGETS.has(trimmed) || /^javascript:/i.test(trimmed)) {
    return null;
  }

  try {
    const parsed = new URL(trimmed, baseUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    if (
      parsed.hostname === "tauri.localhost" ||
      parsed.hostname === "asset.localhost"
    ) {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

function inferMediaType(downloadUrl: string, iconClassName: string): MediaType {
  const lowerIcon = iconClassName.toLowerCase();
  if (lowerIcon.includes("video")) return "video";
  if (lowerIcon.includes("photo") || lowerIcon.includes("image"))
    return "image";

  const tokenPayload = decodeDownloadGramToken(downloadUrl);
  const fromPayload =
    `${tokenPayload?.filename ?? ""} ${tokenPayload?.url ?? ""}`.toLowerCase();
  if (/\.(mp4|mov|webm)(\b|$)/.test(fromPayload)) return "video";
  if (/\.(jpe?g|png|webp|gif)(\b|$)/.test(fromPayload)) return "image";

  return "image";
}

function resolveProviderDownloadUrl(
  downloadUrl: string,
  provider: DownloadGramProvider["id"]
): {
  downloadUrl: string;
  sourceUrl: string | null;
  suggestedFilename: string | null;
} {
  if (provider === "downloadgram-website") {
    const decodedUrl = decodeDownloadgramWebsiteUrl(downloadUrl);
    if (decodedUrl) {
      return {
        downloadUrl: decodedUrl,
        sourceUrl: decodedUrl,
        suggestedFilename: extractFilenameFromUrl(decodedUrl),
      };
    }
  }

  const tokenPayload = decodeDownloadGramToken(downloadUrl);
  return {
    downloadUrl,
    sourceUrl: tokenPayload?.url ?? null,
    suggestedFilename:
      tokenPayload?.filename ?? extractFilenameFromUrl(tokenPayload?.url),
  };
}

function buildItemId(downloadUrl: string, index: number): string {
  const tokenPayload = decodeDownloadGramToken(downloadUrl);
  const preferred =
    tokenPayload?.filename || tokenPayload?.url || `item-${index + 1}`;
  return (
    preferred
      .replace(/^https?:\/\//i, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || `item-${index + 1}`
  );
}

function decodeDownloadgramWebsiteUrl(downloadUrl: string): string | null {
  try {
    const parsed = new URL(downloadUrl);
    const token = parsed.searchParams.get("url");
    if (!token) return null;

    return atob(token);
  } catch {
    return null;
  }
}

export function extractInstagramShortcode(url: string): string {
  try {
    const parts = new URL(url).pathname.split("/").filter(Boolean);
    if (parts.length >= 2 && ["p", "reel", "tv"].includes(parts[0])) {
      return parts[1];
    }
  } catch {
    void 0;
  }
  return "instagram";
}

export function getInstagramResourceType(
  url: string
): "post" | "reel" | "tv" | "unknown" {
  try {
    const parts = new URL(url).pathname.split("/").filter(Boolean);
    const head = parts[0]?.toLowerCase();
    if (head === "p") return "post";
    if (head === "reel") return "reel";
    if (head === "tv") return "tv";
  } catch {
    void 0;
  }
  return "unknown";
}

function decodeDownloadGramToken(
  downloadUrl: string
): { filename?: string; url?: string } | null {
  try {
    const token = new URL(downloadUrl).searchParams.get("token");
    if (!token) return null;

    const parts = token.split(".");
    if (parts.length < 2) return null;

    const payload = base64UrlDecode(parts[1]);
    const parsed = JSON.parse(payload) as { filename?: unknown; url?: unknown };
    return {
      filename:
        typeof parsed.filename === "string" ? parsed.filename : undefined,
      url: typeof parsed.url === "string" ? parsed.url : undefined,
    };
  } catch {
    return null;
  }
}

function extractFilenameFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;

  try {
    const pathname = new URL(url).pathname;
    const parts = pathname.split("/").filter(Boolean);
    const segment = parts.length > 0 ? parts[parts.length - 1] : null;
    return segment ? decodeURIComponent(segment) : null;
  } catch {
    return null;
  }
}

function base64UrlDecode(input: string): string {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return atob(padded);
}
