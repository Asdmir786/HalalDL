import { create } from "zustand";

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
  removeJob: (id: string) => void;
  updateJob: (id: string, updates: Partial<DownloadJob>) => void;
}

export const useDownloadsStore = create<DownloadsState>((set) => ({
  jobs: [], // Start empty for skeleton review
  pendingUrl: undefined,
  setPendingUrl: (url) => set({ pendingUrl: url }),
  addJob: (url, presetId, overrides) => {
    const id = Math.random().toString(36).substring(7);
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
        },
        ...state.jobs,
      ],
    }));
    return id;
  },
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
