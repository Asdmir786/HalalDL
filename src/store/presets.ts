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
  setPresets: (presets: Preset[]) => void;
  addPreset: (preset: Omit<Preset, "id">) => void;
  updatePreset: (id: string, preset: Partial<Preset>) => void;
  deletePreset: (id: string) => void;
  duplicatePreset: (id: string) => void;
}

export const BUILT_IN_PRESETS: Preset[] = [
  {
    id: "default",
    name: "Recommended — Best Available",
    description: "Best video + audio from the source (no size limits)",
    isBuiltIn: true,
    args: ["-f", "bestvideo+bestaudio/best"],
  },
  {
    id: "recommended-1080p",
    name: "Recommended — Best Available (Up to 1080p)",
    description: "Best video up to 1080p + best audio",
    isBuiltIn: true,
    args: ["-f", "bestvideo[height<=1080]+bestaudio/best"],
  },
  {
    id: "whatsapp",
    name: "Compatibility — MP4 (H.264 + AAC)",
    description: "Most compatible choice for phones, social apps, and editors",
    isBuiltIn: true,
    args: ["-f", "bv[ext=mp4][vcodec^=avc1]+ba[ext=m4a]/b[ext=mp4]", "--merge-output-format", "mp4"],
  },
  {
    id: "mp4-best",
    name: "Compatibility — Best MP4 (Any Codec)",
    description: "Highest quality MP4; codec may vary by source",
    isBuiltIn: true,
    args: ["-f", "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]", "--merge-output-format", "mp4"],
  },
  {
    id: "webm-best",
    name: "Web — Best WebM (VP9/AV1)",
    description: "Best WebM quality; not ideal for most editors",
    isBuiltIn: true,
    args: ["-f", "bestvideo[ext=webm]+bestaudio[ext=webm]/best[ext=webm]"],
  },
  {
    id: "high-quality",
    name: "Recommended — Best Available (Up to 4K)",
    description: "Best video up to 2160p + best audio",
    isBuiltIn: true,
    args: ["-f", "bestvideo[height<=2160]+bestaudio/best"],
  },
  {
    id: "editors-capcut-1080p-mp4",
    name: "Editors — CapCut (1080p MP4 H.264 + AAC)",
    description: "Editing-friendly MP4 for CapCut; prefers H.264/AAC when available",
    isBuiltIn: true,
    args: [
      "-f",
      "bv[height<=1080][ext=mp4][vcodec^=avc1]+ba[ext=m4a]/bv[height<=1080][vcodec^=avc1]+ba/b[height<=1080][ext=mp4]/b[height<=1080]",
      "--merge-output-format",
      "mp4",
    ],
  },
  {
    id: "editors-capcut-4k-mp4",
    name: "Editors — CapCut (4K MP4 H.264 + AAC)",
    description: "Editing-friendly MP4 for CapCut; prefers H.264/AAC when available",
    isBuiltIn: true,
    args: [
      "-f",
      "bv[height<=2160][ext=mp4][vcodec^=avc1]+ba[ext=m4a]/bv[height<=2160][vcodec^=avc1]+ba/b[height<=2160][ext=mp4]/b[height<=2160]",
      "--merge-output-format",
      "mp4",
    ],
  },
  {
    id: "editors-premiere-ae-1080p-mp4",
    name: "Editors — Premiere/After Effects (1080p MP4 H.264 + AAC)",
    description: "Editing-friendly MP4 for Premiere/AE; prefers H.264/AAC when available",
    isBuiltIn: true,
    args: [
      "-f",
      "bv[height<=1080][ext=mp4][vcodec^=avc1]+ba[ext=m4a]/bv[height<=1080][vcodec^=avc1]+ba/b[height<=1080][ext=mp4]/b[height<=1080]",
      "--merge-output-format",
      "mp4",
    ],
  },
  {
    id: "editors-premiere-ae-4k-mp4",
    name: "Editors — Premiere/After Effects (4K MP4 H.264 + AAC)",
    description: "Editing-friendly MP4 for Premiere/AE; prefers H.264/AAC when available",
    isBuiltIn: true,
    args: [
      "-f",
      "bv[height<=2160][ext=mp4][vcodec^=avc1]+ba[ext=m4a]/bv[height<=2160][vcodec^=avc1]+ba/b[height<=2160][ext=mp4]/b[height<=2160]",
      "--merge-output-format",
      "mp4",
    ],
  },
  {
    id: "editors-prores-1080p-mov",
    name: "Editors Pro — ProRes 422 (1080p MOV)",
    description: "Transcodes to ProRes for smoother editing (large files; requires FFmpeg)",
    isBuiltIn: true,
    args: [
      "-f",
      "bestvideo[height<=1080]+bestaudio/best[height<=1080]",
      "--recode-video",
      "mov",
      "--postprocessor-args",
      "VideoConvertor:-c:v prores_ks -profile:v 3 -pix_fmt yuv422p10le -c:a pcm_s16le",
    ],
  },
  {
    id: "editors-prores-4k-mov",
    name: "Editors Pro — ProRes 422 (4K MOV)",
    description: "Transcodes to ProRes for smoother editing (huge files; requires FFmpeg)",
    isBuiltIn: true,
    args: [
      "-f",
      "bestvideo[height<=2160]+bestaudio/best[height<=2160]",
      "--recode-video",
      "mov",
      "--postprocessor-args",
      "VideoConvertor:-c:v prores_ks -profile:v 3 -pix_fmt yuv422p10le -c:a pcm_s16le",
    ],
  },
  {
    id: "video-only",
    name: "Video — Best Video Only",
    description: "Highest quality video stream without audio",
    isBuiltIn: true,
    args: ["-f", "bestvideo"],
  },
  {
    id: "audio-only",
    name: "Audio — Best Audio Only",
    description: "Best available audio stream without video",
    isBuiltIn: true,
    args: ["-f", "bestaudio"],
  },
  {
    id: "mp3",
    name: "Audio — MP3 (High Quality)",
    description: "Extracts audio as MP3 (requires FFmpeg)",
    isBuiltIn: true,
    args: ["-x", "--audio-format", "mp3", "--audio-quality", "0"],
  },
];

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
