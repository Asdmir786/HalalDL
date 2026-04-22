import { invoke } from "@tauri-apps/api/core";

export interface AppPaths {
  isPortable: boolean;
  appDir: string;
  dataDir: string;
  stateDir: string;
  binDir: string;
  thumbnailsDir: string;
  archiveDir: string;
  updatesDir: string;
  markerPath: string;
}

let appPathsPromise: Promise<AppPaths> | null = null;

export async function getAppPaths(): Promise<AppPaths> {
  if (!appPathsPromise) {
    appPathsPromise = invoke<AppPaths>("resolve_app_paths");
  }
  return appPathsPromise;
}

export function resetCachedAppPaths() {
  appPathsPromise = null;
}

export async function getStateFilePath(fileName: string): Promise<string> {
  const paths = await getAppPaths();
  const separator = paths.stateDir.includes("\\") ? "\\" : "/";
  return `${paths.stateDir}${separator}${fileName}`;
}
