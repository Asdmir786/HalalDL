import { create } from "zustand";

export interface Preset {
  id: string;
  name: string;
  description: string;
  isBuiltIn: boolean;
  args: string[];
}

interface PresetsState {
  presets: Preset[];
  addPreset: (preset: Omit<Preset, "id">) => void;
  updatePreset: (id: string, preset: Partial<Preset>) => void;
  deletePreset: (id: string) => void;
  duplicatePreset: (id: string) => void;
}

const BUILT_IN_PRESETS: Preset[] = [
  {
    id: "default",
    name: "Global Default",
    description: "Best quality video and audio (Standard)",
    isBuiltIn: true,
    args: ["-f", "bestvideo+bestaudio/best"],
  },
  {
    id: "whatsapp",
    name: "WhatsApp Optimized",
    description: "MP4 with H.264/AAC for maximum compatibility",
    isBuiltIn: true,
    args: ["-f", "bv[ext=mp4][vcodec^=avc1]+ba[ext=m4a]/b[ext=mp4]"],
  },
  {
    id: "mp4-best",
    name: "Best MP4",
    description: "Highest quality MP4 container",
    isBuiltIn: true,
    args: ["-f", "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]"],
  },
  {
    id: "webm-best",
    name: "Best WebM",
    description: "Highest quality WebM container (VP9/AV1)",
    isBuiltIn: true,
    args: ["-f", "bestvideo[ext=webm]+bestaudio[ext=webm]/best[ext=webm]"],
  },
  {
    id: "high-quality",
    name: "High Quality (4K)",
    description: "Prioritize maximum resolution",
    isBuiltIn: true,
    args: ["-f", "bestvideo[height<=2160]+bestaudio/best"],
  },
  {
    id: "video-only",
    name: "Video Only",
    description: "Highest quality video without audio",
    isBuiltIn: true,
    args: ["-f", "bestvideo"],
  },
  {
    id: "audio-only",
    name: "Audio Only",
    description: "Highest quality audio without video",
    isBuiltIn: true,
    args: ["-f", "bestaudio"],
  },
  {
    id: "mp3",
    name: "Audio (MP3)",
    description: "Extract audio in high quality MP3 format",
    isBuiltIn: true,
    args: ["-x", "--audio-format", "mp3", "--audio-quality", "0"],
  },
];

export const usePresetsStore = create<PresetsState>((set) => ({
  presets: BUILT_IN_PRESETS,
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
