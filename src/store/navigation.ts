import { create } from "zustand";

export type Screen = "downloads" | "presets" | "tools" | "logs" | "settings";

interface NavigationState {
  currentScreen: Screen;
  sidebarCollapsed: boolean;
  setScreen: (screen: Screen) => void;
  toggleSidebar: () => void;
}

export const useNavigationStore = create<NavigationState>((set) => ({
  currentScreen: "downloads",
  sidebarCollapsed: false,
  setScreen: (screen) => set({ currentScreen: screen }),
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
}));
