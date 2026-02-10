import { load, Store } from "@tauri-apps/plugin-store";

class StorageManager {
  private settingsStore: Store | null = null;
  private presetsStore: Store | null = null;
  private logsStore: Store | null = null;
  private downloadsStore: Store | null = null;
  private toolsStore: Store | null = null;
  private initPromise: Promise<void> | null = null;
  private initError: string | null = null;

  async init() {
    if (
      this.settingsStore &&
      this.presetsStore &&
      this.logsStore &&
      this.downloadsStore &&
      this.toolsStore
    ) {
      return;
    }
    if (this.initPromise) {
      await this.initPromise;
      return;
    }

    this.initPromise = (async () => {
      try {
        this.settingsStore = await load("settings.json", { autoSave: true, defaults: {} });
        this.presetsStore = await load("presets.json", { autoSave: true, defaults: {} });
        this.logsStore = await load("logs.json", { autoSave: true, defaults: {} });
        this.downloadsStore = await load("downloads.json", { autoSave: true, defaults: {} });
        this.toolsStore = await load("tools.json", { autoSave: true, defaults: {} });
        this.initError = null;
        console.log("Storage initialized successfully");
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.initError = message;
        console.error("Failed to initialize storage:", error);
        throw error;
      } finally {
        this.initPromise = null;
      }
    })();

    await this.initPromise;
  }

  private ensureReady() {
    if (this.initError) {
      throw new Error(`Storage initialization failed: ${this.initError}`);
    }
  }

  async getSettings<T>(): Promise<T | null> {
    if (!this.settingsStore) await this.init();
    this.ensureReady();
    return (await this.settingsStore?.get<T>("data")) || null;
  }

  async saveSettings<T>(data: T) {
    if (!this.settingsStore) await this.init();
    this.ensureReady();
    await this.settingsStore?.set("data", data);
    await this.settingsStore?.save();
  }

  async getPresets<T>(): Promise<T | null> {
    if (!this.presetsStore) await this.init();
    this.ensureReady();
    return (await this.presetsStore?.get<T>("data")) || null;
  }

  async savePresets<T>(data: T) {
    if (!this.presetsStore) await this.init();
    this.ensureReady();
    await this.presetsStore?.set("data", data);
    await this.presetsStore?.save();
  }

  async getLogs<T>(): Promise<T | null> {
    if (!this.logsStore) await this.init();
    this.ensureReady();
    return (await this.logsStore?.get<T>("data")) || null;
  }

  async saveLogs<T>(data: T) {
    if (!this.logsStore) await this.init();
    this.ensureReady();
    await this.logsStore?.set("data", data);
    await this.logsStore?.save();
  }

  async getDownloads<T>(): Promise<T | null> {
    if (!this.downloadsStore) await this.init();
    this.ensureReady();
    return (await this.downloadsStore?.get<T>("data")) || null;
  }

  async saveDownloads<T>(data: T) {
    if (!this.downloadsStore) await this.init();
    this.ensureReady();
    await this.downloadsStore?.set("data", data);
    await this.downloadsStore?.save();
  }

  async getTools<T>(): Promise<T | null> {
    if (!this.toolsStore) await this.init();
    this.ensureReady();
    return (await this.toolsStore?.get<T>("data")) || null;
  }

  async saveTools<T>(data: T) {
    if (!this.toolsStore) await this.init();
    this.ensureReady();
    await this.toolsStore?.set("data", data);
    await this.toolsStore?.save();
  }
}

export const storage = new StorageManager();
