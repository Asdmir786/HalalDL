import { create } from "zustand";

export type Screen = "downloads" | "presets" | "tools" | "logs" | "settings";

interface NavigationState {
  currentScreen: Screen;
  setScreen: (screen: Screen) => void;
}

export const useNavigationStore = create<NavigationState>((set) => ({
  currentScreen: "downloads",
  setScreen: (screen) => set({ currentScreen: screen }),
}));
