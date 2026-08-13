import { create } from "zustand";
import type { InstallContext } from "@/lib/commands";

interface AppUpdateState {
  latestVersion: string | null;
  releaseUrl: string | null;
  downloadUrl: string | null;
  assetName: string | null;
  checksumUrl: string | null;
  /**
   * A checksum-verified installer downloaded during this app session.
   * This belongs to the update state rather than the About view so opening
   * Settings from a notification cannot make an already-ready update vanish.
   */
  verifiedInstallerPath: string | null;
  installContext: InstallContext | null;
  updateAvailable: boolean;
  dismissed: boolean;
  setInstallContext: (context: InstallContext) => void;
  setVerifiedInstallerPath: (path: string | null) => void;
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
  verifiedInstallerPath: null,
  installContext: null,
  updateAvailable: false,
  dismissed: false,
  setInstallContext: (context) => set({ installContext: context }),
  setVerifiedInstallerPath: (path) => set({ verifiedInstallerPath: path }),
  setUpdate: ({
    version,
    releaseUrl,
    downloadUrl = null,
    assetName = null,
    checksumUrl = null,
  }) =>
    set((state) => {
      const isSameRelease =
        state.latestVersion === version &&
        state.downloadUrl === downloadUrl &&
        state.assetName === assetName;

      return {
        latestVersion: version,
        releaseUrl,
        downloadUrl,
        assetName,
        checksumUrl,
        verifiedInstallerPath: isSameRelease
          ? state.verifiedInstallerPath
          : null,
        updateAvailable: true,
        dismissed: false,
      };
    }),
  dismiss: () => set({ dismissed: true }),
}));
