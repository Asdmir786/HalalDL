import { create } from "zustand";
import { createId } from "@/lib/id";
import type { Collection, SourceActivity, SourceRule, Watchlist } from "@/lib/library-types";

interface LibraryState {
  watchlists: Watchlist[];
  collections: Collection[];
  rules: SourceRule[];
  activity: SourceActivity[];
  setWatchlists: (value: Watchlist[]) => void;
  setCollections: (value: Collection[]) => void;
  setRules: (value: SourceRule[]) => void;
  addWatchlist: (value: Omit<Watchlist, "id">) => string;
  updateWatchlist: (id: string, value: Partial<Watchlist>) => void;
  removeWatchlist: (id: string) => void;
  addCollection: (value: Omit<Collection, "id" | "createdAt">) => string;
  updateCollection: (id: string, value: Partial<Collection>) => void;
  removeCollection: (id: string) => void;
  addRule: (value: Omit<SourceRule, "id" | "priority">) => string;
  updateRule: (id: string, value: Partial<SourceRule>) => void;
  removeRule: (id: string) => void;
  addActivity: (value: Omit<SourceActivity, "id" | "createdAt">) => void;
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  watchlists: [], collections: [], rules: [], activity: [],
  setWatchlists: (watchlists) => set({ watchlists }),
  setCollections: (collections) => set({ collections }),
  setRules: (rules) => set({ rules }),
  addWatchlist: (value) => { const id = createId(); set((s) => ({ watchlists: [...s.watchlists, { ...value, id }] })); return id; },
  updateWatchlist: (id, value) => set((s) => ({ watchlists: s.watchlists.map((v) => v.id === id ? { ...v, ...value } : v) })),
  removeWatchlist: (id) => set((s) => ({ watchlists: s.watchlists.filter((v) => v.id !== id) })),
  addCollection: (value) => { const id = createId(); set((s) => ({ collections: [...s.collections, { ...value, id, createdAt: Date.now() }] })); return id; },
  updateCollection: (id, value) => set((s) => ({ collections: s.collections.map((v) => v.id === id ? { ...v, ...value } : v) })),
  removeCollection: (id) => set((s) => ({ collections: s.collections.filter((v) => v.id !== id) })),
  addRule: (value) => { const id = createId(); const priority = Math.max(0, ...get().rules.map((r) => r.priority)) + 1; set((s) => ({ rules: [...s.rules, { ...value, id, priority }] })); return id; },
  updateRule: (id, value) => set((s) => ({ rules: s.rules.map((v) => v.id === id ? { ...v, ...value } : v) })),
  removeRule: (id) => set((s) => ({ rules: s.rules.filter((v) => v.id !== id) })),
  addActivity: (value) => set((s) => ({ activity: [{ ...value, id: createId(), createdAt: Date.now() }, ...s.activity].slice(0, 120) })),
}));
