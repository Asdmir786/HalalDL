import { create } from "zustand";
import type { DownloadsAddMode, QuickDestinationMode } from "./settings";
import type { Screen } from "./navigation";
import type { ComposeDraft } from "./downloads";

export type WindowMode = "full" | "quick";

export interface TrayStatusState {
  activeDownloads: number;
  failedJobs: number;
  queuePaused: boolean;
  appUpdateAvailable: boolean;
  toolUpdateCount: number;
}

export interface QuickDownloadDraft {
  url: string;
  presetId: string;
  startMode: DownloadsAddMode;
  destinationMode: QuickDestinationMode;
}

interface RuntimeState {
  windowMode: WindowMode;
  queuePaused: boolean;
  persistenceReady: boolean;
  lastFullScreen: Screen;
  trayStatus: TrayStatusState;
  quickDraft: QuickDownloadDraft | null;
  openQuickMode: (draft: QuickDownloadDraft) => void;
  closeQuickMode: () => void;
  restoreFullMode: (screen?: Screen) => void;
  setQueuePaused: (paused: boolean) => void;
  setPersistenceReady: (ready: boolean) => void;
  setTrayStatus: (next: Partial<TrayStatusState>) => void;
  applyComposeDraft: (draft: ComposeDraft, defaults: Pick<QuickDownloadDraft, "startMode" | "destinationMode">) => void;
}

const DEFAULT_TRAY_STATUS: TrayStatusState = {
  activeDownloads: 0,
  failedJobs: 0,
  queuePaused: false,
  appUpdateAvailable: false,
  toolUpdateCount: 0,
};

export const useRuntimeStore = create<RuntimeState>((set) => ({
  windowMode: "full",
  queuePaused: false,
  persistenceReady: false,
  lastFullScreen: "downloads",
  trayStatus: DEFAULT_TRAY_STATUS,
  quickDraft: null,
  openQuickMode: (draft) =>
    set((state) => ({
      windowMode: "quick",
      quickDraft: draft,
      lastFullScreen: state.lastFullScreen,
    })),
  closeQuickMode: () =>
    set({
      windowMode: "full",
      quickDraft: null,
    }),
  restoreFullMode: (screen) =>
    set((state) => ({
      windowMode: "full",
      quickDraft: null,
      lastFullScreen: screen ?? state.lastFullScreen,
    })),
  setQueuePaused: (paused) =>
    set((state) => ({
      queuePaused: paused,
      trayStatus: {
        ...state.trayStatus,
        queuePaused: paused,
      },
    })),
  setPersistenceReady: (ready) => set({ persistenceReady: ready }),
  setTrayStatus: (next) =>
    set((state) => ({
      trayStatus: {
        ...state.trayStatus,
        ...next,
      },
    })),
  applyComposeDraft: (draft, defaults) =>
    set({
      quickDraft: {
        url: draft.url,
        presetId: draft.presetId,
        startMode: defaults.startMode,
        destinationMode: defaults.destinationMode,
      },
    }),
}));
