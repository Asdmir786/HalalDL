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
