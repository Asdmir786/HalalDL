import { storage } from "@/lib/storage";

type RuntimeFlags = {
  lastAppMode?: string;
  fullSwitchAutoInstall?: boolean;
  addModeDefaultMigrated?: boolean;
  lastNotifiedAppUpdateVersion?: string | null;
  lastNotifiedToolUpdateVersions?: Record<string, string>;
};

async function readFlags(): Promise<RuntimeFlags> {
  await storage.init();
  return (await storage.getRuntimeFlags<RuntimeFlags>()) ?? {};
}

async function writeFlags(update: (current: RuntimeFlags) => RuntimeFlags) {
  const current = await readFlags();
  await storage.saveRuntimeFlags(update(current));
}

export async function getLastAppMode(): Promise<string | null> {
  return (await readFlags()).lastAppMode ?? null;
}

export async function setLastAppMode(mode: string) {
  await writeFlags((current) => ({ ...current, lastAppMode: mode }));
}

export async function getFullSwitchAutoInstall(): Promise<boolean> {
  return Boolean((await readFlags()).fullSwitchAutoInstall);
}

export async function setFullSwitchAutoInstall(enabled: boolean) {
  await writeFlags((current) => ({ ...current, fullSwitchAutoInstall: enabled }));
}

export async function getAddModeDefaultMigrated(): Promise<boolean> {
  return Boolean((await readFlags()).addModeDefaultMigrated);
}

export async function setAddModeDefaultMigrated(enabled: boolean) {
  await writeFlags((current) => ({ ...current, addModeDefaultMigrated: enabled }));
}

export async function readLastNotifiedAppUpdateVersion() {
  return (await readFlags()).lastNotifiedAppUpdateVersion ?? null;
}

export async function writeLastNotifiedAppUpdateVersion(version: string) {
  await writeFlags((current) => ({
    ...current,
    lastNotifiedAppUpdateVersion: version,
  }));
}

export async function readLastNotifiedToolUpdateVersions() {
  return (await readFlags()).lastNotifiedToolUpdateVersions ?? {};
}

export async function writeLastNotifiedToolUpdateVersions(
  versions: Record<string, string>
) {
  await writeFlags((current) => ({
    ...current,
    lastNotifiedToolUpdateVersions: versions,
  }));
}
