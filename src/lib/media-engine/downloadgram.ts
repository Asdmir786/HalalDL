import { postFormForText } from "@/lib/commands";
import configuredProviders from "./downloadgram-providers.json";

type MediaType = "image" | "video";
type ResolveKind = "single" | "carousel";
type TokenMode = "jwt-query" | "direct";

interface DownloadGramProvider {
  id: string;
  label: string;
  enabled?: boolean;
  endpoint: string;
  referer: string;
  origin: string;
  formFields?: Record<string, string>;
  parser: string;
  tokenMode: TokenMode;
  resultBlockSelectors: string[];
  downloadLinkSelector?: string;
  thumbnailSelector?: string;
  mediaIconSelector?: string;
  lastChecked?: string;
  notes?: string;
}

export interface InstagramMediaItem {
  id: string;
  index: number;
  type: MediaType;
  downloadUrl: string;
  thumbnailUrl: string | null;
  sourceUrl: string | null;
  suggestedFilename: string | null;
  provider: string;
}

export interface InstagramResolveResult {
  provider: "downloadgram";
  providerInstance: string;
  sourceUrl: string;
  shortcode: string;
  resourceType: "post" | "reel" | "tv" | "unknown";
  kind: ResolveKind;
  items: InstagramMediaItem[];
  resolvedAt: string;
}

const DOWNLOADGRAM_PROVIDERS = (
  configuredProviders as unknown as DownloadGramProvider[]
).filter((provider) =>
  Boolean(
    provider.enabled !== false &&
      provider.id &&
      provider.endpoint &&
      provider.referer &&
      provider.origin &&
      provider.tokenMode &&
      provider.resultBlockSelectors?.length
  )
);

const ALERT_START = "pushAlert(";
const HTML_ASSIGNMENT_MARKERS = ["['innerHTML']=", ".innerHTML=", ".html("];
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
      const items = parseDownloadGramHtml(html, provider);

      if (items.length === 0) {
        throw new Error(
          `${provider.label} returned no downloadable media items.`
        );
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

  if (trimmed.startsWith("<")) {
    return trimmed;
  }

  const html = extractAssignedHtml(responseText)?.trim();
  if (!html) {
    throw new Error("Could not find DownloadGram HTML payload.");
  }

  return html;
}

function extractAssignedHtml(source: string): string | null {
  for (const marker of HTML_ASSIGNMENT_MARKERS) {
    let searchIndex = 0;
    while (searchIndex < source.length) {
      const markerIndex = source.indexOf(marker, searchIndex);
      if (markerIndex === -1) break;

      let valueIndex = markerIndex + marker.length;
      while (/\s/.test(source[valueIndex] ?? "")) valueIndex += 1;
      if (source[valueIndex] === "=") {
        valueIndex += 1;
        while (/\s/.test(source[valueIndex] ?? "")) valueIndex += 1;
      }

      const quote = source[valueIndex];
      if (quote === "'" || quote === '"') {
        const raw = readQuotedJsString(source, valueIndex + 1, quote);
        return quote === "'"
          ? decodeJsSingleQuotedString(raw)
          : decodeJsDoubleQuotedString(raw);
      }

      searchIndex = markerIndex + marker.length;
    }
  }

  return null;
}

function readQuotedJsString(
  source: string,
  startIndex: number,
  quote: "'" | '"'
): string {
  let out = "";
  for (let i = startIndex; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === quote && source[i - 1] !== "\\") {
      return out;
    }
    out += ch;
  }
  throw new Error("DownloadGram payload string was not terminated.");
}

function decodeJsDoubleQuotedString(raw: string): string {
  return decodeJsSingleQuotedString(raw.replace(/\\"/g, '"'));
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
  provider: DownloadGramProvider
): InstagramMediaItem[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const blocks = Array.from(
    doc.querySelectorAll(provider.resultBlockSelectors.join(","))
  );
  const downloadLinkSelector = provider.downloadLinkSelector ?? "a[href]";
  const thumbnailSelector = provider.thumbnailSelector ?? "img[src]";
  const mediaIconSelector = provider.mediaIconSelector ?? ".format-icon i";

  return blocks
    .map((block, index) => {
      const anchor = block.querySelector<HTMLAnchorElement>(downloadLinkSelector);
      const normalizedDownloadUrl = normalizeDownloadGramUrl(
        anchor?.getAttribute("href"),
        provider.origin
      );
      if (!normalizedDownloadUrl) return null;

      const image = block.querySelector<HTMLImageElement>(thumbnailSelector);
      const icon = block.querySelector<HTMLElement>(mediaIconSelector);
      const thumbnailUrl = normalizeDownloadGramUrl(
        image?.getAttribute("src"),
        provider.origin
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
        provider: provider.id,
      } satisfies InstagramMediaItem;
    })
    .filter((item): item is InstagramMediaItem => item !== null);
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
  provider: DownloadGramProvider
): {
  downloadUrl: string;
  sourceUrl: string | null;
  suggestedFilename: string | null;
} {
  const tokenPayload =
    provider.tokenMode === "jwt-query" ? decodeDownloadGramToken(downloadUrl) : null;
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
