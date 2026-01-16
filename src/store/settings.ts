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
  fileCollision: FileCollisionAction;
  
  // Paths
  defaultDownloadDir: string;
  tempDir: string;

  // Behavior
  autoClearFinished: boolean;
}

interface SettingsState {
  settings: Settings;
  setSettings: (settings: Settings) => void;
  updateSettings: (settings: Partial<Settings>) => void;
  resetSettings: () => void;
}

const DEFAULT_SETTINGS: Settings = {
  theme: "system",
  notifications: true,
  maxConcurrency: 2,
  maxRetries: 3,
  fileCollision: "rename",
  defaultDownloadDir: "", 
  tempDir: "",
  autoClearFinished: false,
};

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: DEFAULT_SETTINGS,
  setSettings: (settings) => set({ settings }),
  updateSettings: (newSettings) =>
    set((state) => ({
      settings: { ...state.settings, ...newSettings },
    })),
  resetSettings: () => set({ settings: DEFAULT_SETTINGS }),
}));
