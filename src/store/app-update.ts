import { create } from "zustand";

interface AppUpdateState {
  latestVersion: string | null;
  releaseUrl: string | null;
  updateAvailable: boolean;
  dismissed: boolean;
  setUpdate: (version: string, url: string) => void;
  dismiss: () => void;
}

export const useAppUpdateStore = create<AppUpdateState>((set) => ({
  latestVersion: null,
  releaseUrl: null,
  updateAvailable: false,
  dismissed: false,
  setUpdate: (version, url) =>
    set({ latestVersion: version, releaseUrl: url, updateAvailable: true }),
  dismiss: () => set({ dismissed: true }),
}));
