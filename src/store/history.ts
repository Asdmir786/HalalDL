import { create } from "zustand";

export interface HistoryEntry {
  id: string;
  url: string;
  title: string;
  thumbnail?: string;
  format?: string;
  fileSize?: number;
  outputPath?: string;
  presetId: string;
  presetName?: string;
  downloadedAt: number;
  duration?: number;
  domain: string;
  status: "completed" | "failed";
  failReason?: string;
  overrides?: { filenameTemplate?: string; format?: string; downloadDir?: string };
  isFavorite?: boolean;
  tags?: string[];
  notes?: string;
}

interface HistoryState {
  entries: HistoryEntry[];
  setEntries: (entries: HistoryEntry[]) => void;
  addEntry: (entry: HistoryEntry) => void;
  removeEntry: (id: string) => void;
  toggleFavorite: (id: string) => void;
  addTag: (id: string, tag: string) => void;
  removeTag: (id: string, tag: string) => void;
  updateNote: (id: string, note: string) => void;
  clearHistory: () => void;
  findByUrl: (url: string) => HistoryEntry[];
  trimToRetention: (limit: number) => void;
}

export function extractDomain(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    return hostname.replace(/^www\./, "");
  } catch {
    return "unknown";
  }
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  entries: [],
  setEntries: (entries) => set({ entries }),
  addEntry: (entry) =>
    set((state) => ({ entries: [entry, ...state.entries] })),
  removeEntry: (id) =>
    set((state) => ({ entries: state.entries.filter((e) => e.id !== id) })),
  toggleFavorite: (id) =>
    set((state) => ({
      entries: state.entries.map((e) =>
        e.id === id ? { ...e, isFavorite: !e.isFavorite } : e
      ),
    })),
  addTag: (id, tag) =>
    set((state) => ({
      entries: state.entries.map((e) =>
        e.id === id ? { ...e, tags: [...(e.tags || []), tag] } : e
      ),
    })),
  removeTag: (id, tag) =>
    set((state) => ({
      entries: state.entries.map((e) =>
        e.id === id
          ? { ...e, tags: (e.tags || []).filter((t) => t !== tag) }
          : e
      ),
    })),
  updateNote: (id, note) =>
    set((state) => ({
      entries: state.entries.map((e) =>
        e.id === id ? { ...e, notes: note } : e
      ),
    })),
  clearHistory: () => set({ entries: [] }),
  findByUrl: (url) => get().entries.filter((e) => e.url === url),
  trimToRetention: (limit) => {
    if (limit <= 0) return;
    set((state) => {
      if (state.entries.length <= limit) return state;
      return { entries: state.entries.slice(0, limit) };
    });
  },
}));
