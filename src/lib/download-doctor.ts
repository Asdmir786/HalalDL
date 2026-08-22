import { formatJobErrorText } from "@/lib/copy-text";
import { cookiesEnabled } from "@/lib/downloader/cookies";

export const HALALDL_ISSUES_URL = "https://github.com/Asdmir786/HalalDL/issues/new/choose";

export type DoctorKind =
  | "sign-in"
  | "site-blocked"
  | "tooling"
  | "storage"
  | "network"
  | "format"
  | "unknown";

export type DoctorFinding = {
  kind: DoctorKind;
  title: string;
  summary: string;
  action?: "retry" | "settings" | "tools";
  actionLabel?: string;
};

export function getDoctorFinding(message: string): DoctorFinding {
  const value = message.toLowerCase();

  if (
    /429|rate.limit|too many requests|temporarily blocked/.test(value) ||
    (/not a bot/.test(value) && /sign in|login/.test(value))
  ) {
    return {
      kind: "site-blocked",
      title: "YouTube is treating this like a bot",
      summary:
        "Waiting a day or two usually does not clear this. Export cookies.txt from a signed-in browser, keep Deno installed, and retry one video at a time.",
      action: "settings",
      actionLabel: "Choose sign-in file",
    };
  }
  if (/login|sign in|cookies\.txt|private|members-only|age-restricted/.test(value)) {
    return {
      kind: "sign-in",
      title: "This needs sign-in",
      summary: "HalalDL cannot access this media until you choose a cookies.txt sign-in file.",
      action: "settings",
      actionLabel: "Choose sign-in file",
    };
  }
  if (/ffmpeg|yt-dlp|aria2|format|extractor|unsupported url/.test(value)) {
    return {
      kind: "tooling",
      title: "A download tool needs attention",
      summary: "Update or repair the listed tool, then retry the download.",
      action: "tools",
      actionLabel: "Open Tools",
    };
  }
  if (/disk|folder|path|permission|access is denied|write the file|space/.test(value)) {
    return {
      kind: "storage",
      title: "HalalDL could not save the file",
      summary: "Check that your download folder exists, has space, and is writable.",
      action: "settings",
      actionLabel: "Open download settings",
    };
  }
  if (/network|connection|timed out|certificate|dns|unreachable/.test(value)) {
    return {
      kind: "network",
      title: "HalalDL could not reach the site",
      summary: "Check your connection, VPN, or firewall, then retry.",
      action: "retry",
      actionLabel: "Retry now",
    };
  }
  return {
    kind: "unknown",
    title: "HalalDL could not safely fix this",
    summary: "The error does not match a safe automatic fix. You can send a redacted report for investigation.",
  };
}

function redactDoctorText(value: string, maxLength: number): string {
  return value
    .replace(/https?:\/\/[^\s)]+/gi, "[link removed]")
    .replace(/[A-Z]:\\Users\\[^\\\s]+/gi, "C:\\Users\\[name]")
    .replace(/(cookie|authorization)\s*[:=].*/gi, "$1: [removed]")
    .replace(/--cookies(?:-from-browser)?\s+\S+/gi, "--cookies [removed]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function siteLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./i, "");
  } catch {
    return "unknown";
  }
}

export function buildDoctorPaste(input: {
  title?: string;
  url: string;
  failure: string;
  includeUrl: boolean;
  logHints?: string[];
  supportInfo: string;
}): string {
  const errorBlock = formatJobErrorText({
    statusDetail:
      redactDoctorText(input.failure, 4000) || "Download failed without an error message.",
    logHints: (input.logHints ?? [])
      .map((line) => redactDoctorText(line, 800))
      .filter(Boolean),
  });

  return [
    "Paste this into a GitHub issue. Do not add cookies or cookies.txt.",
    "",
    "## Download problem",
    "",
    `- Site: ${siteLabel(input.url)}`,
    input.title ? `- Media title: ${input.title}` : null,
    input.includeUrl ? `- Link: ${input.url}` : "- Link: not included",
    `- Cookies file attached: ${cookiesEnabled() ? "yes" : "no"}`,
    "",
    "### What happened",
    errorBlock,
    "",
    "### Support info",
    input.supportInfo.trim() || "Support info was not available.",
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}
