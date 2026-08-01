import { invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "@/lib/tauri-runtime";

export type StartupMark = {
  name: string;
  ms: number;
};

type RustStartupTimings = {
  setupCompleteMs: number | null;
};

export type StartupSummary = {
  rustSetupCompleteMs: number | null;
  marks: StartupMark[];
  capturedAt: string;
};

const marks: StartupMark[] = [];
let rustSetupCompleteMs: number | null = null;
let summaryCapturedAt: string | null = null;
const summaryListeners = new Set<() => void>();

function nowMs() {
  return Math.round(performance.now());
}

function notifySummaryListeners() {
  for (const listener of summaryListeners) {
    listener();
  }
}

function buildSummary(): StartupSummary | null {
  if (marks.length === 0 && rustSetupCompleteMs == null) {
    return null;
  }
  return {
    rustSetupCompleteMs,
    marks: getStartupMarks(),
    capturedAt: summaryCapturedAt ?? new Date().toISOString(),
  };
}

export function subscribeStartupSummary(listener: () => void) {
  summaryListeners.add(listener);
  return () => {
    summaryListeners.delete(listener);
  };
}

export function markStartup(name: string) {
  const mark = { name, ms: nowMs() };
  marks.push(mark);
  if (import.meta.env.DEV) {
    console.debug(`[startup] ${name}: ${mark.ms}ms`);
  }
  if (summaryCapturedAt) {
    notifySummaryListeners();
  }
}

export function getStartupMarks() {
  return [...marks];
}

export function getLastStartupSummary(): StartupSummary | null {
  return buildSummary();
}

/** Seed realistic timings for marketing demo screenshots (browser / ?demo=marketing). */
export function seedDemoStartupSummary() {
  marks.length = 0;
  marks.push(
    { name: "first-usable-frame", ms: 186 },
    { name: "persistence-critical-ready", ms: 248 },
    { name: "tools-ready", ms: 312 },
    { name: "ui-idle", ms: 340 }
  );
  rustSetupCompleteMs = 54;
  summaryCapturedAt = new Date().toISOString();
  notifySummaryListeners();
}

export function getMarkMs(summary: StartupSummary | null, name: string): number | null {
  if (!summary) return null;
  const mark = summary.marks.find((entry) => entry.name === name);
  return mark ? mark.ms : null;
}

export function getStartupMetricsSnapshot() {
  const summary = getLastStartupSummary();
  if (!summary) {
    return {
      available: false as const,
      rustSetupCompleteMs: null,
      firstUsableFrameMs: null,
      persistenceCriticalReadyMs: null,
      marks: [] as StartupMark[],
      capturedAt: null as string | null,
    };
  }

  return {
    available: true as const,
    rustSetupCompleteMs: summary.rustSetupCompleteMs,
    firstUsableFrameMs: getMarkMs(summary, "first-usable-frame"),
    persistenceCriticalReadyMs: getMarkMs(summary, "persistence-critical-ready"),
    marks: summary.marks,
    capturedAt: summary.capturedAt,
  };
}

function formatMs(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "n/a";
  return `${Math.round(value)}ms`;
}

export function formatStartupMetricsForSupport(
  summary: StartupSummary | null = getLastStartupSummary()
): string[] {
  if (!summary) {
    return ["Performance:", "- Startup timings: not available yet"];
  }

  return [
    "Performance:",
    `- First usable frame: ${formatMs(getMarkMs(summary, "first-usable-frame"))}`,
    `- Rust setup: ${formatMs(summary.rustSetupCompleteMs)}`,
    `- Persistence ready: ${formatMs(getMarkMs(summary, "persistence-critical-ready"))}`,
  ];
}

export function formatPerformanceReport(
  summary: StartupSummary | null = getLastStartupSummary()
): string {
  if (!summary) {
    return ["HalalDL performance report", "Startup timings: not available yet"].join("\n");
  }

  const markLines =
    summary.marks.length > 0
      ? summary.marks.map((mark) => `- ${mark.name}: ${mark.ms}ms`).join("\n")
      : "- No marks recorded";

  return [
    "HalalDL performance report",
    `Captured at: ${summary.capturedAt}`,
    ...formatStartupMetricsForSupport(summary).slice(1),
    "",
    "All marks:",
    markLines,
  ].join("\n");
}

export async function reportStartupSummary() {
  const demo =
    typeof window !== "undefined" &&
    ["marketing", "1", "true"].includes(
      new URLSearchParams(window.location.search).get("demo")?.trim().toLowerCase() ?? ""
    );

  if (demo) {
    // Keep seeded marketing timings instead of nulling Rust setup outside Tauri.
    summaryCapturedAt = new Date().toISOString();
    const summary = buildSummary();
    if (summary) {
      notifySummaryListeners();
      console.info("[startup] demo summary", summary);
      return summary;
    }
  }

  const rust = isTauriRuntime()
    ? await invoke<RustStartupTimings>("startup_timings").catch(() => null)
    : null;
  rustSetupCompleteMs = rust?.setupCompleteMs ?? null;
  summaryCapturedAt = new Date().toISOString();
  const summary = buildSummary()!;
  notifySummaryListeners();
  console.info("[startup] summary", summary);
  return summary;
}
