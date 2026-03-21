import { create } from "zustand";

export type Theme = "system" | "light" | "dark";
export type AccentColor = "default" | "blue" | "green" | "purple" | "rose" | "orange" | "teal";
export type FileCollisionAction = "overwrite" | "rename" | "skip";
export type DownloadsAddMode = "queue" | "start";
export type QuickActionBehavior = "ask" | "instant";
export type QuickDestinationMode = "default" | "ask";
export type TrayLeftClickAction = "quick-panel" | "open-app" | "none";
export type TrayDoubleClickAction = "none" | "open-app";

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
  autoPasteLinks: boolean;
  downloadsAddMode: DownloadsAddMode;
  downloadsSelectedPreset: string;
  preferredSubtitleLanguages: string;
  closeToTray: boolean;
  launchAtLogin: boolean;
  startMinimizedToTray: boolean;
  trayLeftClickAction: TrayLeftClickAction;
  trayDoubleClickAction: TrayDoubleClickAction;
  trayMenuShowHideItem: boolean;
  enableBackgroundUpdateChecks: boolean;
  checkToolUpdatesInBackground: boolean;
  checkAppUpdatesInBackground: boolean;
  quickDefaultPreset: string;
  quickActionBehavior: QuickActionBehavior;
  quickDownloadStartMode: DownloadsAddMode;
  quickDownloadDestinationMode: QuickDestinationMode;

  // History
  historyRetention: number; // max entries to keep, 0 = unlimited
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
  autoPasteLinks: true,
  downloadsAddMode: "start",
  downloadsSelectedPreset: "default",
  preferredSubtitleLanguages: "en.*, en",
  closeToTray: true,
  launchAtLogin: false,
  startMinimizedToTray: true,
  trayLeftClickAction: "quick-panel",
  trayDoubleClickAction: "none",
  trayMenuShowHideItem: true,
  enableBackgroundUpdateChecks: true,
  checkToolUpdatesInBackground: true,
  checkAppUpdatesInBackground: true,
  quickDefaultPreset: "default",
  quickActionBehavior: "ask",
  quickDownloadStartMode: "start",
  quickDownloadDestinationMode: "default",
  historyRetention: 0,
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
