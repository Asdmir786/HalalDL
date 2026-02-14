import { create } from "zustand";

export type ToolStatus = "Detected" | "Missing" | "Checking";
export type ToolMode = "Auto" | "Manual" | "Bundled";

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
  mode: ToolMode;
  required: boolean;
}

interface ToolsState {
  tools: Tool[];
  discoveredToolId: string | null;
  updateTool: (id: string, updates: Partial<Tool>) => void;
  setTools: (tools: Tool[]) => void;
  setDiscoveredToolId: (id: string | null) => void;
}

const INITIAL_TOOLS: Tool[] = [
  {
    id: "yt-dlp",
    name: "yt-dlp",
    status: "Checking",
    mode: "Auto",
    required: true,
  },
  {
    id: "ffmpeg",
    name: "FFmpeg",
    status: "Checking",
    mode: "Auto",
    required: false,
  },
  {
    id: "aria2",
    name: "aria2",
    status: "Checking",
    mode: "Auto",
    required: false,
  },
  {
    id: "deno",
    name: "Deno",
    status: "Checking",
    mode: "Auto",
    required: false,
  },
];

export const useToolsStore = create<ToolsState>((set) => ({
  tools: INITIAL_TOOLS,
  discoveredToolId: null,
  updateTool: (id, updates) => set((state) => ({
    tools: state.tools.map((t) => t.id === id ? { ...t, ...updates } : t),
  })),
  setTools: (tools) => set({ tools }),
  setDiscoveredToolId: (id) => set({ discoveredToolId: id }),
}));
