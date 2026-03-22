import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";
import { toast } from "sonner";
import { isMainWindowVisible } from "@/lib/commands";
import { useLogsStore } from "@/store/logs";
import { useSettingsStore } from "@/store/settings";

type NotificationKind = "info" | "success" | "error";

const APP_UPDATE_NOTIFY_KEY = "halaldl:lastNotifiedAppUpdateVersion";
const TOOL_UPDATE_NOTIFY_KEY = "halaldl:lastNotifiedToolUpdateVersions";
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

async function sendDesktopNotification(title: string, body: string) {
  const permissionGranted = await ensureDesktopNotificationPermission();
  if (!permissionGranted) {
    return;
  }

  sendNotification({ title, body });
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
  kind: NotificationKind = "info"
) {
  const useDesktop = await shouldUseDesktopNotification();

  if (useDesktop) {
    if (useSettingsStore.getState().settings.notifications) {
      await sendDesktopNotification(title, description);
    }
    return;
  }

  if (kind === "success") {
    toast.success(title, { description });
    return;
  }
  if (kind === "error") {
    toast.error(title, { description });
    return;
  }
  toast.info(title, { description });
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
