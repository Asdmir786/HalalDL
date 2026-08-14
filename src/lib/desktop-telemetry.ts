import { createId } from "@/lib/id";
import { storage } from "@/lib/storage";
import type { AppMode } from "@/lib/tools/app-mode";

export const TELEMETRY_ROTATION_MS = 90 * 24 * 60 * 60 * 1000;
export const DESKTOP_TELEMETRY_ENDPOINT =
  import.meta.env.VITE_DESKTOP_TELEMETRY_ENDPOINT ?? "https://halaldl.vercel.app/api/desktop-telemetry";

export type DesktopTelemetryState = {
  installationId: string;
  installationIdCreatedAt: number;
  lastSentDay?: string;
};

export function getLocalDay(value = new Date()): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function needsInstallationIdRotation(state: DesktopTelemetryState | null, now = Date.now()): boolean {
  return !state || !state.installationId || now - state.installationIdCreatedAt >= TELEMETRY_ROTATION_MS;
}

export function shouldSendDailyTelemetry(state: DesktopTelemetryState, day = getLocalDay()): boolean {
  return state.lastSentDay !== day;
}

export async function reportDesktopOpen(input: { version: string; channel: AppMode }): Promise<boolean> {
  const day = getLocalDay();
  const saved = await storage.getTelemetry<DesktopTelemetryState>();
  const state = needsInstallationIdRotation(saved)
    ? { installationId: createId(), installationIdCreatedAt: Date.now() }
    : saved!;

  if (!shouldSendDailyTelemetry(state, day)) return false;

  const response = await fetch(DESKTOP_TELEMETRY_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      event: "app_opened",
      version: input.version,
      channel: input.channel,
      installationId: state.installationId,
    }),
  });

  if (!response.ok) return false;
  await storage.saveTelemetry({ ...state, lastSentDay: day });
  return true;
}
