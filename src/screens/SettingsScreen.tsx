import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type UIEvent } from "react";
import { toast } from "sonner";
import { downloadDir } from "@tauri-apps/api/path";
import {
  DEFAULT_SETTINGS,
  SETTINGS_KEYS,
  ACCENT_COLORS,
  type Settings,
  type AccentColor,
  useSettingsStore,
  Theme,
} from "@/store/settings";

import { SettingsHeader } from "./settings/components/SettingsHeader";
import { SettingsNav } from "./settings/components/SettingsNav";
import { SaveBar } from "./settings/components/SaveBar";
import { AppearanceSection } from "./settings/components/AppearanceSection";
import { StorageSection } from "./settings/components/StorageSection";
import { BehaviorSection } from "./settings/components/BehaviorSection";
import { EngineSection } from "./settings/components/EngineSection";
import { AboutSection } from "./settings/components/AboutSection";
import { usePresetsStore } from "@/store/presets";
import { getQuickEligiblePresets } from "@/lib/preset-display";
import { storage } from "@/lib/storage";
import { useLogsStore } from "@/store/logs";

const SETTINGS_KEY_SET = new Set(SETTINGS_KEYS as unknown as string[]);
const ACCENT_CLASSES = ACCENT_COLORS.map((c) => `accent-${c.id}`).filter((c) => c !== "accent-default");

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
  const addLog = useLogsStore((state) => state.addLog);
  const presets = usePresetsStore((state) => state.presets);
  const quickPresetOptions = useMemo(
    () => getQuickEligiblePresets(presets).map((preset) => ({ id: preset.id, name: preset.name })),
    [presets]
  );
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollTopRef = useRef(0);

  const savedSettings = useMemo(() => pickKnownSettings(settings), [settings]);
  const [edits, setEdits] = useState<Partial<Settings>>({});
  const draftSettings = useMemo(
    () => ({ ...savedSettings, ...edits }),
    [edits, savedSettings]
  );

  const [resolvedDefaults, setResolvedDefaults] = useState<Settings | null>(null);
  const latestDraftRef = useRef(draftSettings);
  const latestDirtyRef = useRef(false);
  const commitSettingsRef = useRef<(nextDraft: Settings, showToast?: boolean) => void>(() => {
    void 0;
  });

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

  const commitSettings = useCallback(
    (nextDraft: Settings, showToast = false) => {
      const committed = {
        ...(useSettingsStore.getState().settings as unknown as Record<string, unknown>),
        ...pickKnownSettings(nextDraft),
      } as unknown as Settings;

      setSettings(committed);
      setEdits({});
      void storage.saveSettings(committed).catch((e) => {
        addLog({
          level: "error",
          message: `Failed to save settings: ${String(e)}`,
        });
      });

      if (showToast) {
        toast.success("Settings saved successfully");
      }
    },
    [addLog, setSettings]
  );

  useEffect(() => {
    latestDraftRef.current = draftSettings;
    latestDirtyRef.current = isDirty;
  }, [draftSettings, isDirty]);

  useEffect(() => {
    commitSettingsRef.current = commitSettings;
  }, [commitSettings]);

  useEffect(() => {
    if (!isDirty) return;
    const timer = window.setTimeout(() => {
      commitSettings(draftSettings);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [commitSettings, draftSettings, isDirty]);

  useEffect(
    () => () => {
      if (!latestDirtyRef.current) return;
      commitSettingsRef.current(latestDraftRef.current);
    },
    []
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

  const applyAccent = useCallback((accent: AccentColor) => {
    const root = window.document.documentElement;
    root.classList.remove(...ACCENT_CLASSES);
    if (accent && accent !== "default") {
      root.classList.add(`accent-${accent}`);
    }
  }, []);

  useEffect(() => {
    applyTheme(draftSettings.theme);
    return () => applyTheme(savedSettings.theme);
  }, [applyTheme, draftSettings.theme, savedSettings.theme]);

  useEffect(() => {
    applyAccent(draftSettings.accentColor);
    return () => applyAccent(savedSettings.accentColor);
  }, [applyAccent, draftSettings.accentColor, savedSettings.accentColor]);

  const handleSave = useCallback(() => {
    if (!isDirty) return;
    commitSettings(draftSettings, true);
  }, [commitSettings, draftSettings, isDirty]);

  const [isResetting, setIsResetting] = useState(false);

  const handleGlobalReset = useCallback(async () => {
    setIsResetting(true);
    try {
      const defaults = resolvedDefaults ?? (await resolveDefaultSettings());

      const changedKeys: string[] = [];
      for (const key of SETTINGS_KEYS) {
        if (!Object.is(settings[key], defaults[key])) {
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
          ? { theme: defaults.theme, accentColor: defaults.accentColor }
          : group === "storage"
          ? {
              defaultDownloadDir: defaults.defaultDownloadDir,
              tempDir: defaults.tempDir,
              skipDownloadedBefore: defaults.skipDownloadedBefore,
              saveMetadataFiles: defaults.saveMetadataFiles,
              generateThumbnailContactSheets: defaults.generateThumbnailContactSheets,
            }
          : group === "behavior"
          ? {
              notifications: defaults.notifications,
              autoClearFinished: defaults.autoClearFinished,
              autoCopyFile: defaults.autoCopyFile,
              autoPasteLinks: defaults.autoPasteLinks,
              preferredSubtitleLanguages: defaults.preferredSubtitleLanguages,
              closeToTray: defaults.closeToTray,
              launchAtLogin: defaults.launchAtLogin,
              startMinimizedToTray: defaults.startMinimizedToTray,
              trayLeftClickAction: defaults.trayLeftClickAction,
              trayDoubleClickAction: defaults.trayDoubleClickAction,
              trayMenuShowHideItem: defaults.trayMenuShowHideItem,
              enableBackgroundUpdateChecks: defaults.enableBackgroundUpdateChecks,
              checkToolUpdatesInBackground: defaults.checkToolUpdatesInBackground,
              checkAppUpdatesInBackground: defaults.checkAppUpdatesInBackground,
              quickDefaultPreset: defaults.quickDefaultPreset,
              quickActionBehavior: defaults.quickActionBehavior,
              quickDownloadStartMode: defaults.quickDownloadStartMode,
              quickDownloadDestinationMode: defaults.quickDownloadDestinationMode,
              fileCollision: defaults.fileCollision,
              historyRetention: defaults.historyRetention,
            }
          : {
              maxConcurrency: defaults.maxConcurrency,
              maxRetries: defaults.maxRetries,
              maxSpeed: defaults.maxSpeed,
            };

      setDraftFromSettings({ ...draftSettings, ...partial });
      toast.info("Settings reset to defaults");
    },
    [draftSettings, setDraftFromSettings]
  );

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = scrollTopRef.current;
  });

  const handleScroll = (event: UIEvent<HTMLDivElement>) => {
    scrollTopRef.current = event.currentTarget.scrollTop;
  };

  return (
    <div className="relative flex h-full w-full max-w-6xl flex-col bg-background mx-auto" role="main">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 sm:px-6 sm:pt-6 md:px-8 md:pb-4">
        <SettingsHeader
          isGlobalDirty={isGlobalDirty}
          isResetting={isResetting}
          onGlobalReset={handleGlobalReset}
        />
      </div>

      {/* Mobile nav pills */}
      <div className="px-4 md:hidden sm:px-6">
        <SettingsNav scrollContainerRef={scrollRef} />
      </div>

      {/* Two-column layout */}
      <div className="flex flex-1 overflow-hidden gap-4 px-4 pb-6 sm:px-6 md:gap-6 md:px-8 md:pb-8">
        {/* Left: sticky nav (desktop only) */}
        <div className="hidden md:block w-44 shrink-0 pt-2">
          <SettingsNav scrollContainerRef={scrollRef} />
        </div>

        {/* Right: scrollable content */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="min-h-0 flex-1 overflow-auto pr-0 md:pr-1"
        >
          <div className="flex flex-col gap-6 pb-24 md:gap-8">
            <AppearanceSection
              theme={draftSettings.theme}
              onThemeChange={(v) => setDraftValue("theme", v)}
              accentColor={draftSettings.accentColor}
              onAccentColorChange={(v) => setDraftValue("accentColor", v)}
            />

            <StorageSection
              defaultDownloadDir={draftSettings.defaultDownloadDir || ""}
              onDirectoryChange={(v) => setDraftValue("defaultDownloadDir", v)}
              tempDir={draftSettings.tempDir || ""}
              onTempDirChange={(v) => setDraftValue("tempDir", v)}
              skipDownloadedBefore={draftSettings.skipDownloadedBefore}
              onSkipDownloadedBeforeChange={(v) => setDraftValue("skipDownloadedBefore", v)}
              saveMetadataFiles={draftSettings.saveMetadataFiles}
              onSaveMetadataFilesChange={(v) => setDraftValue("saveMetadataFiles", v)}
              generateThumbnailContactSheets={draftSettings.generateThumbnailContactSheets}
              onGenerateThumbnailContactSheetsChange={(v) => setDraftValue("generateThumbnailContactSheets", v)}
            />

            <BehaviorSection
              notifications={draftSettings.notifications}
              onNotificationsChange={(v) => setDraftValue("notifications", v)}
              autoClearFinished={draftSettings.autoClearFinished}
              onAutoClearChange={(v) => setDraftValue("autoClearFinished", v)}
              autoCopyFile={draftSettings.autoCopyFile}
              onAutoCopyChange={(v) => setDraftValue("autoCopyFile", v)}
              autoPasteLinks={draftSettings.autoPasteLinks}
              onAutoPasteLinksChange={(v) => setDraftValue("autoPasteLinks", v)}
              fileCollision={draftSettings.fileCollision}
              onFileCollisionChange={(v) => setDraftValue("fileCollision", v)}
              historyRetention={draftSettings.historyRetention}
              onHistoryRetentionChange={(v) => setDraftValue("historyRetention", v)}
              preferredSubtitleLanguages={draftSettings.preferredSubtitleLanguages}
              onPreferredSubtitleLanguagesChange={(v) => setDraftValue("preferredSubtitleLanguages", v)}
              closeToTray={draftSettings.closeToTray}
              onCloseToTrayChange={(v) => setDraftValue("closeToTray", v)}
              launchAtLogin={draftSettings.launchAtLogin}
              onLaunchAtLoginChange={(v) => setDraftValue("launchAtLogin", v)}
              startMinimizedToTray={draftSettings.startMinimizedToTray}
              onStartMinimizedToTrayChange={(v) => setDraftValue("startMinimizedToTray", v)}
              trayLeftClickAction={draftSettings.trayLeftClickAction}
              onTrayLeftClickActionChange={(v) => setDraftValue("trayLeftClickAction", v)}
              trayDoubleClickAction={draftSettings.trayDoubleClickAction}
              onTrayDoubleClickActionChange={(v) => setDraftValue("trayDoubleClickAction", v)}
              trayMenuShowHideItem={draftSettings.trayMenuShowHideItem}
              onTrayMenuShowHideItemChange={(v) => setDraftValue("trayMenuShowHideItem", v)}
              enableBackgroundUpdateChecks={draftSettings.enableBackgroundUpdateChecks}
              onEnableBackgroundUpdateChecksChange={(v) => setDraftValue("enableBackgroundUpdateChecks", v)}
              checkToolUpdatesInBackground={draftSettings.checkToolUpdatesInBackground}
              onCheckToolUpdatesInBackgroundChange={(v) => setDraftValue("checkToolUpdatesInBackground", v)}
              checkAppUpdatesInBackground={draftSettings.checkAppUpdatesInBackground}
              onCheckAppUpdatesInBackgroundChange={(v) => setDraftValue("checkAppUpdatesInBackground", v)}
              quickDefaultPreset={draftSettings.quickDefaultPreset}
              onQuickDefaultPresetChange={(v) => setDraftValue("quickDefaultPreset", v)}
              quickActionBehavior={draftSettings.quickActionBehavior}
              onQuickActionBehaviorChange={(v) => setDraftValue("quickActionBehavior", v)}
              quickDownloadStartMode={draftSettings.quickDownloadStartMode}
              onQuickDownloadStartModeChange={(v) => setDraftValue("quickDownloadStartMode", v)}
              quickDownloadDestinationMode={draftSettings.quickDownloadDestinationMode}
              onQuickDownloadDestinationModeChange={(v) => setDraftValue("quickDownloadDestinationMode", v)}
              quickPresetOptions={quickPresetOptions}
            />

            <EngineSection
              maxConcurrency={draftSettings.maxConcurrency}
              onMaxConcurrencyChange={(v) => setDraftValue("maxConcurrency", v)}
              maxRetries={draftSettings.maxRetries}
              onMaxRetriesChange={(v) => setDraftValue("maxRetries", v)}
              maxSpeed={draftSettings.maxSpeed}
              onMaxSpeedChange={(v) => setDraftValue("maxSpeed", v)}
            />

            <AboutSection />
          </div>
        </div>
      </div>

      {/* Sticky save bar */}
      <SaveBar
        isDirty={isDirty}
        onSave={handleSave}
        onResetAll={resetAllDraft}
        onResetGroup={resetGroupDraft}
      />
    </div>
  );
}
