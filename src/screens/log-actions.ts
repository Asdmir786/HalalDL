import type { LogEntry } from "@/store/logs";

export function formatLineCount(count: number): string {
  return `${count} line${count === 1 ? "" : "s"}`;
}

export function formatLogLines(logs: LogEntry[]): string {
  return logs
    .map((log) => {
      const parts = [`[${log.timestamp}]`, `[${log.level.toUpperCase()}]`];

      if (log.jobId) {
        parts.push(`[job:${log.jobId}]`);
      }

      parts.push(log.message);

      if (log.command) {
        parts.push(`command: ${log.command}`);
      }

      return parts.join(" ");
    })
    .join("\n");
}
