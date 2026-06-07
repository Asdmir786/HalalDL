import { invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "@/lib/tauri-runtime";

type StartupMark = {
  name: string;
  ms: number;
};

type RustStartupTimings = {
  setupCompleteMs: number | null;
};

const marks: StartupMark[] = [];

function nowMs() {
  return Math.round(performance.now());
}

export function markStartup(name: string) {
  const mark = { name, ms: nowMs() };
  marks.push(mark);
  if (import.meta.env.DEV) {
    console.debug(`[startup] ${name}: ${mark.ms}ms`);
  }
}

export function getStartupMarks() {
  return [...marks];
}

export async function reportStartupSummary() {
  const rust = isTauriRuntime()
    ? await invoke<RustStartupTimings>("startup_timings").catch(() => null)
    : null;
  const summary = {
    rustSetupCompleteMs: rust?.setupCompleteMs ?? null,
    marks: getStartupMarks(),
  };
  console.info("[startup] summary", summary);
  return summary;
}
