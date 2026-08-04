import { useSettingsStore } from "@/store/settings";

/** Absolute or relative path to a Netscape-format cookies.txt file. Empty = disabled. */
export function getCookiesFilePath(): string {
  return useSettingsStore.getState().settings.cookiesFilePath?.trim() ?? "";
}

export function cookiesEnabled(cookiesFilePath?: string | null): boolean {
  return Boolean((cookiesFilePath ?? getCookiesFilePath()).trim());
}

/** Append yt-dlp `--cookies` when a cookies file path is configured. */
export function appendCookiesArgs(args: string[], cookiesFilePath?: string | null): void {
  const path = (cookiesFilePath ?? getCookiesFilePath()).trim();
  if (path) {
    args.push("--cookies", path);
  }
}

/** Hide cookie file paths from command lines and log snippets. */
export function redactCookiesInCommandLine(line: string): string {
  return line.replace(
    /(^|\s)(--cookies(?:-from-browser)?)\s+(?:"(?:\\.|[^"])*"|'(?:\\.|[^'])*'|\S+)/gi,
    "$1$2 (path redacted)"
  );
}
