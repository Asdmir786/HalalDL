import { restoreMainWindow } from "@/lib/commands";
import { useAttentionStore, type AttentionTargetInput } from "@/store/attention";
import { useNavigationStore } from "@/store/navigation";
import { useRuntimeStore } from "@/store/runtime";

const EXTRA_KEY = "__halaldl_attention__";

type AttentionExtra = AttentionTargetInput & {
  [EXTRA_KEY]: true;
};

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

export function buildAttentionExtra(target: AttentionTargetInput): Record<string, unknown> {
  const payload: AttentionExtra = {
    ...target,
    actionLabel: getAttentionActionLabel(target),
    [EXTRA_KEY]: true,
  };
  return payload as unknown as Record<string, unknown>;
}

export function parseAttentionExtra(extra: Record<string, unknown> | undefined | null) {
  if (!extra || extra[EXTRA_KEY] !== true) return null;
  const screen = extra.screen;
  const reason = extra.reason;
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
  if (typeof reason !== "string" || !reason.trim()) {
    return null;
  }

  const targetType =
    extra.targetType === "tool" || extra.targetType === "job" || extra.targetType === "section"
      ? extra.targetType
      : undefined;
  const targetId = typeof extra.targetId === "string" && extra.targetId.trim() ? extra.targetId : undefined;
  const section = extra.section === "live" || extra.section === "recent" ? extra.section : undefined;
  const actionLabel =
    typeof extra.actionLabel === "string" && extra.actionLabel.trim()
      ? extra.actionLabel
      : undefined;

  return {
    screen,
    reason,
    ...(targetType ? { targetType } : {}),
    ...(targetId ? { targetId } : {}),
    ...(section ? { section } : {}),
    ...(actionLabel ? { actionLabel } : {}),
  } satisfies AttentionTargetInput;
}
