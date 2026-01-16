import { create } from "zustand";
import { storage } from "@/lib/storage";

export type LogLevel = "info" | "warn" | "error" | "debug" | "command";
export type LogsLoadStatus = "idle" | "loading" | "ready" | "error";

export interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  message: string;
  jobId?: string;
  command?: string;
}

export interface LogsState {
  logs: LogEntry[];
  loadStatus: LogsLoadStatus;
  loadError?: string;
  activeJobId?: string;
  addLog: (log: Omit<LogEntry, "id" | "timestamp">) => void;
  setActiveJobId: (jobId: string | undefined) => void;
  setLogs: (logs: LogEntry[]) => void;
  loadLogs: () => Promise<void>;
  clearLogs: () => void;
}

export const useLogsStore = create<LogsState>((set) => ({
  logs: [
    {
      id: "1",
      timestamp: new Date().toISOString(),
      level: "info",
      message: "Application started",
    },
    {
      id: "2",
      timestamp: new Date().toISOString(),
      level: "command",
      message: "Checking for yt-dlp binary...",
      command: "yt-dlp --version",
    },
    {
      id: "3",
      timestamp: new Date().toISOString(),
      level: "info",
      message: "yt-dlp version 2025.01.15 detected at C:\\Users\\halal\\AppData\\Local\\yt-dlp.exe",
    },
  ],
  loadStatus: "idle",
  loadError: undefined,
  activeJobId: undefined,
  addLog: (log) =>
    set((state) => {
      const newLog = {
        ...log,
        id: Math.random().toString(36).substring(7),
        timestamp: new Date().toISOString(),
      };
      // Optimization: Avoid full array copy if possible, but for Zustand immutability we need a new reference.
      // However, we can optimize by slicing first if needed.
      const currentLogs = state.logs;
      const nextLogs = currentLogs.length >= 1000 
        ? [...currentLogs.slice(1), newLog]
        : [...currentLogs, newLog];
      
      return { logs: nextLogs };
    }),
  setActiveJobId: (jobId) => set({ activeJobId: jobId }),
  setLogs: (logs) => set({ logs }),
  loadLogs: async () => {
    set({ loadStatus: "loading", loadError: undefined });
    try {
      console.debug("[logs] loadLogs:start");
      const savedLogs = await storage.getLogs<LogEntry[]>();
      if (savedLogs && Array.isArray(savedLogs)) {
        set({ logs: savedLogs.slice(-1000), loadStatus: "ready" });
      } else {
        set({ loadStatus: "ready" });
      }
      console.debug("[logs] loadLogs:done");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("[logs] loadLogs:error", error);
      set({ loadStatus: "error", loadError: message });
    }
  },
  clearLogs: () => set({ logs: [] }),
}));
