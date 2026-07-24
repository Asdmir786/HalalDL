import { create } from "zustand";

export type ToolStatus = "Detected" | "Missing" | "Checking";
export type ToolMode = "Auto" | "Manual" | "Bundled";
export type ToolChannel = "stable" | "nightly";

export interface Tool {
  id: string;
  name: string;
  status: ToolStatus;
  version?: string;
  variant?: string;
  latestVersion?: string;
  updateAvailable?: boolean;
  latestCheckedAt?: number;
  path?: string;
  systemPath?: string;
  mode: ToolMode;
  channel: ToolChannel;
  required: boolean;
  hasBackup?: boolean;
  /** True when a system/PATH binary is being used instead of an app-managed copy. */
  usingFallback?: boolean;
}

interface ToolsState {
  tools: Tool[];
  updateTool: (id: string, updates: Partial<Tool>) => void;
  setTools: (tools: Tool[]) => void;
}

/** Tools that support a nightly channel */
export const NIGHTLY_CAPABLE_TOOLS = ["yt-dlp", "ffmpeg"] as const;

const INITIAL_TOOLS: Tool[] = [
  {
    id: "yt-dlp",
    name: "yt-dlp",
    // Not "Checking" — startup no longer probes tools; status is restored from storage or set on use.
    status: "Missing",
    mode: "Auto",
    channel: "stable",
    required: true,
  },
  {
    id: "ffmpeg",
    name: "FFmpeg",
    status: "Missing",
    mode: "Auto",
    channel: "stable",
    required: false,
  },
  {
    id: "aria2",
    name: "aria2",
    status: "Missing",
    mode: "Auto",
    channel: "stable",
    required: false,
  },
  {
    id: "deno",
    name: "Deno",
    status: "Missing",
    mode: "Auto",
    channel: "stable",
    required: false,
  },
];

export const useToolsStore = create<ToolsState>((set) => ({
  tools: INITIAL_TOOLS,
  updateTool: (id, updates) => set((state) => ({
    tools: state.tools.map((t) => t.id === id ? { ...t, ...updates } : t),
  })),
  setTools: (tools) => set({ tools }),
}));
