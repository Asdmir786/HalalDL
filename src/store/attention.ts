import { create } from "zustand";
import type { Screen } from "./navigation";

export type AttentionTargetType = "tool" | "job" | "section";

export interface AttentionTargetInput {
  screen: Screen;
  reason: string;
  targetType?: AttentionTargetType;
  targetId?: string;
  section?: "live" | "recent";
  actionLabel?: string;
}

export interface AttentionTarget extends AttentionTargetInput {
  token: number;
  createdAt: number;
}

interface AttentionState {
  target: AttentionTarget | null;
  setTarget: (target: AttentionTargetInput) => AttentionTarget;
  clearTarget: (token?: number) => void;
}

let attentionSequence = 0;

export const useAttentionStore = create<AttentionState>((set) => ({
  target: null,
  setTarget: (target) => {
    attentionSequence += 1;
    const next: AttentionTarget = {
      ...target,
      token: attentionSequence,
      createdAt: Date.now(),
    };
    set({ target: next });
    return next;
  },
  clearTarget: (token) =>
    set((state) => {
      if (!state.target) return state;
      if (typeof token === "number" && state.target.token !== token) {
        return state;
      }
      return { target: null };
    }),
}));
