import { create } from "zustand";

export type JobStatus = "Queued" | "Downloading" | "Post-processing" | "Done" | "Failed";

export interface DownloadJob {
  id: string;
  url: string;
  title?: string;
  progress: number;
  speed?: string;
  eta?: string;
  status: JobStatus;
  presetId: string;
  outputPath?: string;
  overrides?: {
    filenameTemplate?: string;
    format?: string;
    downloadDir?: string;
  };
}

interface DownloadsState {
  jobs: DownloadJob[];
  addJob: (url: string, presetId: string, overrides?: DownloadJob["overrides"]) => string;
  removeJob: (id: string) => void;
  updateJob: (id: string, updates: Partial<DownloadJob>) => void;
}

export const useDownloadsStore = create<DownloadsState>((set) => ({
  jobs: [], // Start empty for skeleton review
  addJob: (url, presetId, overrides) => {
    const id = Math.random().toString(36).substring(7);
    set((state) => ({
      jobs: [
        {
          id,
          url,
          status: "Queued",
          progress: 0,
          presetId,
          overrides,
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
    jobs: state.jobs.map((j) => (j.id === id ? { ...j, ...updates } : j)),
  })),
}));
