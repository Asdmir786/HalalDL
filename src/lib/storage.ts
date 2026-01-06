import { load, Store } from "@tauri-apps/plugin-store";

class StorageManager {
  private settingsStore: Store | null = null;
  private presetsStore: Store | null = null;

  async init() {
    if (this.settingsStore && this.presetsStore) return;

    try {
      this.settingsStore = await load("settings.json", { autoSave: true, defaults: {} });
      this.presetsStore = await load("presets.json", { autoSave: true, defaults: {} });
      console.log("Storage initialized successfully");
    } catch (error) {
      console.error("Failed to initialize storage:", error);
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
}

export const storage = new StorageManager();
