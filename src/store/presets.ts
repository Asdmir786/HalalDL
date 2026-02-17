import { create } from "zustand";
export { BUILT_IN_PRESETS } from "./built-in-presets";
import { BUILT_IN_PRESETS } from "./built-in-presets";

export interface Preset {
  id: string;
  name: string;
  description: string;
  isBuiltIn: boolean;
  args: string[];
}

interface PresetsState {
  presets: Preset[];
  setPresets: (presets: Preset[]) => void;
  addPreset: (preset: Omit<Preset, "id">) => void;
  updatePreset: (id: string, preset: Partial<Preset>) => void;
  deletePreset: (id: string) => void;
  duplicatePreset: (id: string) => void;
}

export const usePresetsStore = create<PresetsState>((set) => ({
  presets: BUILT_IN_PRESETS,
  setPresets: (presets) => set({ presets }),
  addPreset: (preset) => set((state) => ({
    presets: [...state.presets, { ...preset, id: Math.random().toString(36).substring(7) }],
  })),
  updatePreset: (id, updatedFields) => set((state) => ({
    presets: state.presets.map((p) => p.id === id ? { ...p, ...updatedFields } : p),
  })),
  deletePreset: (id) => set((state) => ({
    presets: state.presets.filter((p) => p.id !== id),
  })),
  duplicatePreset: (id) => set((state) => {
    const original = state.presets.find((p) => p.id === id);
    if (!original) return state;
    return {
      presets: [
        ...state.presets,
        {
          ...original,
          id: Math.random().toString(36).substring(7),
          name: `${original.name} (Copy)`,
          isBuiltIn: false,
        },
      ],
    };
  }),
}));
