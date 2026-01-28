class StorageManager {
  private settingsStore: StoreLike | null = null;
  private presetsStore: StoreLike | null = null;
  private logsStore: StoreLike | null = null;
  private downloadsStore: StoreLike | null = null;

  private initPromise: Promise<void> | null = null;
  private initFailed = false;

  private isTauri() {
    if (typeof window === "undefined") return false;
    const w = window as unknown as Record<string, unknown>;
    return Boolean(w.__TAURI_INTERNALS__ || w.__TAURI__);
  }

  async init() {
    if (
      this.settingsStore &&
      this.presetsStore &&
      this.logsStore &&
      this.downloadsStore
    )
      return;

    if (this.initFailed) return;

    if (!this.initPromise) {
      this.initPromise = (async () => {
        if (this.isTauri()) {
          const { load } = await import("@tauri-apps/plugin-store");
          this.settingsStore = await load("settings.json", {
            autoSave: true,
            defaults: {},
          });
          this.presetsStore = await load("presets.json", {
            autoSave: true,
            defaults: {},
          });
          this.logsStore = await load("logs.json", {
            autoSave: true,
            defaults: {},
          });
          this.downloadsStore = await load("downloads.json", {
            autoSave: true,
            defaults: {},
          });
          return;
        }

        this.settingsStore = new LocalStorageStore("settings.json");
        this.presetsStore = new LocalStorageStore("presets.json");
        this.logsStore = new LocalStorageStore("logs.json");
        this.downloadsStore = new LocalStorageStore("downloads.json");
      })().catch((error) => {
        this.initFailed = true;
        console.error("Failed to initialize storage:", error);
      });
    }

    await this.initPromise;
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

type StoreLike = {
  get<T>(key: string): Promise<T | null | undefined>;
  set<T>(key: string, value: T): Promise<void>;
  save(): Promise<void>;
};

class LocalStorageStore implements StoreLike {
  private readonly storageKey: string;
  private state: Record<string, unknown>;

  constructor(filename: string) {
    this.storageKey = `halaldl:store:${filename}`;
    this.state = {};
    this.loadFromLocalStorage();
  }

  private loadFromLocalStorage() {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        this.state = parsed as Record<string, unknown>;
      }
    } catch {
      this.state = {};
    }
  }

  async get<T>(key: string): Promise<T | null> {
    const value = this.state[key];
    return (value as T) ?? null;
  }

  async set<T>(key: string, value: T): Promise<void> {
    this.state[key] = value as unknown;
  }

  async save(): Promise<void> {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.state));
    } catch {
      void 0;
    }
  }
}
