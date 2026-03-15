import { getVersion } from "@tauri-apps/api/app";
import {
  getInstallContext,
  resolveLatestAppUpdate,
  type InstallContext,
  type ResolvedAppUpdate,
} from "@/lib/commands";
import { useAppUpdateStore } from "@/store/app-update";
import { useLogsStore } from "@/store/logs";

export interface AppUpdateCheckResult {
  currentVersion: string;
  installContext: InstallContext;
  resolved: ResolvedAppUpdate;
}

export function clearStoredAppUpdate() {
  useAppUpdateStore.setState({
    updateAvailable: false,
    dismissed: false,
    latestVersion: null,
    releaseUrl: null,
    downloadUrl: null,
    assetName: null,
    checksumUrl: null,
  });
}

export function applyResolvedAppUpdate(result: AppUpdateCheckResult) {
  const store = useAppUpdateStore.getState();
  store.setInstallContext(result.installContext);

  if (result.resolved.updateAvailable) {
    store.setUpdate({
      version: result.resolved.latestVersion,
      releaseUrl: result.resolved.releaseUrl,
      downloadUrl: result.resolved.downloadUrl,
      assetName: result.resolved.assetName,
      checksumUrl: result.resolved.checksumUrl,
    });
  } else {
    clearStoredAppUpdate();
  }
}

export async function checkAndStoreAppUpdate(
  currentVersion?: string
): Promise<AppUpdateCheckResult> {
  const resolvedCurrentVersion = currentVersion ?? (await getVersion());
  const installContext = await getInstallContext();
  const resolved = await resolveLatestAppUpdate(
    resolvedCurrentVersion,
    installContext
  );

  const result: AppUpdateCheckResult = {
    currentVersion: resolvedCurrentVersion,
    installContext,
    resolved,
  };

  applyResolvedAppUpdate(result);
  return result;
}

export function logAvailableAppUpdate(result: AppUpdateCheckResult) {
  if (!result.resolved.updateAvailable) return;

  useLogsStore.getState().addLog({
    level: "info",
    message: `App update available: v${result.resolved.latestVersion} (current: v${result.currentVersion}, installer: ${result.installContext.installerType})`,
  });
}
