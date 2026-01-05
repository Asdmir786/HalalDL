import { create } from "zustand";

export type LogLevel = "info" | "warn" | "error" | "debug" | "command";

export interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  message: string;
  jobId?: string;
  command?: string;
}

interface LogsState {
  logs: LogEntry[];
  addLog: (log: Omit<LogEntry, "id" | "timestamp">) => void;
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
  addLog: (log) =>
    set((state) => ({
      logs: [
        ...state.logs,
        {
          ...log,
          id: Math.random().toString(36).substring(7),
          timestamp: new Date().toISOString(),
        },
      ].slice(-1000), // Keep last 1000 logs for performance
    })),
  clearLogs: () => set({ logs: [] }),
}));
