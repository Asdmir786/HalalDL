import { useEffect } from "react";
import { useSettingsStore } from "@/store/settings";
import { ACCENT_COLORS } from "@/store/settings";

const ACCENT_CLASSES = ACCENT_COLORS.map((c) => `accent-${c.id}`).filter((c) => c !== "accent-default");

export function useApplyTheme() {
  const theme = useSettingsStore((s) => s.settings.theme);
  const accentColor = useSettingsStore((s) => s.settings.accentColor);

  useEffect(() => {
    const root = window.document.documentElement;

    const apply = () => {
      root.classList.remove("light", "dark");

      if (theme === "system") {
        const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
        root.classList.add(systemTheme);
      } else {
        root.classList.add(theme);
      }
    };

    apply();

    if (theme === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      mq.addEventListener("change", apply);
      return () => mq.removeEventListener("change", apply);
    }
  }, [theme]);

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove(...ACCENT_CLASSES);
    if (accentColor && accentColor !== "default") {
      root.classList.add(`accent-${accentColor}`);
    }
  }, [accentColor]);
}
