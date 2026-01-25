import { load, Store } from "@tauri-apps/plugin-store";

class StorageManager {
  private settingsStore: Store | null = null;
  private presetsStore: Store | null = null;
  private logsStore: Store | null = null;
  private downloadsStore: Store | null = null;

  async init() {
    if (this.settingsStore && this.presetsStore && this.logsStore && this.downloadsStore) return;

    try {
      this.settingsStore = await load("settings.json", { autoSave: true, defaults: {} });
      this.presetsStore = await load("presets.json", { autoSave: true, defaults: {} });
      this.logsStore = await load("logs.json", { autoSave: true, defaults: {} });
      this.downloadsStore = await load("downloads.json", { autoSave: true, defaults: {} });
      console.log("Storage initialized successfully");
    } catch (error) {
      console.error("Failed to initialize storage:", error);
      try {
        const { useLogsStore } = await import("@/store/logs");
        const message = error instanceof Error ? error.message : String(error);
        useLogsStore.getState().addLog({ level: "error", message: `Failed to initialize storage: ${message}` });
      } catch {
        void 0;
      }
    }
  }

  async getSettings<T>(): Promise<T | null> {
    if (!this.settingsStore) await this.init();
    return (await this.settingsStore?.get<T>("data")) || null;
  }

  async saveSettings<T>(data: T) {
    if (!this.settingsStore) await this.init();
    await this.settingsStore?.set("data", data);
    await this.settingsStore?.save();
  }

  async getPresets<T>(): Promise<T | null> {
    if (!this.presetsStore) await this.init();
    return (await this.presetsStore?.get<T>("data")) || null;
  }

  async savePresets<T>(data: T) {
    if (!this.presetsStore) await this.init();
    await this.presetsStore?.set("data", data);
    await this.presetsStore?.save();
  }

  async getLogs<T>(): Promise<T | null> {
    if (!this.logsStore) await this.init();
    return (await this.logsStore?.get<T>("data")) || null;
  }

  async saveLogs<T>(data: T) {
    if (!this.logsStore) await this.init();
    await this.logsStore?.set("data", data);
    await this.logsStore?.save();
  }

  async getDownloads<T>(): Promise<T | null> {
    if (!this.downloadsStore) await this.init();
    return (await this.downloadsStore?.get<T>("data")) || null;
  }

  async saveDownloads<T>(data: T) {
    if (!this.downloadsStore) await this.init();
    await this.downloadsStore?.set("data", data);
    await this.downloadsStore?.save();
  }
}

export const storage = new StorageManager();
