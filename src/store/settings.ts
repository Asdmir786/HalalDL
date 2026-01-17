import { create } from "zustand";

export type Theme = "system" | "light" | "dark";
export type FileCollisionAction = "overwrite" | "rename" | "skip";

export interface Settings {
  // General
  theme: Theme;
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
  paranoidMode: boolean; // Auto-export history to backups folder
}

interface SettingsState {
  settings: Settings;
  setSettings: (settings: Settings) => void;
  updateSettings: (settings: Partial<Settings>) => void;
  resetSettings: () => void;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: "system",
  notifications: true,
  maxConcurrency: 2,
  maxRetries: 3,
  maxSpeed: 0,
  fileCollision: "rename",
  defaultDownloadDir: "", 
  tempDir: "",
  autoClearFinished: false,
  paranoidMode: false,
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
