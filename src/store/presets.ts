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
    name: "Best Quality",
    description: "Highest quality video + audio available",
    isBuiltIn: true,
    args: ["-f", "bestvideo+bestaudio/best"],
  },
  {
    id: "recommended-1080p",
    name: "Best Quality (Up to 1080p)",
    description: "Caps video to 1080p; keeps best available audio",
    isBuiltIn: true,
    args: ["-f", "bestvideo[height<=1080]+bestaudio/best"],
  },
  {
    id: "high-quality",
    name: "Best Quality (Up to 4K)",
    description: "Caps video to 4K; keeps best available audio",
    isBuiltIn: true,
    args: ["-f", "bestvideo[height<=2160]+bestaudio/best"],
  },
  {
    id: "whatsapp",
    name: "WhatsApp (Best Quality)",
    description: "Best quality with WhatsApp-friendly MP4 playback",
    isBuiltIn: true,
    args: [
      "-f",
      "bestvideo+bestaudio/best",
      "--merge-output-format",
      "mp4",
      "--postprocessor-args",
      "Merger:-c:v libx264 -pix_fmt yuv420p -c:a aac -b:a 192k -ac 2 -ar 44100 -crf 20 -preset slow -movflags +faststart",
    ],
  },
  {
    id: "whatsapp-1080p",
    name: "WhatsApp (Up to 1080p)",
    description: "Caps to 1080p for easier sharing; WhatsApp-friendly MP4",
    isBuiltIn: true,
    args: [
      "-f",
      "bestvideo+bestaudio/best",
      "--merge-output-format",
      "mp4",
      "--postprocessor-args",
      "Merger:-vf scale=-2:1080:force_original_aspect_ratio=decrease -c:v libx264 -pix_fmt yuv420p -c:a aac -b:a 192k -ac 2 -ar 44100 -crf 22 -preset slow -movflags +faststart",
    ],
  },
  {
    id: "whatsapp-optimized",
    name: "WhatsApp (Up to 720p)",
    description: "Smaller files for quick sending; WhatsApp-friendly MP4",
    isBuiltIn: true,
    args: [
      "-f",
      "bestvideo+bestaudio/best",
      "--merge-output-format",
      "mp4",
      "--postprocessor-args",
      "Merger:-vf scale=-2:720:force_original_aspect_ratio=decrease -c:v libx264 -pix_fmt yuv420p -c:a aac -b:a 160k -ac 2 -ar 44100 -crf 23 -preset slow -movflags +faststart",
    ],
  },
  {
    id: "mp4-best",
    name: "MP4 (High Quality)",
    description: "High quality MP4; may re-encode depending on source",
    isBuiltIn: true,
    args: [
      "-f",
      "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]",
      "--merge-output-format",
      "mp4",
    ],
  },
  {
    id: "webm-best",
    name: "WebM (High Quality)",
    description: "High quality WebM; best for web playback, not editors",
    isBuiltIn: true,
    args: ["-f", "bestvideo[ext=webm]+bestaudio[ext=webm]/best[ext=webm]"],
  },
  {
    id: "editors-capcut-1080p-mp4",
    name: "CapCut (1080p)",
    description: "Editing-friendly MP4 for CapCut",
    isBuiltIn: true,
    args: [
      "-f",
      "bv[height<=1080][ext=mp4][vcodec^=avc1]+ba[ext=m4a]/bv[height<=1080][vcodec^=avc1]+ba/b[height<=1080][ext=mp4]/b[height<=1080]",
      "--merge-output-format",
      "mp4",
    ],
  },
  {
    id: "editors-capcut-best-mp4",
    name: "CapCut (Best)",
    description: "Editing-friendly MP4 (best available; no resolution cap)",
    isBuiltIn: true,
    args: [
      "-f",
      "bv[ext=mp4][vcodec^=avc1]+ba[ext=m4a]/bv[vcodec^=avc1]+ba/b[ext=mp4]/b",
      "--merge-output-format",
      "mp4",
    ],
  },
  {
    id: "editors-capcut-4k-mp4",
    name: "CapCut (4K)",
    description: "Editing-friendly MP4 for CapCut",
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
    name: "Premiere/AE (1080p)",
    description: "Editing-friendly MP4 for Premiere/After Effects",
    isBuiltIn: true,
    args: [
      "-f",
      "bv[height<=1080][ext=mp4][vcodec^=avc1]+ba[ext=m4a]/bv[height<=1080][vcodec^=avc1]+ba/b[height<=1080][ext=mp4]/b[height<=1080]",
      "--merge-output-format",
      "mp4",
    ],
  },
  {
    id: "editors-premiere-ae-best-mp4",
    name: "Premiere/AE (Best)",
    description: "Editing-friendly MP4 (best available; no resolution cap)",
    isBuiltIn: true,
    args: [
      "-f",
      "bv[ext=mp4][vcodec^=avc1]+ba[ext=m4a]/bv[vcodec^=avc1]+ba/b[ext=mp4]/b",
      "--merge-output-format",
      "mp4",
    ],
  },
  {
    id: "editors-premiere-ae-4k-mp4",
    name: "Premiere/AE (4K)",
    description: "Editing-friendly MP4 for Premiere/After Effects",
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
    name: "ProRes (1080p)",
    description: "Smoother editing; very large files (requires FFmpeg)",
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
    name: "ProRes (4K)",
    description: "Smoother editing; huge files (requires FFmpeg)",
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
    name: "Video Only",
    description: "Highest quality video without audio",
    isBuiltIn: true,
    args: ["-f", "bestvideo"],
  },
  {
    id: "audio-only",
    name: "Audio Only",
    description: "Highest quality audio from the source",
    isBuiltIn: true,
    args: ["-f", "bestaudio"],
  },
  {
    id: "flac",
    name: "Audio to FLAC",
    description: "Converts audio to FLAC (requires FFmpeg)",
    isBuiltIn: true,
    args: ["-f", "bestaudio", "-x", "--audio-format", "flac"],
  },
  {
    id: "wav",
    name: "Audio to WAV",
    description: "Converts audio to WAV (very large; requires FFmpeg)",
    isBuiltIn: true,
    args: ["-f", "bestaudio", "-x", "--audio-format", "wav"],
  },
  {
    id: "alac",
    name: "Audio to ALAC",
    description: "Converts audio to ALAC (requires FFmpeg)",
    isBuiltIn: true,
    args: ["-f", "bestaudio", "-x", "--audio-format", "alac"],
  },
  {
    id: "mp3",
    name: "Audio to MP3",
    description: "High quality MP3 conversion (requires FFmpeg)",
    isBuiltIn: true,
    args: [
      "-f",
      "bestaudio",
      "-x",
      "--audio-format",
      "mp3",
      "--audio-quality",
      "0",
    ],
  },
];

export const usePresetsStore = create<PresetsState>((set) => ({
  presets: BUILT_IN_PRESETS,
  setPresets: (presets) => set({ presets }),
  addPreset: (preset) =>
    set((state) => ({
      presets: [
        ...state.presets,
        { ...preset, id: Math.random().toString(36).substring(7) },
      ],
    })),
  updatePreset: (id, updatedFields) =>
    set((state) => ({
      presets: state.presets.map((p) =>
        p.id === id ? { ...p, ...updatedFields } : p
      ),
    })),
  deletePreset: (id) =>
    set((state) => ({
      presets: state.presets.filter((p) => p.id !== id),
    })),
  duplicatePreset: (id) =>
    set((state) => {
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
