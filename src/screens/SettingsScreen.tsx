import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { downloadDir } from "@tauri-apps/api/path";
import {
  DEFAULT_SETTINGS,
  SETTINGS_KEYS,
  type Settings,
  useSettingsStore,
  Theme,
} from "@/store/settings";
import { FadeInStagger } from "@/components/motion/StaggerContainer";

// Import Components
import { SettingsHeader } from "./settings/components/SettingsHeader";
import { AppearanceSection } from "./settings/components/AppearanceSection";
import { StorageSection } from "./settings/components/StorageSection";
import { BehaviorSection } from "./settings/components/BehaviorSection";
import { EngineSection } from "./settings/components/EngineSection";

const SETTINGS_KEY_SET = new Set(SETTINGS_KEYS as unknown as string[]);

const pickKnownSettings = (value: unknown): Settings => {
  const source = (value ?? {}) as Record<string, unknown>;
  const next: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const key of SETTINGS_KEYS) {
    const v = source[key as string];
    if (typeof v !== "undefined") next[key as string] = v;
  }
  return next as unknown as Settings;
};

const resolveDefaultSettings = async (): Promise<Settings> => {
  const next: Settings = { ...DEFAULT_SETTINGS };
  try {
    next.defaultDownloadDir = await downloadDir();
  } catch {
    next.defaultDownloadDir = DEFAULT_SETTINGS.defaultDownloadDir;
  }
  return next;
};

export function SettingsScreen() {
  const { settings, setSettings } = useSettingsStore();

  const savedSettings = useMemo(() => pickKnownSettings(settings), [settings]);
  const [edits, setEdits] = useState<Partial<Settings>>({});
  const draftSettings = useMemo(
    () => ({ ...savedSettings, ...edits }),
    [edits, savedSettings]
  );

  const [resolvedDefaults, setResolvedDefaults] = useState<Settings | null>(null);

  useEffect(() => {
    let mounted = true;
    resolveDefaultSettings()
      .then((defaults) => {
        if (mounted) setResolvedDefaults(defaults);
      })
      .catch(() => {
        if (mounted) setResolvedDefaults(DEFAULT_SETTINGS);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const hasExtraSavedKeys = useMemo(() => {
    const raw = settings as unknown as Record<string, unknown>;
    return Object.keys(raw).some((k) => !SETTINGS_KEY_SET.has(k));
  }, [settings]);

  const isDirty = useMemo(() => {
    return SETTINGS_KEYS.some((k) => !Object.is(draftSettings[k], savedSettings[k]));
  }, [draftSettings, savedSettings]);

  const isGlobalDirty = useMemo(() => {
    if (hasExtraSavedKeys) return true;
    if (!resolvedDefaults) return false;
    return SETTINGS_KEYS.some((k) => {
      const current = savedSettings[k];
      const initial = resolvedDefaults[k];
      // Special handling for arrays or objects if needed, but settings are mostly primitives
      return !Object.is(current, initial);
    });
  }, [hasExtraSavedKeys, resolvedDefaults, savedSettings]);

  const setDraftValue = useCallback(
    <K extends keyof Settings>(key: K, value: Settings[K]) => {
      setEdits((prev) => {
        const next = { ...prev } as Partial<Settings>;
        if (Object.is(value, savedSettings[key])) {
          delete (next as Record<string, unknown>)[key as string];
        } else {
          (next as Record<string, unknown>)[key as string] = value;
        }
        return next;
      });
    },
    [savedSettings]
  );

  const applyTheme = useCallback((theme: Theme) => {
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");

    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
      root.classList.add(systemTheme);
    } else {
      root.classList.add(theme);
    }
  }, []);

  useEffect(() => {
    applyTheme(draftSettings.theme);
    return () => applyTheme(savedSettings.theme);
  }, [applyTheme, draftSettings.theme, savedSettings.theme]);

  const handleSave = useCallback(() => {
    if (!isDirty) return;
    setSettings({ ...(settings as unknown as Record<string, unknown>), ...draftSettings } as unknown as Settings);
    setEdits({});
    toast.success("Settings saved successfully");
  }, [draftSettings, isDirty, setSettings, settings]);

  const [isResetting, setIsResetting] = useState(false);

  const handleGlobalReset = useCallback(async () => {
    setIsResetting(true);
    try {
      const defaults = resolvedDefaults ?? (await resolveDefaultSettings());
      
      // Calculate what changed
      const changedKeys: string[] = [];
      for (const key of SETTINGS_KEYS) {
          if (!Object.is(settings[key], defaults[key])) {
              // Convert camelCase to readable format
              const readable = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
              changedKeys.push(readable);
          }
      }

      setSettings(defaults);
      setEdits({});
      
      if (changedKeys.length > 0) {
          toast.info("Settings restored to defaults", {
              description: `Reset: ${changedKeys.join(", ")}`
          });
      } else {
          toast.info("Settings restored to defaults", {
              description: "No changes were needed."
          });
      }
    } finally {
      setIsResetting(false);
    }
  }, [resolvedDefaults, setSettings, settings]);

  const setDraftFromSettings = useCallback(
    (nextDraft: Settings) => {
      setEdits(() => {
        const next: Partial<Settings> = {};
        for (const k of SETTINGS_KEYS) {
          if (!Object.is(nextDraft[k], savedSettings[k])) {
            (next as Record<string, unknown>)[k as string] = nextDraft[k];
          }
        }
        return next;
      });
    },
    [savedSettings]
  );

  const resetAllDraft = useCallback(async () => {
    const defaults = await resolveDefaultSettings();
    setDraftFromSettings(defaults);
    toast.info("Settings reset to defaults");
  }, [setDraftFromSettings]);

  const resetGroupDraft = useCallback(
    async (group: "appearance" | "storage" | "behavior" | "downloadEngine") => {
      const defaults = group === "storage" ? await resolveDefaultSettings() : DEFAULT_SETTINGS;
      const partial: Partial<Settings> =
        group === "appearance"
          ? { theme: defaults.theme }
          : group === "storage"
          ? { defaultDownloadDir: defaults.defaultDownloadDir, tempDir: defaults.tempDir }
          : group === "behavior"
          ? { notifications: defaults.notifications, autoClearFinished: defaults.autoClearFinished }
          : {
              maxConcurrency: defaults.maxConcurrency,
              maxRetries: defaults.maxRetries,
              maxSpeed: defaults.maxSpeed,
              fileCollision: defaults.fileCollision,
            };

      setDraftFromSettings({ ...draftSettings, ...partial });
      toast.info("Settings reset to defaults");
    },
    [draftSettings, setDraftFromSettings]
  );

  return (
    <div className="flex flex-col h-full bg-background max-w-6xl mx-auto w-full" role="main">
      <FadeInStagger className="flex flex-col h-full">
        <div className="p-8 pb-6 flex flex-col gap-6">
          <SettingsHeader
            isGlobalDirty={isGlobalDirty}
            isDirty={isDirty}
            isResetting={isResetting}
            onGlobalReset={handleGlobalReset}
            onResetAll={resetAllDraft}
            onResetGroup={resetGroupDraft}
            onSave={handleSave}
          />
        </div>

        <div className="flex-1 overflow-auto px-8 pb-8">
          <div className="grid gap-6">
            <AppearanceSection
              theme={draftSettings.theme}
              onThemeChange={(v) => setDraftValue("theme", v)}
            />

            <StorageSection
              defaultDownloadDir={draftSettings.defaultDownloadDir || ""}
              onDirectoryChange={(v) => setDraftValue("defaultDownloadDir", v)}
            />

            <BehaviorSection
              notifications={draftSettings.notifications}
              onNotificationsChange={(v) => setDraftValue("notifications", v)}
              autoClearFinished={draftSettings.autoClearFinished}
              onAutoClearChange={(v) => setDraftValue("autoClearFinished", v)}
              autoCopyFile={draftSettings.autoCopyFile}
              onAutoCopyChange={(v) => setDraftValue("autoCopyFile", v)}
              paranoidMode={draftSettings.paranoidMode}
              onParanoidModeChange={(v) => setDraftValue("paranoidMode", v)}
              maxConcurrency={draftSettings.maxConcurrency}
              onMaxConcurrencyChange={(v) => setDraftValue("maxConcurrency", v)}
              fileCollision={draftSettings.fileCollision}
              onFileCollisionChange={(v) => setDraftValue("fileCollision", v)}
            />

            <EngineSection
              maxConcurrency={draftSettings.maxConcurrency}
              onMaxConcurrencyChange={(v) => setDraftValue("maxConcurrency", v)}
              maxRetries={draftSettings.maxRetries}
              onMaxRetriesChange={(v) => setDraftValue("maxRetries", v)}
              maxSpeed={draftSettings.maxSpeed}
              onMaxSpeedChange={(v) => setDraftValue("maxSpeed", v)}
            />
          </div>
        </div>
      </FadeInStagger>
    </div>
  );
}
