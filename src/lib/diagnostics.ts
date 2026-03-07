import { useDownloadsStore, type DownloadJob } from "@/store/downloads";
import { useHistoryStore, type HistoryEntry } from "@/store/history";
import { useLogsStore, type LogEntry } from "@/store/logs";
import { usePresetsStore, type Preset } from "@/store/presets";
import { useSettingsStore, type Settings } from "@/store/settings";
import { useToolsStore, type Tool } from "@/store/tools";

type DiagnosticsRedaction = {
  redactUrls: boolean;
  redactPaths: boolean;
};

function redactUrl(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./i, "");
    const path = u.pathname.replace(/\/+$/, "");
    return path ? `${host}${path}` : host;
  } catch {
    return url;
  }
}

function redactPath(p: string): string {
  const s = String(p);
  return s
    .replace(/[A-Z]:\\Users\\[^\\]+/gi, (m) => m.replace(/\\Users\\[^\\]+/i, "\\Users\\…"))
    .replace(/\\\\Users\\\\[^\\\\]+/gi, (m) => m.replace(/\\\\Users\\\\[^\\\\]+/i, "\\\\Users\\\\…"));
}

function redactLogLine(line: string, redaction: DiagnosticsRedaction): string {
  let out = line;
  if (redaction.redactUrls) {
    out = out.replace(/https?:\/\/[^\s)]+/gi, (m) => redactUrl(m));
  }
  if (redaction.redactPaths) {
    out = redactPath(out);
  }
  out = out.replace(/(authorization:\s*)(.+)$/gim, "$1(REDACTED)");
  out = out.replace(/(cookie:\s*)(.+)$/gim, "$1(REDACTED)");
  return out;
}

function sanitizeJob(job: DownloadJob, redaction: DiagnosticsRedaction) {
  const url = redaction.redactUrls ? redactUrl(job.url) : job.url;
  const outputPath = job.outputPath && redaction.redactPaths ? redactPath(job.outputPath) : job.outputPath;
  return {
    ...job,
    url,
    outputPath,
    thumbnail: undefined,
  };
}

function sanitizeHistory(entry: HistoryEntry, redaction: DiagnosticsRedaction) {
  const url = redaction.redactUrls ? redactUrl(entry.url) : entry.url;
  const outputPath = entry.outputPath && redaction.redactPaths ? redactPath(entry.outputPath) : entry.outputPath;
  return {
    ...entry,
    url,
    outputPath,
    thumbnail: undefined,
  };
}

function sanitizeTool(tool: Tool, redaction: DiagnosticsRedaction) {
  const systemPath = tool.systemPath && redaction.redactPaths ? redactPath(tool.systemPath) : tool.systemPath;
  const path = tool.path && redaction.redactPaths ? redactPath(tool.path) : tool.path;
  return { ...tool, systemPath, path };
}

export function buildDiagnosticsPayload(redaction: DiagnosticsRedaction) {
  const logsState = useLogsStore.getState();
  const downloadsState = useDownloadsStore.getState();
  const historyState = useHistoryStore.getState();
  const toolsState = useToolsStore.getState();
  const settingsState = useSettingsStore.getState();
  const presetsState = usePresetsStore.getState();

  const createdAt = new Date().toISOString();

  const logsText = logsState.logs
    .map((l: LogEntry) => {
      const base = `[${l.timestamp}] [${l.level.toUpperCase()}] ${l.message}${l.command ? ` | ${l.command}` : ""}`;
      return redactLogLine(base, redaction);
    })
    .join("\n");

  const appMode = String(import.meta.env.VITE_APP_MODE ?? "").trim().toUpperCase();

  const toolsStatus = {
    tools: toolsState.tools.map((t: Tool) => sanitizeTool(t, redaction)),
    discoveredToolId: toolsState.discoveredToolId,
  };

  const downloadQueue = {
    jobs: downloadsState.jobs.map((j: DownloadJob) => sanitizeJob(j, redaction)),
  };

  const historySummary = {
    count: historyState.entries.length,
    favorites: historyState.entries.filter((e) => e.isFavorite).length,
    completed: historyState.entries.filter((e) => e.status === "completed").length,
    failed: historyState.entries.filter((e) => e.status === "failed").length,
    recent: historyState.entries.slice(0, 50).map((e) => sanitizeHistory(e, redaction)),
  };

  const settings = settingsState.settings as Settings;
  const presets = presetsState.presets as Preset[];

  return {
    schemaVersion: 1,
    createdAt,
    redaction,
    buildInfo: {
      appMode: appMode === "FULL" ? "FULL" : "LITE",
      userAgent: navigator.userAgent,
    },
    toolsStatus,
    settings,
    presets,
    downloadQueue,
    historySummary,
    logsText,
  };
}

