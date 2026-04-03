import { toast } from "sonner";
import {
  activateAttentionTarget,
  buildAttentionDeepLink,
  getAttentionActionLabel,
} from "@/lib/attention";
import { isMainWindowVisible, sendNativeWindowsToast } from "@/lib/commands";
import { useLogsStore } from "@/store/logs";
import { useSettingsStore } from "@/store/settings";
import type { AttentionTargetInput } from "@/store/attention";

type NotificationKind = "info" | "success" | "error";

const APP_UPDATE_NOTIFY_KEY = "halaldl:lastNotifiedAppUpdateVersion";
const TOOL_UPDATE_NOTIFY_KEY = "halaldl:lastNotifiedToolUpdateVersions";

async function sendDesktopNotification(
  title: string,
  body: string,
  target?: AttentionTargetInput
) {
  try {
    await sendNativeWindowsToast({
      title,
      body,
      ...(target
        ? {
            launch: buildAttentionDeepLink({
              ...target,
              actionLabel: getAttentionActionLabel(target),
            }),
          }
        : {}),
    });
  } catch (error) {
    useLogsStore.getState().addLog({
      level: "warn",
      message: `Native Windows toast failed: ${String(error)}`,
    });
  }
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
