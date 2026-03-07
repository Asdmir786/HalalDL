import { create } from "zustand";
import { createId } from "@/lib/id";

export type JobStatus = "Queued" | "Downloading" | "Post-processing" | "Done" | "Failed";
export type DownloadPhase =
  | "Resolving formats"
  | "Downloading streams"
  | "Merging streams"
  | "Converting with FFmpeg"
  | "Generating thumbnail";
export type ThumbnailStatus = "pending" | "generating" | "ready" | "failed";

export interface DownloadJob {
  id: string;
  url: string;
  title?: string;
  thumbnail?: string;
  progress: number;
  speed?: string;
  eta?: string;
  status: JobStatus;
  phase?: DownloadPhase;
  statusDetail?: string;
  presetId: string;
  outputPath?: string;
  createdAt: number;
  statusChangedAt?: number;
  queueOrder?: number;
  overrides?: {
    filenameTemplate?: string;
    format?: string;
    downloadDir?: string;
  };
  thumbnailStatus?: ThumbnailStatus;
  thumbnailError?: string;
  fallbackUsed?: boolean;
  fallbackFormat?: string;
}

interface DownloadsState {
  jobs: DownloadJob[];
  pendingUrl?: string;
  setPendingUrl: (url: string | undefined) => void;
  addJob: (url: string, presetId: string, overrides?: DownloadJob["overrides"]) => string;
  moveJob: (id: string, direction: "up" | "down") => void;
  reorderQueued: (orderedIds: string[]) => void;
  removeJob: (id: string) => void;
  updateJob: (id: string, updates: Partial<DownloadJob>) => void;
}

export const useDownloadsStore = create<DownloadsState>((set) => ({
  jobs: [], // Start empty for skeleton review
  pendingUrl: undefined,
  setPendingUrl: (url) => set({ pendingUrl: url }),
  addJob: (url, presetId, overrides) => {
    const id = createId();
    const now = Date.now();
    set((state) => ({
      jobs: [
        {
          id,
          url,
          status: "Queued",
          progress: 0,
          phase: "Resolving formats",
          statusDetail: "Waiting to start",
          thumbnailStatus: "pending",
          fallbackUsed: false,
          fallbackFormat: undefined,
          presetId,
          overrides,
          createdAt: now,
          statusChangedAt: now,
          queueOrder: now,
        },
        ...state.jobs,
      ],
    }));
    return id;
  },
  moveJob: (id, direction) =>
    set((state) => {
      const job = state.jobs.find((j) => j.id === id);
      if (!job || job.status !== "Queued") return state;

      const queued = state.jobs
        .filter((j) => j.status === "Queued")
        .map((j) => ({ ...j, queueOrder: typeof j.queueOrder === "number" ? j.queueOrder : j.createdAt }));

      queued.sort((a, b) => (b.queueOrder || 0) - (a.queueOrder || 0));
      const idx = queued.findIndex((j) => j.id === id);
      if (idx === -1) return state;
      const target = direction === "up" ? idx - 1 : idx + 1;
      if (target < 0 || target >= queued.length) return state;

      const a = queued[idx];
      const b = queued[target];
      const aOrder = typeof a.queueOrder === "number" ? a.queueOrder : a.createdAt;
      const bOrder = typeof b.queueOrder === "number" ? b.queueOrder : b.createdAt;

      return {
        jobs: state.jobs.map((j) => {
          if (j.id === a.id) return { ...j, queueOrder: bOrder };
          if (j.id === b.id) return { ...j, queueOrder: aOrder };
          return j;
        }),
      };
    }),
  reorderQueued: (orderedIds) =>
    set((state) => {
      const setIds = new Set(orderedIds);
      const queuedAll = state.jobs
        .filter((j) => j.status === "Queued")
        .map((j) => ({ ...j, queueOrder: typeof j.queueOrder === "number" ? j.queueOrder : j.createdAt }))
        .sort((a, b) => (b.queueOrder || 0) - (a.queueOrder || 0));

      const selected = queuedAll.filter((j) => setIds.has(j.id));
      if (selected.length !== orderedIds.length) return state;

      const orders = selected
        .map((j) => (typeof j.queueOrder === "number" ? j.queueOrder : j.createdAt))
        .sort((a, b) => b - a);

      const nextOrderById = new Map<string, number>();
      orderedIds.forEach((id, i) => {
        nextOrderById.set(id, orders[i] ?? Date.now() - i);
      });

      return {
        jobs: state.jobs.map((j) => {
          const next = nextOrderById.get(j.id);
          if (typeof next === "number") return { ...j, queueOrder: next };
          return j;
        }),
      };
    }),
  removeJob: (id) => set((state) => ({
    jobs: state.jobs.filter((j) => j.id !== id),
  })),
  updateJob: (id, updates) => set((state) => ({
    jobs: state.jobs.map((j) => {
      if (j.id !== id) return j;
      const statusWillChange = typeof updates.status !== "undefined" && updates.status !== j.status;
      return {
        ...j,
        ...updates,
        ...(statusWillChange
          ? { statusChangedAt: typeof updates.statusChangedAt === "number" ? updates.statusChangedAt : Date.now() }
          : {}),
      };
    }),
  })),
}));
