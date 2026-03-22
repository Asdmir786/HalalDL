import { create } from "zustand";
export { BUILT_IN_PRESETS } from "./built-in-presets";
import { BUILT_IN_PRESETS } from "./built-in-presets";
import type {
  SubtitleFormat,
  SubtitleLanguageMode,
  SubtitleMode,
  SubtitleSourcePolicy,
} from "@/lib/subtitles";

export type PresetFolderBehavior = "default" | "ask";
export type PresetGroup =
  | "recommended"
  | "share"
  | "formats"
  | "audio"
  | "subtitles"
  | "editing"
  | "custom";

export interface Preset {
  id: string;
  name: string;
  description: string;
  isBuiltIn: boolean;
  args: string[];
  group?: PresetGroup;
  featured?: boolean;
  quickEligible?: boolean;
  subtitleMode?: SubtitleMode;
  subtitleSourcePolicy?: SubtitleSourcePolicy;
  subtitleLanguageMode?: SubtitleLanguageMode;
  subtitleLanguages?: string[];
  subtitleFormat?: SubtitleFormat;
  subtitleOnly?: boolean;
  askFolderBehavior?: PresetFolderBehavior;
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
    presets: [
      ...state.presets,
      {
        ...preset,
        featured: preset.featured ?? false,
        group: preset.group ?? "custom",
        id: Math.random().toString(36).substring(7),
      },
    ],
  })),
  updatePreset: (id, updatedFields) => set((state) => ({
    presets: state.presets.map((p) => p.id === id
      ? { ...p, ...updatedFields, group: updatedFields.group ?? p.group ?? "custom" }
      : p),
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
          featured: false,
          group: original.group ?? (original.isBuiltIn ? "recommended" : "custom"),
          isBuiltIn: false,
        },
      ],
    };
  }),
}));
