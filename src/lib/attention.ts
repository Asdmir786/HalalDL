import { restoreMainWindow } from "@/lib/commands";
import { useAttentionStore, type AttentionTargetInput } from "@/store/attention";
import { useNavigationStore } from "@/store/navigation";
import { useRuntimeStore } from "@/store/runtime";

export function getAttentionActionLabel(target: AttentionTargetInput) {
  if (target.actionLabel) return target.actionLabel;
  if (target.screen === "tools") return "Open Tools";
  if (target.screen === "downloads") return "Show Download";
  if (target.screen === "settings" && target.targetId === "about") return "Open About";
  if (target.screen === "settings") return "Open Settings";
  return "Open";
}

export async function activateAttentionTarget(
  target: AttentionTargetInput,
  options?: {
    restoreWindow?: boolean;
  }
) {
  useNavigationStore.getState().setScreen(target.screen);
  useRuntimeStore.getState().restoreFullMode(target.screen);
  useAttentionStore.getState().setTarget({
    ...target,
    actionLabel: getAttentionActionLabel(target),
  });

  if (options?.restoreWindow) {
    await restoreMainWindow().catch(() => {
      void 0;
    });
  }
}

export function buildAttentionDeepLink(target: AttentionTargetInput) {
  const params = new URLSearchParams();
  params.set("screen", target.screen);
  params.set("reason", target.reason);
  if (target.targetType) params.set("targetType", target.targetType);
  if (target.targetId) params.set("targetId", target.targetId);
  if (target.section) params.set("section", target.section);
  if (target.actionLabel) params.set("actionLabel", target.actionLabel);
  return `halaldl://attention?${params.toString()}`;
}

export function parseAttentionSearchParams(params: URLSearchParams) {
  const screen = params.get("screen");
  const reason = params.get("reason");
  if (
    screen !== "downloads" &&
    screen !== "presets" &&
    screen !== "tools" &&
    screen !== "logs" &&
    screen !== "history" &&
    screen !== "settings"
  ) {
    return null;
  }
  if (!reason?.trim()) {
    return null;
  }

  const targetType = params.get("targetType");
  const targetId = params.get("targetId");
  const section = params.get("section");
  const actionLabel = params.get("actionLabel");

  return {
    screen,
    reason,
    ...(targetType === "tool" || targetType === "job" || targetType === "section"
      ? { targetType }
      : {}),
    ...(targetId?.trim() ? { targetId } : {}),
    ...(section === "live" || section === "recent" ? { section } : {}),
    ...(actionLabel?.trim() ? { actionLabel } : {}),
  } satisfies AttentionTargetInput;
}
