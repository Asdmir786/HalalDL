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
}

interface DownloadsState {
  jobs: DownloadJob[];
  addJob: (url: string, presetId: string) => void;
  removeJob: (id: string) => void;
}

export const useDownloadsStore = create<DownloadsState>((set) => ({
  jobs: [], // Start empty for skeleton review
  addJob: (url, presetId) => set((state) => ({
    jobs: [
      {
        id: Math.random().toString(36).substring(7),
        url,
        status: "Queued",
        progress: 0,
        presetId,
      },
      ...state.jobs,
    ],
  })),
  removeJob: (id) => set((state) => ({
    jobs: state.jobs.filter((j) => j.id !== id),
  })),
}));
