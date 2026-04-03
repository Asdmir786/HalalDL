import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";
import { toast } from "sonner";
import { activateAttentionTarget, buildAttentionExtra, getAttentionActionLabel } from "@/lib/attention";
import { isMainWindowVisible } from "@/lib/commands";
import { useLogsStore } from "@/store/logs";
import { useSettingsStore } from "@/store/settings";
import type { AttentionTargetInput } from "@/store/attention";

type NotificationKind = "info" | "success" | "error";

const APP_UPDATE_NOTIFY_KEY = "halaldl:lastNotifiedAppUpdateVersion";
const TOOL_UPDATE_NOTIFY_KEY = "halaldl:lastNotifiedToolUpdateVersions";
const PENDING_DESKTOP_ATTENTION_KEY = "halaldl:pendingDesktopAttentionTarget";
let desktopPermissionCache: boolean | null = null;

async function ensureDesktopNotificationPermission() {
  if (desktopPermissionCache !== null) {
    return desktopPermissionCache;
  }

  try {
    let permissionGranted = await isPermissionGranted();
    if (!permissionGranted) {
      const permission = await requestPermission();
      permissionGranted = permission === "granted";
    }
    desktopPermissionCache = permissionGranted;
    return permissionGranted;
  } catch (error) {
    useLogsStore.getState().addLog({
      level: "warn",
      message: `Failed to send notification: ${String(error)}`,
    });
    desktopPermissionCache = false;
    return false;
  }
}

async function sendDesktopNotification(
  title: string,
  body: string,
  target?: AttentionTargetInput
) {
  const permissionGranted = await ensureDesktopNotificationPermission();
  if (!permissionGranted) {
    return;
  }

  sendNotification({
    title,
    body,
    autoCancel: true,
    ...(target ? { extra: buildAttentionExtra(target) } : {}),
  });
}

async function shouldUseDesktopNotification() {
  if (typeof document !== "undefined" && document.visibilityState === "visible" && document.hasFocus()) {
    return false;
  }

  try {
    const visible = await isMainWindowVisible();
    if (!visible) return true;
  } catch {
    void 0;
  }

  if (typeof document === "undefined") return false;
  return document.visibilityState !== "visible" || !document.hasFocus();
}

export async function notifyUser(
  title: string,
  description: string,
  kind: NotificationKind = "info",
  target?: AttentionTargetInput
) {
  const useDesktop = await shouldUseDesktopNotification();

  if (useDesktop) {
    if (useSettingsStore.getState().settings.notifications) {
      if (target) {
        writePendingDesktopAttentionTarget(target);
      }
      await sendDesktopNotification(title, description, target);
    }
    return;
  }

  const toastOptions = target
    ? {
        description,
        action: {
          label: getAttentionActionLabel(target),
          onClick: () => {
            void activateAttentionTarget(target);
          },
        },
      }
    : { description };

  if (kind === "success") {
    toast.success(title, toastOptions);
    return;
  }
  if (kind === "error") {
    toast.error(title, toastOptions);
    return;
  }
  toast.info(title, toastOptions);
}

export function readLastNotifiedAppUpdateVersion() {
  try {
    return localStorage.getItem(APP_UPDATE_NOTIFY_KEY);
  } catch {
    return null;
  }
}

export function writeLastNotifiedAppUpdateVersion(version: string) {
  try {
    localStorage.setItem(APP_UPDATE_NOTIFY_KEY, version);
  } catch {
    void 0;
  }
}

export function readLastNotifiedToolUpdateVersions() {
  try {
    const raw = localStorage.getItem(TOOL_UPDATE_NOTIFY_KEY);
    if (!raw) return {} as Record<string, string>;
    const parsed = JSON.parse(raw) as Record<string, string>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {} as Record<string, string>;
  }
}

export function writeLastNotifiedToolUpdateVersions(versions: Record<string, string>) {
  try {
    localStorage.setItem(TOOL_UPDATE_NOTIFY_KEY, JSON.stringify(versions));
  } catch {
    void 0;
  }
}

export function readPendingDesktopAttentionTarget() {
  try {
    const raw = localStorage.getItem(PENDING_DESKTOP_ATTENTION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AttentionTargetInput | null;
    if (!parsed || typeof parsed !== "object") return null;
    if (
      parsed.screen !== "downloads" &&
      parsed.screen !== "presets" &&
      parsed.screen !== "tools" &&
      parsed.screen !== "logs" &&
      parsed.screen !== "history" &&
      parsed.screen !== "settings"
    ) {
      return null;
    }
    if (typeof parsed.reason !== "string" || !parsed.reason.trim()) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writePendingDesktopAttentionTarget(target: AttentionTargetInput) {
  try {
    localStorage.setItem(PENDING_DESKTOP_ATTENTION_KEY, JSON.stringify(target));
  } catch {
    void 0;
  }
}

export function clearPendingDesktopAttentionTarget() {
  try {
    localStorage.removeItem(PENDING_DESKTOP_ATTENTION_KEY);
  } catch {
    void 0;
  }
}

export async function consumePendingDesktopAttentionTarget() {
  const target = readPendingDesktopAttentionTarget();
  if (!target) return false;
  clearPendingDesktopAttentionTarget();
  await activateAttentionTarget(target);
  return true;
}
