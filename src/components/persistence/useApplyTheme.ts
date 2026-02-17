import { useEffect } from "react";
import { useSettingsStore } from "@/store/settings";

export function useApplyTheme() {
  const theme = useSettingsStore((s) => s.settings.theme);

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
}
