import { Sidebar } from "@/components/Sidebar";
import { useNavigationStore } from "@/store/navigation";
import { Toaster } from "@/components/ui/sonner";
import { PersistenceManager } from "@/components/PersistenceManager";
import { UpgradePrompt } from "@/components/UpgradePrompt";
import { AnimatePresence, motion } from "framer-motion";
import { PageTransition } from "@/components/motion/PageTransition";
import { DownloadsScreen } from "@/screens/DownloadsScreen"; // Keep critical path eager
import { useTaskbarProgress } from "@/hooks/useTaskbarProgress";
import { GlobalDragDrop } from "@/components/GlobalDragDrop";
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { Cpu, Sparkles, Zap } from "lucide-react";
import { listen } from "@tauri-apps/api/event";
import { QuickDownloadPanel } from "@/components/QuickDownloadPanel";
import { useRuntimeStore } from "@/store/runtime";
import { useDownloadsStore } from "@/store/downloads";
import { useSettingsStore } from "@/store/settings";
import { useAppUpdateStore } from "@/store/app-update";
import { useToolsStore } from "@/store/tools";
import { fetchMetadata, pickSupportedUrlFromText, startQueuedJobs } from "@/lib/downloader";
import {
  fetchLatestAria2Version,
  fetchLatestDenoVersion,
  fetchLatestFfmpegVersion,
  fetchLatestYtDlpVersion,
  hideMainWindowToTray,
  isUpdateAvailable,
  readTextFromClipboard,
  restoreMainWindow,
  showQuickDownloadWindow,
  syncRuntimeSettings,
  takePendingLaunchUrls,
  updateTrayState,
  wasLaunchedFromAutostart,
} from "@/lib/commands";
import { checkAndStoreAppUpdate } from "@/lib/app-updates/service";

// Lazy load non-critical screens
const PresetsScreen = lazy(() => import("@/screens/PresetsScreen").then(module => ({ default: module.PresetsScreen })));
const ToolsScreen = lazy(() => import("@/screens/ToolsScreen").then(module => ({ default: module.ToolsScreen })));
const LogsScreen = lazy(() => import("@/screens/LogsScreen").then(module => ({ default: module.LogsScreen })));
const SettingsScreen = lazy(() => import("@/screens/SettingsScreen").then(module => ({ default: module.SettingsScreen })));
const HistoryScreen = lazy(() => import("@/screens/HistoryScreen").then(module => ({ default: module.HistoryScreen })));

interface TrayActionPayload {
  action: "open-app" | "hide-window" | "quick-download" | "download-clipboard" | "pause-queue" | "resume-queue" | "check-updates";
}

const LoadingFallback = () => (
  <div className="flex h-full w-full items-center justify-center bg-transparent">
    <div className="relative flex items-center justify-center">
      {[...Array(6)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute h-1 w-1 rounded-full bg-primary/40"
          animate={{
            x: [0, Math.cos(i * 60 * (Math.PI / 180)) * 40],
            y: [0, Math.sin(i * 60 * (Math.PI / 180)) * 40],
            opacity: [0, 1, 0],
            scale: [0, 1.5, 0],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            delay: i * 0.2,
            ease: "easeInOut",
          }}
        />
      ))}

      <motion.div
        className="absolute h-16 w-16 rounded-full border-2 border-transparent border-t-primary/80 border-r-primary/40"
        animate={{ rotate: 360 }}
        transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
      />
      
      <motion.div
        className="absolute h-10 w-10 rounded-full border-2 border-transparent border-b-secondary border-l-secondary/60"
        animate={{ rotate: -360 }}
        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
      />

      <motion.div
        className="absolute h-24 w-24"
        animate={{ rotate: 360 }}
        transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
      >
        <motion.div
          className="absolute left-1/2 top-0 -translate-x-1/2"
          animate={{ rotate: -360, opacity: [0.35, 0.9, 0.35] }}
          transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
        >
          <Sparkles className="h-4 w-4 text-primary/70 drop-shadow-[0_0_10px_rgba(var(--primary),0.35)]" />
        </motion.div>
        <motion.div
          className="absolute right-0 top-1/2 -translate-y-1/2"
          animate={{ rotate: -360, opacity: [0.25, 0.75, 0.25] }}
          transition={{ duration: 3, repeat: Infinity, ease: "linear", delay: 0.2 }}
        >
          <Zap className="h-4 w-4 text-primary/60 drop-shadow-[0_0_10px_rgba(var(--primary),0.3)]" />
        </motion.div>
        <motion.div
          className="absolute left-0 top-1/2 -translate-y-1/2"
          animate={{ rotate: -360, opacity: [0.2, 0.6, 0.2] }}
          transition={{ duration: 3, repeat: Infinity, ease: "linear", delay: 0.4 }}
        >
          <Sparkles className="h-4 w-4 text-primary/40 drop-shadow-[0_0_10px_rgba(var(--primary),0.25)]" />
        </motion.div>
      </motion.div>
      
      <motion.div
        className="relative flex h-9 w-9 items-center justify-center rounded-full border border-primary/20 bg-primary/10 shadow-[0_0_18px_rgba(var(--primary),0.35)]"
        animate={{
          scale: [1, 1.12, 1],
          opacity: [0.7, 1, 0.7],
        }}
        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
      >
        <Cpu className="h-4 w-4 text-primary drop-shadow-[0_0_12px_rgba(var(--primary),0.35)]" />
      </motion.div>
      
      <div className="absolute inset-0 h-24 w-24 rounded-full bg-primary/5 blur-3xl -z-10" />
    </div>
  </div>
);

export default function App() {
  useTaskbarProgress();
  const currentScreen = useNavigationStore((state) => state.currentScreen);
  const settings = useSettingsStore((state) => state.settings);
  const jobs = useDownloadsStore((state) => state.jobs);
  const updateTool = useToolsStore((state) => state.updateTool);
  const tools = useToolsStore((state) => state.tools);
  const appUpdateAvailable = useAppUpdateStore((state) => state.updateAvailable);
  const {
    windowMode,
    queuePaused,
    setTrayStatus,
  } = useRuntimeStore();
  const [isBooting, setIsBooting] = useState(true);
  const [launchedFromAutostart, setLaunchedFromAutostart] = useState(false);
  const activeDownloads = useMemo(
    () =>
      jobs.filter(
        (job) => job.status === "Downloading" || job.status === "Post-processing"
      ).length,
    [jobs]
  );
  const failedJobs = useMemo(
    () => jobs.filter((job) => job.status === "Failed").length,
    [jobs]
  );
  const toolUpdateCount = useMemo(
    () => tools.filter((tool) => tool.updateAvailable).length,
    [tools]
  );
  const toolsReady = useMemo(
    () => tools.every((tool) => tool.status !== "Checking"),
    [tools]
  );

  // Initial boot sequence to show off the loader
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsBooting(false);
    }, 350);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    void wasLaunchedFromAutostart()
      .then(setLaunchedFromAutostart)
      .catch(() => {
        void 0;
      });
  }, []);

  useEffect(() => {
    void syncRuntimeSettings({
      closeToTray: settings.closeToTray,
      trayLeftClickAction: settings.trayLeftClickAction,
      trayDoubleClickAction: settings.trayDoubleClickAction,
      trayMenuShowHideItem: settings.trayMenuShowHideItem,
    }).catch(() => {
      void 0;
    });
  }, [
    settings.closeToTray,
    settings.trayDoubleClickAction,
    settings.trayLeftClickAction,
    settings.trayMenuShowHideItem,
  ]);

  useEffect(() => {
    if (!launchedFromAutostart) return;
    if (settings.startMinimizedToTray) return;
    void restoreMainWindow().catch(() => {
      void 0;
    });
  }, [launchedFromAutostart, settings.startMinimizedToTray]);

  useEffect(() => {
    setTrayStatus({
      activeDownloads,
      failedJobs,
      queuePaused,
      appUpdateAvailable,
      toolUpdateCount,
    });

    void updateTrayState({
      activeDownloads,
      failedJobs,
      queuePaused,
      appUpdateAvailable,
      toolUpdateCount,
    }).catch(() => {
      void 0;
    });
  }, [activeDownloads, appUpdateAvailable, failedJobs, queuePaused, setTrayStatus, toolUpdateCount]);

  const addClipboardDownload = useCallback(
    async (openAdvanced = false) => {
      const text = await readTextFromClipboard();
      const supportedUrl = pickSupportedUrlFromText(text);
      if (!supportedUrl) {
        throw new Error("Clipboard does not contain a supported media URL.");
      }

      const latestSettings = useSettingsStore.getState().settings;
      const { addJob, setComposeDraft } = useDownloadsStore.getState();
      const { setScreen } = useNavigationStore.getState();
      const runtime = useRuntimeStore.getState();
      const presetId = latestSettings.quickDefaultPreset || "default";

      if (openAdvanced) {
        setComposeDraft({
          url: supportedUrl,
          presetId,
          overrides: {
            origin: "tray",
          },
        });
        setScreen("downloads");
        runtime.restoreFullMode("downloads");
        await restoreMainWindow().catch(() => {
          void 0;
        });
        return;
      }

      const id = addJob(supportedUrl, presetId, {
        origin: "tray",
      });
      await fetchMetadata(id);
      if (latestSettings.quickDownloadStartMode === "start") {
        startQueuedJobs([id]);
      }
    },
    []
  );

  const processLaunchUrls = useCallback(
    async (urls: string[]) => {
      for (const rawUrl of urls) {
        let parsed: URL;
        try {
          parsed = new URL(rawUrl);
        } catch {
          continue;
        }

        const action = parsed.hostname || parsed.pathname.replace(/^\/+/, "");
        const { setScreen } = useNavigationStore.getState();
        const { addJob, setComposeDraft } = useDownloadsStore.getState();
        const runtime = useRuntimeStore.getState();
        const latestSettings = useSettingsStore.getState().settings;
        if (action === "open") {
          const screen = parsed.searchParams.get("screen");
          if (
            screen === "downloads" ||
            screen === "presets" ||
            screen === "tools" ||
            screen === "logs" ||
            screen === "history" ||
            screen === "settings"
          ) {
            setScreen(screen);
          }
          runtime.restoreFullMode();
          await restoreMainWindow().catch(() => {
            void 0;
          });
          continue;
        }

        if (action !== "download") continue;

        const targetUrl = parsed.searchParams.get("url");
        if (!targetUrl) continue;
        const presetId = parsed.searchParams.get("preset") || latestSettings.quickDefaultPreset || "default";
        const advanced = parsed.searchParams.get("advanced") === "1";
        const startImmediately = parsed.searchParams.get("start") !== "queue";

        if (advanced) {
          setComposeDraft({
            url: targetUrl,
            presetId,
            overrides: {
              origin: "deeplink",
            },
          });
          setScreen("downloads");
          runtime.restoreFullMode("downloads");
          await restoreMainWindow().catch(() => {
            void 0;
          });
          continue;
        }

        const id = addJob(targetUrl, presetId, { origin: "deeplink" });
        await fetchMetadata(id);
        if (startImmediately) {
          startQueuedJobs([id]);
        }
      }
    },
    []
  );

  useEffect(() => {
    let disposeTray: (() => void) | undefined;
    let disposeDeepLinks: (() => void) | undefined;
    const handleAction = async (action: TrayActionPayload["action"]) => {
      const latestSettings = useSettingsStore.getState().settings;
      const runtime = useRuntimeStore.getState();

      switch (action) {
        case "open-app":
          runtime.restoreFullMode();
          await restoreMainWindow().catch(() => {
            void 0;
          });
          break;
        case "hide-window":
          runtime.restoreFullMode();
          await hideMainWindowToTray().catch(() => {
            void 0;
          });
          break;
        case "quick-download":
          await showQuickDownloadWindow().catch(() => {
            void 0;
          });
          runtime.openQuickMode({
            url: "",
            presetId: latestSettings.quickDefaultPreset || "default",
            startMode: latestSettings.quickDownloadStartMode,
            destinationMode: latestSettings.quickDownloadDestinationMode,
          });
          break;
        case "download-clipboard":
          if (latestSettings.quickActionBehavior === "instant") {
            await addClipboardDownload(false);
          } else {
            await showQuickDownloadWindow().catch(() => {
              void 0;
            });
            runtime.openQuickMode({
              url: "",
              presetId: latestSettings.quickDefaultPreset || "default",
              startMode: latestSettings.quickDownloadStartMode,
              destinationMode: latestSettings.quickDownloadDestinationMode,
            });
          }
          break;
        case "pause-queue":
          runtime.setQueuePaused(true);
          useDownloadsStore.setState((state) => ({
            jobs: state.jobs.map((job) =>
              job.status === "Queued"
                ? { ...job, statusDetail: "Queue paused" }
                : job
            ),
          }));
          break;
        case "resume-queue":
          runtime.setQueuePaused(false);
          useDownloadsStore.setState((state) => ({
            jobs: state.jobs.map((job) =>
              job.status === "Queued" && job.statusDetail === "Queue paused"
                ? { ...job, statusDetail: "Start queue to begin" }
                : job
            ),
          }));
          startQueuedJobs();
          break;
        case "check-updates":
          useNavigationStore.getState().setScreen("settings");
          runtime.restoreFullMode("settings");
          await restoreMainWindow().catch(() => {
            void 0;
          });
          break;
      }
    };

    void takePendingLaunchUrls()
      .then((urls) => {
        if (urls.length > 0) {
          void processLaunchUrls(urls);
        }
      })
      .catch(() => {
        void 0;
      });

    void listen<TrayActionPayload>("tray-action", (event) => {
      void handleAction(event.payload.action).catch((error) => {
        console.error(error);
      });
    }).then((unlisten) => {
      disposeTray = unlisten;
    });

    void listen<string[]>("deep-link-received", (event) => {
      void processLaunchUrls(event.payload).catch((error) => {
        console.error(error);
      });
    }).then((unlisten) => {
      disposeDeepLinks = unlisten;
    });

    return () => {
      if (disposeTray) disposeTray();
      if (disposeDeepLinks) disposeDeepLinks();
    };
  }, [addClipboardDownload, processLaunchUrls]);

  useEffect(() => {
    if (!settings.enableBackgroundUpdateChecks) return;
    if (!toolsReady) return;

    const runChecks = async () => {
      const latestSettings = useSettingsStore.getState().settings;
      const latestTools = useToolsStore.getState().tools;
      const getTool = (id: string) => latestTools.find((tool) => tool.id === id);

      if (latestSettings.checkAppUpdatesInBackground) {
        await checkAndStoreAppUpdate().catch(() => {
          void 0;
        });
      }

      if (latestSettings.checkToolUpdatesInBackground) {
        const checks: Array<{ id: string; fetchLatest: () => Promise<string | null> }> = [
          {
            id: "yt-dlp",
            fetchLatest: () => fetchLatestYtDlpVersion(getTool("yt-dlp")?.channel ?? "stable"),
          },
          {
            id: "ffmpeg",
            fetchLatest: () => fetchLatestFfmpegVersion(getTool("ffmpeg")?.channel ?? "stable"),
          },
          {
            id: "aria2",
            fetchLatest: () => fetchLatestAria2Version(),
          },
          {
            id: "deno",
            fetchLatest: () => fetchLatestDenoVersion(),
          },
        ];

        await Promise.all(
          checks.map(async ({ id, fetchLatest }) => {
            try {
              const latestVersion = await fetchLatest();
              const currentTool = getTool(id);
              updateTool(id, {
                latestVersion: latestVersion ?? undefined,
                updateAvailable: isUpdateAvailable(currentTool?.version, latestVersion ?? undefined),
                latestCheckedAt: Date.now(),
              });
            } catch {
              void 0;
            }
          })
        );
      }
    };

    const startupTimer = window.setTimeout(() => {
      void runChecks();
    }, 15000);
    const interval = window.setInterval(runChecks, 1000 * 60 * 60 * 6);
    return () => {
      window.clearTimeout(startupTimer);
      window.clearInterval(interval);
    };
  }, [
    settings.checkAppUpdatesInBackground,
    settings.checkToolUpdatesInBackground,
    settings.enableBackgroundUpdateChecks,
    toolsReady,
    updateTool,
  ]);

  const renderScreen = () => {
    switch (currentScreen) {
      case "downloads": return <DownloadsScreen />;
      case "presets": return <PresetsScreen />;
      case "tools": return <ToolsScreen />;
      case "logs": return <LogsScreen />;
      case "history": return <HistoryScreen />;
      case "settings": return <SettingsScreen />;
      default: return <DownloadsScreen />;
    }
  };

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <GlobalDragDrop />
      <PersistenceManager />
      {windowMode === "full" && <Sidebar />}
      <main className="flex-1 overflow-hidden relative bg-gradient-to-br from-background via-background to-secondary/20">
        <AnimatePresence mode="wait">
          {isBooting ? (
             <motion.div
               key="boot-loader"
               className="h-full w-full flex items-center justify-center"
               exit={{ opacity: 0, scale: 0.9, filter: "blur(10px)" }}
               transition={{ duration: 0.5 }}
             >
               <LoadingFallback />
             </motion.div>
          ) : windowMode === "quick" ? (
            <motion.div
              key="quick-download"
              className="h-full w-full"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
            >
              <QuickDownloadPanel />
            </motion.div>
          ) : (
            <PageTransition key={currentScreen} className="h-full w-full overflow-hidden">
              <Suspense fallback={<LoadingFallback />}>
                {renderScreen()}
              </Suspense>
            </PageTransition>
          )}
        </AnimatePresence>
      </main>
      <Toaster />
      {windowMode === "full" && <UpgradePrompt />}
    </div>
  );
}
