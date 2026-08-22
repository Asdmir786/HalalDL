import { create } from "zustand";

export type DenoRuntimeCandidate = {
  path: string;
  version?: string;
};

export type DenoJsRuntimePromptKind = "picker" | "missing" | null;

interface DenoJsRuntimeState {
  promptKind: DenoJsRuntimePromptKind;
  candidates: DenoRuntimeCandidate[];
  openPicker: (candidates: DenoRuntimeCandidate[]) => void;
  openMissing: () => void;
  closePrompt: () => void;
}

export const useDenoJsRuntimeStore = create<DenoJsRuntimeState>((set) => ({
  promptKind: null,
  candidates: [],
  openPicker: (candidates) => set({ promptKind: "picker", candidates }),
  openMissing: () => set({ promptKind: "missing", candidates: [] }),
  closePrompt: () => set({ promptKind: null, candidates: [] }),
}));
