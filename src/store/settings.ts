import { create } from "zustand";

export type Theme = "system" | "light" | "dark";
export type AccentColor = "default" | "blue" | "green" | "purple" | "rose" | "orange" | "teal";
export type FileCollisionAction = "overwrite" | "rename" | "skip";
export type DownloadsAddMode = "queue" | "start";

export const ACCENT_COLORS: { id: AccentColor; label: string; swatch: string }[] = [
  { id: "default", label: "Default", swatch: "oklch(0.55 0.01 250)" },
  { id: "blue",    label: "Blue",    swatch: "oklch(0.58 0.22 260)" },
  { id: "green",   label: "Green",   swatch: "oklch(0.60 0.19 155)" },
  { id: "purple",  label: "Purple",  swatch: "oklch(0.55 0.24 290)" },
  { id: "rose",    label: "Rose",    swatch: "oklch(0.60 0.22 15)" },
  { id: "orange",  label: "Orange",  swatch: "oklch(0.65 0.20 50)" },
  { id: "teal",    label: "Teal",    swatch: "oklch(0.60 0.15 185)" },
];

export interface Settings {
  // General
  theme: Theme;
  accentColor: AccentColor;
  notifications: boolean;
  
  // Download Logic
  maxConcurrency: number;
  maxRetries: number;
  maxSpeed: number; // in KB/s, 0 = unlimited
  fileCollision: FileCollisionAction;
  
  // Paths
  defaultDownloadDir: string;
  tempDir: string;

  // Behavior
  autoClearFinished: boolean;
  autoCopyFile: boolean;
  downloadsAddMode: DownloadsAddMode;
  downloadsSelectedPreset: string;
}

interface SettingsState {
  settings: Settings;
  setSettings: (settings: Settings) => void;
  updateSettings: (settings: Partial<Settings>) => void;
  resetSettings: () => void;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: "system",
  accentColor: "default",
  notifications: true,
  maxConcurrency: 2,
  maxRetries: 3,
  maxSpeed: 0,
  fileCollision: "rename",
  defaultDownloadDir: "", 
  tempDir: "",
  autoClearFinished: false,
  autoCopyFile: true,
  downloadsAddMode: "queue",
  downloadsSelectedPreset: "default",
};

export const SETTINGS_KEYS = Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[];

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: DEFAULT_SETTINGS,
  setSettings: (settings) => set({ settings }),
  updateSettings: (newSettings) =>
    set((state) => ({
      settings: { ...state.settings, ...newSettings },
    })),
  resetSettings: () => set({ settings: DEFAULT_SETTINGS }),
}));
