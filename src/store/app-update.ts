import { create } from "zustand";
import type { InstallContext } from "@/lib/commands";

interface AppUpdateState {
  latestVersion: string | null;
  releaseUrl: string | null;
  downloadUrl: string | null;
  assetName: string | null;
  checksumUrl: string | null;
  installContext: InstallContext | null;
  updateAvailable: boolean;
  dismissed: boolean;
  setInstallContext: (context: InstallContext) => void;
  setUpdate: (payload: {
    version: string;
    releaseUrl: string;
    downloadUrl?: string | null;
    assetName?: string | null;
    checksumUrl?: string | null;
  }) => void;
  dismiss: () => void;
}

export const useAppUpdateStore = create<AppUpdateState>((set) => ({
  latestVersion: null,
  releaseUrl: null,
  downloadUrl: null,
  assetName: null,
  checksumUrl: null,
  installContext: null,
  updateAvailable: false,
  dismissed: false,
  setInstallContext: (context) => set({ installContext: context }),
  setUpdate: ({
    version,
    releaseUrl,
    downloadUrl = null,
    assetName = null,
    checksumUrl = null,
  }) =>
    set({
      latestVersion: version,
      releaseUrl,
      downloadUrl,
      assetName,
      checksumUrl,
      updateAvailable: true,
      dismissed: false,
    }),
  dismiss: () => set({ dismissed: true }),
}));
