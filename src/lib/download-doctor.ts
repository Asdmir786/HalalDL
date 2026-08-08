import type { Tool } from "@/store/tools";

export const HALALDL_ISSUES_URL = "https://github.com/Asdmir786/HalalDL/issues/new";

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

  if (/login|sign in|cookies\.txt|private|members-only|age-restricted/.test(value)) {
    return {
      kind: "sign-in",
      title: "This needs sign-in",
      summary: "HalalDL cannot access this media until you choose a cookies.txt sign-in file.",
      action: "settings",
      actionLabel: "Choose sign-in file",
    };
  }
  if (/429|rate.limit|not a bot|temporarily blocked|too many requests/.test(value)) {
    return {
      kind: "site-blocked",
      title: "The site is blocking this request",
      summary: "This is usually temporary. Wait a while before retrying; a sign-in file may help only when the site itself requires login.",
      action: "retry",
      actionLabel: "Retry now",
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

function cleanMessage(value: string): string {
  return value
    .replace(/https?:\/\/[^\s)]+/gi, "[link removed]")
    .replace(/[A-Z]:\\Users\\[^\\\s]+/gi, "C:\\Users\\[name]")
    .replace(/(cookie|authorization)\s*[:=].*/gi, "$1: [removed]")
    .replace(/--cookies(?:-from-browser)?\s+\S+/gi, "--cookies [removed]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 600);
}

function formatTool(tool: Tool | undefined): string {
  if (!tool) return "not checked";
  return `${tool.status}${tool.version ? ` (${tool.version})` : ""}`;
}

export function buildDoctorReport(input: {
  title?: string;
  url: string;
  failure: string;
  appVersion: string;
  osLabel: string;
  tools: Tool[];
  includeUrl: boolean;
}): string {
  const domain = (() => {
    try {
      return new URL(input.url).hostname.replace(/^www\./i, "");
    } catch {
      return "unknown";
    }
  })();
  const ytDlp = input.tools.find((tool) => tool.id === "yt-dlp");
  const ffmpeg = input.tools.find((tool) => tool.id === "ffmpeg");

  return [
    "## Download problem",
    "",
    `- HalalDL: ${input.appVersion}`,
    `- Windows: ${input.osLabel}`,
    `- Site: ${domain}`,
    `- yt-dlp: ${formatTool(ytDlp)}`,
    `- FFmpeg: ${formatTool(ffmpeg)}`,
    input.title ? `- Media title: ${input.title}` : null,
    input.includeUrl ? `- Link: ${input.url}` : "- Link: not included",
    "",
    "### What happened",
    cleanMessage(input.failure) || "Download failed without an error message.",
    "",
    "### What I tried",
    "- Used HalalDL Download Doctor",
    "",
    "### Expected result",
    "The media should download successfully.",
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}

export function buildDoctorIssueUrl(report: string, title?: string): string {
  const params = new URLSearchParams({
    title: `Download problem${title ? `: ${title.slice(0, 72)}` : ""}`,
    body: report,
  });
  return `${HALALDL_ISSUES_URL}?${params.toString()}`;
}
