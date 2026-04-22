import { downloadDir, join } from "@tauri-apps/api/path";
import { invoke } from "@tauri-apps/api/core";
import { getAppMode, type AppMode } from "@/lib/tools/app-mode";
import { fetchJson, isUpdateAvailable } from "./version-utils";
import { getAppPaths } from "@/lib/app-paths";

const REPO_URL = "https://github.com/Asdmir786/HalalDL";
const RELEASES_URL = `${REPO_URL}/releases`;
const LATEST_API =
  "https://api.github.com/repos/Asdmir786/HalalDL/releases/latest";

export type InstallerType = "msi" | "nsis" | "portable" | "unknown";
export type InstallScope = "user" | "machine" | "portable" | "unknown";

export interface InstallContext {
  installerType: InstallerType;
  installScope: InstallScope;
  installDir: string | null;
  uninstallCommand: string | null;
  detectedFrom: string | null;
  registryKey: string | null;
}

export interface GitHubReleaseAsset {
  name: string;
  browser_download_url: string;
  content_type?: string;
  size?: number;
}

export interface GitHubRelease {
  tag_name: string;
  html_url?: string;
  assets?: GitHubReleaseAsset[];
}

export interface ResolvedAppUpdate {
  latestVersion: string;
  releaseUrl: string;
  downloadUrl: string | null;
  assetName: string | null;
  checksumUrl: string | null;
  updateAvailable: boolean | undefined;
}

const UNKNOWN_INSTALL_CONTEXT: InstallContext = {
  installerType: "unknown",
  installScope: "unknown",
  installDir: null,
  uninstallCommand: null,
  detectedFrom: null,
  registryKey: null,
};

export async function getInstallContext(): Promise<InstallContext> {
  try {
    return await invoke<InstallContext>("get_install_context");
  } catch {
    return UNKNOWN_INSTALL_CONTEXT;
  }
}

export function buildPreferredAssetName(
  version: string,
  mode: AppMode,
  installerType: InstallerType
): string | null {
  if (mode === "PORTABLE" || installerType === "portable") {
    return `HalalDL-Portable-v${version}-win10+11-x64.zip`;
  }
  if (installerType === "unknown") return null;

  const flavor = mode === "FULL" ? "Full" : "Lite";
  const base = `HalalDL-${flavor}-v${version}-win10+11-x64`;
  return installerType === "msi" ? `${base}.msi` : `${base}-setup.exe`;
}

export function selectPreferredReleaseAsset(
  release: GitHubRelease,
  mode: AppMode,
  installerType: InstallerType
): GitHubReleaseAsset | null {
  const version = String(release.tag_name ?? "")
    .replace(/^v/, "")
    .trim();
  if (!version) return null;

  const targetName = buildPreferredAssetName(version, mode, installerType);
  if (!targetName) return null;

  const assets = release.assets ?? [];
  return (
    assets.find(
      (asset) => asset.name.toLowerCase() === targetName.toLowerCase()
    ) ?? null
  );
}

function selectChecksumAsset(
  release: GitHubRelease
): GitHubReleaseAsset | null {
  const assets = release.assets ?? [];
  return (
    assets.find((asset) => asset.name.toLowerCase() === "sha256sums.txt") ??
    null
  );
}

export async function resolveLatestAppUpdate(
  currentVersion: string,
  installContext: InstallContext
): Promise<ResolvedAppUpdate> {
  const release = await fetchJson<GitHubRelease>(LATEST_API);
  const latestVersion = String(release.tag_name ?? "")
    .replace(/^v/, "")
    .trim();
  const preferredAsset = selectPreferredReleaseAsset(
    release,
    getAppMode(),
    installContext.installerType
  );
  const checksumAsset = selectChecksumAsset(release);

  return {
    latestVersion,
    releaseUrl: release.html_url ?? RELEASES_URL,
    downloadUrl: preferredAsset?.browser_download_url ?? null,
    assetName: preferredAsset?.name ?? null,
    checksumUrl: checksumAsset?.browser_download_url ?? null,
    updateAvailable: isUpdateAvailable(currentVersion, latestVersion),
  };
}

export async function downloadAndVerifyAppUpdate(
  update: Pick<ResolvedAppUpdate, "downloadUrl" | "assetName" | "checksumUrl">
): Promise<string> {
  if (!update.downloadUrl || !update.assetName || !update.checksumUrl) {
    throw new Error(
      "Verified app update download is unavailable for this release."
    );
  }

  const appMode = getAppMode();
  const dest =
    appMode === "PORTABLE"
      ? await join((await getAppPaths()).updatesDir, update.assetName)
      : await join(await downloadDir(), update.assetName);

  return invoke<string>("download_and_verify_app_update", {
    url: update.downloadUrl,
    dest,
    checksumUrl: update.checksumUrl,
    assetName: update.assetName,
  });
}

export async function launchPortableUpdate(
  zipPath: string,
  relaunchExe?: string
) {
  return invoke("launch_portable_update", {
    zipPath,
    relaunchExe: relaunchExe ?? null,
  });
}
