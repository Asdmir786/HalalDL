import { getStateFilePath } from "@/lib/app-paths";
import { readTextFile, writeTextFile } from "@/lib/commands";

const FILE_NAMES = {
  settings: "settings.json",
  presets: "presets.json",
  logs: "logs.json",
  downloads: "downloads.json",
  tools: "tools.json",
  history: "history.json",
  runtimeFlags: "runtime-flags.json",
} as const;

class StorageManager {
  private initPromise: Promise<void> | null = null;
  private initError: string | null = null;
  private filePaths: Record<keyof typeof FILE_NAMES, string> | null = null;

  async init() {
    if (this.filePaths) return;
    if (this.initPromise) {
      await this.initPromise;
      return;
    }

    this.initPromise = (async () => {
      try {
        this.filePaths = {
          settings: await getStateFilePath(FILE_NAMES.settings),
          presets: await getStateFilePath(FILE_NAMES.presets),
          logs: await getStateFilePath(FILE_NAMES.logs),
          downloads: await getStateFilePath(FILE_NAMES.downloads),
          tools: await getStateFilePath(FILE_NAMES.tools),
          history: await getStateFilePath(FILE_NAMES.history),
          runtimeFlags: await getStateFilePath(FILE_NAMES.runtimeFlags),
        };
        this.initError = null;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.initError = message;
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
    if (!this.filePaths) {
      throw new Error("Storage paths are unavailable");
    }
  }

  private async readJson<T>(key: keyof typeof FILE_NAMES): Promise<T | null> {
    if (!this.filePaths) await this.init();
    this.ensureReady();

    try {
      const raw = await readTextFile(this.filePaths![key]);
      if (!raw.trim()) return null;
      return JSON.parse(raw) as T;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.toLowerCase().includes("failed to read file")) {
        return null;
      }
      throw error;
    }
  }

  private async writeJson<T>(key: keyof typeof FILE_NAMES, data: T) {
    if (!this.filePaths) await this.init();
    this.ensureReady();
    await writeTextFile(this.filePaths![key], JSON.stringify(data, null, 2));
  }

  async getSettings<T>(): Promise<T | null> {
    return this.readJson<T>("settings");
  }

  async saveSettings<T>(data: T) {
    await this.writeJson("settings", data);
  }

  async getPresets<T>(): Promise<T | null> {
    return this.readJson<T>("presets");
  }

  async savePresets<T>(data: T) {
    await this.writeJson("presets", data);
  }

  async getLogs<T>(): Promise<T | null> {
    return this.readJson<T>("logs");
  }

  async saveLogs<T>(data: T) {
    await this.writeJson("logs", data);
  }

  async getDownloads<T>(): Promise<T | null> {
    return this.readJson<T>("downloads");
  }

  async saveDownloads<T>(data: T) {
    await this.writeJson("downloads", data);
  }

  async getTools<T>(): Promise<T | null> {
    return this.readJson<T>("tools");
  }

  async saveTools<T>(data: T) {
    await this.writeJson("tools", data);
  }

  async getHistory<T>(): Promise<T | null> {
    return this.readJson<T>("history");
  }

  async saveHistory<T>(data: T) {
    await this.writeJson("history", data);
  }

  async getRuntimeFlags<T>(): Promise<T | null> {
    return this.readJson<T>("runtimeFlags");
  }

  async saveRuntimeFlags<T>(data: T) {
    await this.writeJson("runtimeFlags", data);
  }
}

export const storage = new StorageManager();
