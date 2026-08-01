import { DEFAULT_SETTINGS, useSettingsStore } from "@/store/settings";
import { BUILT_IN_PRESETS, usePresetsStore } from "@/store/presets";
import { useDownloadsStore, type DownloadJob } from "@/store/downloads";
import { useHistoryStore, type HistoryEntry } from "@/store/history";
import { useLogsStore, type LogEntry } from "@/store/logs";
import { useNavigationStore, type Screen } from "@/store/navigation";
import { useToolsStore, type Tool } from "@/store/tools";
import { useRuntimeStore } from "@/store/runtime";
import { useAppUpdateStore } from "@/store/app-update";
import { useAttentionStore } from "@/store/attention";
import { seedDemoStartupSummary } from "@/lib/startup-metrics";

type DemoMode = "marketing";
type DemoSettingsSection = "appearance" | "performance" | "about";

const DEMO_SCREENS: Screen[] = ["downloads", "presets", "tools", "logs", "history", "settings"];
const DEMO_SETTINGS_SECTIONS: DemoSettingsSection[] = ["appearance", "performance", "about"];
const DEMO_USER_ROOT = "C:\\Users\\Demo";

function getSearchParams() {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search);
}

export function getRequestedDemoMode(): DemoMode | null {
  const params = getSearchParams();
  if (!params) return null;
  const raw = params.get("demo")?.trim().toLowerCase();
  if (raw === "marketing" || raw === "1" || raw === "true") return "marketing";
  return null;
}

export function isDemoModeEnabled() {
  return getRequestedDemoMode() !== null;
}

function getRequestedScreen(): Screen {
  const params = getSearchParams();
  const raw = params?.get("screen");
  return raw && DEMO_SCREENS.includes(raw as Screen) ? (raw as Screen) : "downloads";
}

function getRequestedTheme(): "light" | "dark" {
  const params = getSearchParams();
  const raw = params?.get("theme")?.trim().toLowerCase();
  return raw === "dark" ? "dark" : "light";
}

function getRequestedSettingsSection(): DemoSettingsSection | null {
  const params = getSearchParams();
  const raw = params?.get("section")?.trim().toLowerCase();
  if (!raw) return null;
  return DEMO_SETTINGS_SECTIONS.includes(raw as DemoSettingsSection)
    ? (raw as DemoSettingsSection)
    : null;
}

function svgThumbnail(title: string, colorA: string, colorB: string) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">
      <defs>
        <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${colorA}" />
          <stop offset="100%" stop-color="${colorB}" />
        </linearGradient>
      </defs>
      <rect width="640" height="360" rx="28" fill="url(#g)" />
      <circle cx="520" cy="84" r="92" fill="rgba(255,255,255,0.14)" />
      <circle cx="138" cy="282" r="124" fill="rgba(255,255,255,0.08)" />
      <text x="42" y="102" fill="rgba(255,255,255,0.78)" font-family="Segoe UI, Arial, sans-serif" font-size="22" font-weight="700" letter-spacing="4">HALALDL DEMO</text>
      <text x="42" y="174" fill="#ffffff" font-family="Segoe UI, Arial, sans-serif" font-size="34" font-weight="800">${title}</text>
      <text x="42" y="214" fill="rgba(255,255,255,0.84)" font-family="Segoe UI, Arial, sans-serif" font-size="18">Marketing preview asset</text>
    </svg>
  `.trim();
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function buildDemoJobs(now: number): DownloadJob[] {
  return [
    {
      id: "demo-job-downloadgram",
      url: "https://www.instagram.com/p/DEMO-carousel-01/",
      title: "Instagram carousel export for social share",
      thumbnail: svgThumbnail("Instagram Carousel", "#0f766e", "#1d4ed8"),
      progress: 68,
      speed: "8.4 MB/s",
      eta: "00:16",
      status: "Downloading",
      phase: "Downloading streams",
      statusDetail: "2 of 4 carousel items fetched",
      presetId: "whatsapp-optimized",
      createdAt: now - 12 * 60 * 1000,
      statusChangedAt: now - 90 * 1000,
      thumbnailStatus: "ready",
      subtitleStatus: "unavailable",
      fallbackUsed: true,
      fallbackFormat: "downloadgram",
      outputPath: `${DEMO_USER_ROOT}\\Downloads\\HalalDL\\instagram-carousel`,
      outputPaths: [
        `${DEMO_USER_ROOT}\\Downloads\\HalalDL\\instagram-carousel\\slide-01.mp4`,
        `${DEMO_USER_ROOT}\\Downloads\\HalalDL\\instagram-carousel\\slide-02.mp4`,
      ],
      hasManualSubtitles: false,
      hasAutoSubtitles: false,
      availableSubtitleLanguages: [],
      resolvedSubtitleSource: "none",
      overrides: { origin: "app" },
    },
    {
      id: "demo-job-subs",
      url: "https://www.youtube.com/watch?v=demoSubtitles01",
      title: "Lecture clip with subtitle sidecars",
      thumbnail: svgThumbnail("Subtitle Workflow", "#1d4ed8", "#0f172a"),
      progress: 0,
      status: "Queued",
      phase: "Resolving formats",
      statusDetail: "Ready to start with subtitle sidecars",
      presetId: "default-subs",
      createdAt: now - 8 * 60 * 1000,
      statusChangedAt: now - 8 * 60 * 1000,
      queueOrder: now - 8 * 60 * 1000,
      thumbnailStatus: "ready",
      subtitleStatus: "available",
      hasManualSubtitles: true,
      hasAutoSubtitles: true,
      availableSubtitleLanguages: ["en", "en-US", "ur"],
      resolvedSubtitleSource: "manual",
      overrides: {
        subtitleMode: "on",
        subtitleSourcePolicy: "manual-then-auto",
        subtitleLanguageMode: "preferred",
        subtitleLanguages: ["en.*", "en"],
        subtitleFormat: "srt",
        origin: "app",
      },
    },
    {
      id: "demo-job-paused",
      url: "https://www.youtube.com/watch?v=demoPaused02",
      title: "WhatsApp-ready highlight reel",
      thumbnail: svgThumbnail("Queue Control", "#f59e0b", "#b91c1c"),
      progress: 41,
      speed: undefined,
      eta: undefined,
      status: "Paused",
      phase: "Downloading streams",
      statusDetail: "Paused manually",
      presetId: "whatsapp-optimized",
      createdAt: now - 36 * 60 * 1000,
      statusChangedAt: now - 7 * 60 * 1000,
      queueOrder: now - 7 * 60 * 1000,
      thumbnailStatus: "ready",
      subtitleStatus: "unavailable",
      fallbackUsed: false,
      overrides: { origin: "tray" },
    },
    {
      id: "demo-job-post",
      url: "https://www.youtube.com/watch?v=demoPost03",
      title: "Editing export with FFmpeg finishing pass",
      thumbnail: svgThumbnail("FFmpeg Finishing", "#7c3aed", "#0f172a"),
      progress: 84,
      speed: undefined,
      eta: undefined,
      status: "Post-processing",
      phase: "Converting with FFmpeg",
      statusDetail: "Final MP4 conversion in progress",
      presetId: "editors-capcut-1080p-mp4",
      createdAt: now - 24 * 60 * 1000,
      statusChangedAt: now - 30 * 1000,
      thumbnailStatus: "ready",
      subtitleStatus: "unavailable",
      ffmpegProgressKnown: false,
      outputPath: `${DEMO_USER_ROOT}\\Downloads\\HalalDL\\editing-cut.mp4`,
      overrides: { origin: "app" },
    },
    {
      id: "demo-job-done",
      url: "https://www.youtube.com/watch?v=demoDone04",
      title: "Source audio export for archive",
      thumbnail: svgThumbnail("Audio Export", "#0f766e", "#14b8a6"),
      progress: 100,
      status: "Done",
      phase: "Generating thumbnail",
      statusDetail: "Saved successfully",
      presetId: "mp3",
      createdAt: now - 52 * 60 * 1000,
      statusChangedAt: now - 15 * 60 * 1000,
      thumbnailStatus: "ready",
      subtitleStatus: "idle",
      outputPath: `${DEMO_USER_ROOT}\\Downloads\\HalalDL\\source-audio.mp3`,
      outputPaths: [`${DEMO_USER_ROOT}\\Downloads\\HalalDL\\source-audio.mp3`],
      fileSize: 12400000,
      mediaDurationSeconds: 605,
      overrides: { origin: "app" },
    },
  ];
}

function buildDemoHistory(now: number): HistoryEntry[] {
  return [
    {
      id: "history-01",
      url: "https://www.youtube.com/watch?v=demoDone04",
      title: "Source audio export for archive",
      thumbnail: svgThumbnail("Audio Export", "#0f766e", "#14b8a6"),
      format: "mp3",
      fileSize: 12400000,
      mediaDurationSeconds: 605,
      outputPath: `${DEMO_USER_ROOT}\\Downloads\\HalalDL\\source-audio.mp3`,
      outputPaths: [`${DEMO_USER_ROOT}\\Downloads\\HalalDL\\source-audio.mp3`],
      presetId: "mp3",
      presetName: "Audio MP3",
      downloadedAt: now - 15 * 60 * 1000,
      duration: 605,
      domain: "youtube.com",
      status: "completed",
      isFavorite: true,
      tags: ["audio", "archive"],
      notes: "Clean export for local archive.",
    },
    {
      id: "history-02",
      url: "https://www.instagram.com/p/demoCarousel06/",
      title: "Instagram carousel export for social share",
      thumbnail: svgThumbnail("Instagram Carousel", "#0f766e", "#1d4ed8"),
      format: "mp4",
      fileSize: 88400000,
      mediaDurationSeconds: 74,
      outputPath: `${DEMO_USER_ROOT}\\Downloads\\HalalDL\\instagram-carousel\\slide-01.mp4`,
      outputPaths: [
        `${DEMO_USER_ROOT}\\Downloads\\HalalDL\\instagram-carousel\\slide-01.mp4`,
        `${DEMO_USER_ROOT}\\Downloads\\HalalDL\\instagram-carousel\\slide-02.mp4`,
        `${DEMO_USER_ROOT}\\Downloads\\HalalDL\\instagram-carousel\\slide-03.jpg`,
      ],
      presetId: "whatsapp-optimized",
      presetName: "WhatsApp Ready",
      downloadedAt: now - 2 * 60 * 60 * 1000,
      duration: 74,
      domain: "instagram.com",
      status: "completed",
      tags: ["instagram", "carousel"],
    },
    {
      id: "history-03",
      url: "https://www.youtube.com/watch?v=demoLecture07",
      title: "Long-form lecture with sidecar subtitles",
      thumbnail: svgThumbnail("Lecture + Subs", "#1d4ed8", "#0f172a"),
      format: "mp4",
      fileSize: 164000000,
      mediaDurationSeconds: 1805,
      outputPath: `${DEMO_USER_ROOT}\\Downloads\\HalalDL\\lecture-subs.mp4`,
      outputPaths: [
        `${DEMO_USER_ROOT}\\Downloads\\HalalDL\\lecture-subs.mp4`,
        `${DEMO_USER_ROOT}\\Downloads\\HalalDL\\lecture-subs.en.srt`,
      ],
      presetId: "default-subs",
      presetName: "Best Video + Subtitles",
      downloadedAt: now - 26 * 60 * 60 * 1000,
      duration: 1805,
      domain: "youtube.com",
      status: "completed",
      tags: ["subtitles", "lecture"],
      notes: "Manual English subtitles were available.",
    },
    {
      id: "history-05",
      url: "https://www.youtube.com/watch?v=demoClip08",
      title: "Quick highlight clip for WhatsApp",
      thumbnail: svgThumbnail("Quick Clip", "#f59e0b", "#b91c1c"),
      format: "mp4",
      fileSize: 36200000,
      mediaDurationSeconds: 49,
      outputPath: `${DEMO_USER_ROOT}\\Downloads\\HalalDL\\quick-highlight.mp4`,
      outputPaths: [`${DEMO_USER_ROOT}\\Downloads\\HalalDL\\quick-highlight.mp4`],
      presetId: "whatsapp-optimized",
      presetName: "WhatsApp Ready",
      downloadedAt: now - 4 * 24 * 60 * 60 * 1000,
      duration: 49,
      domain: "youtube.com",
      status: "completed",
      tags: ["share"],
    },
  ];
}

function buildDemoLogs(now: number): LogEntry[] {
  const stamp = (offsetMinutes: number) => new Date(now - offsetMinutes * 60 * 1000).toISOString();
  return [
    {
      id: "log-01",
      timestamp: stamp(18),
      level: "info",
      jobId: "demo-job-downloadgram",
      message: "Instagram resolver returned 4 media items via DownloadGram.",
    },
    {
      id: "log-02",
      timestamp: stamp(17),
      level: "command",
      jobId: "demo-job-downloadgram",
      message: "Downloading Instagram item 1/4",
      command: "download_url_to_file(slide-01.mp4)",
    },
    {
      id: "log-03",
      timestamp: stamp(16),
      level: "info",
      jobId: "demo-job-subs",
      message: "Manual subtitles detected in languages: en, en-US, ur",
    },
    {
      id: "log-04",
      timestamp: stamp(14),
      level: "command",
      jobId: "demo-job-post",
      message: "Running FFmpeg finishing pass",
      command: "ffmpeg -i editing-cut.source.webm -c:v libx264 -c:a aac editing-cut.mp4",
    },
    {
      id: "log-05",
      timestamp: stamp(12),
      level: "info",
      jobId: "demo-job-paused",
      message: "Queue paused by user. Waiting to resume.",
    },
    {
      id: "log-06",
      timestamp: stamp(10),
      level: "info",
      jobId: "demo-job-done",
      message: "Download finished successfully: source-audio.mp3",
    },
    {
      id: "log-07",
      timestamp: stamp(8),
      level: "info",
      message: "Background update check found HalalDL v0.5.1 ready.",
    },
    {
      id: "log-08",
      timestamp: stamp(4),
      level: "info",
      message: "yt-dlp stable update available: 2026.03.29",
    },
    {
      id: "log-09",
      timestamp: stamp(3),
      level: "info",
      jobId: "demo-job-downloadgram",
      message: "Carousel item 2/4 saved.",
    },
    {
      id: "log-10",
      timestamp: stamp(2),
      level: "command",
      jobId: "demo-job-subs",
      message: "Preparing subtitle sidecars",
      command: "yt-dlp --write-subs --sub-langs en.*",
    },
  ];
}

function buildDemoTools(now: number): Tool[] {
  return [
    {
      id: "yt-dlp",
      name: "yt-dlp",
      status: "Detected",
      version: "2026.03.29",
      latestVersion: "2026.03.29",
      updateAvailable: false,
      latestCheckedAt: now,
      path: `${DEMO_USER_ROOT}\\AppData\\Roaming\\HalalDL\\bin\\yt-dlp.exe`,
      mode: "Bundled",
      channel: "stable",
      required: true,
      hasBackup: true,
    },
    {
      id: "ffmpeg",
      name: "FFmpeg",
      status: "Detected",
      version: "7.1.1",
      latestVersion: "7.1.1",
      updateAvailable: false,
      latestCheckedAt: now,
      path: `${DEMO_USER_ROOT}\\AppData\\Roaming\\HalalDL\\bin\\ffmpeg.exe`,
      mode: "Bundled",
      channel: "stable",
      required: false,
      hasBackup: false,
    },
    {
      id: "aria2",
      name: "aria2",
      status: "Detected",
      version: "1.37.0",
      latestVersion: "1.37.0",
      updateAvailable: false,
      latestCheckedAt: now,
      path: `${DEMO_USER_ROOT}\\AppData\\Roaming\\HalalDL\\bin\\aria2c.exe`,
      mode: "Bundled",
      channel: "stable",
      required: false,
      hasBackup: false,
    },
    {
      id: "deno",
      name: "Deno",
      status: "Detected",
      version: "2.5.0",
      latestVersion: "2.5.0",
      updateAvailable: false,
      latestCheckedAt: now,
      path: `${DEMO_USER_ROOT}\\AppData\\Roaming\\HalalDL\\bin\\deno.exe`,
      mode: "Bundled",
      channel: "stable",
      required: false,
      hasBackup: false,
    },
  ];
}

export function seedMarketingDemoState() {
  const now = Date.now();
  const settings = {
    ...DEFAULT_SETTINGS,
    theme: getRequestedTheme(),
    defaultDownloadDir: `${DEMO_USER_ROOT}\\Downloads\\HalalDL`,
    downloadsAddMode: "start" as const,
    downloadsSelectedPreset: "default",
    quickDefaultPreset: "whatsapp-optimized",
    closeToTray: true,
    enableBackgroundUpdateChecks: false,
    checkToolUpdatesInBackground: false,
    checkAppUpdatesInBackground: false,
  };

  seedDemoStartupSummary();
  // Re-apply after App/persistence startup reporting so marketing shots stay stable.
  if (typeof window !== "undefined") {
    window.setTimeout(() => seedDemoStartupSummary(), 400);
  }
  useSettingsStore.getState().setSettings(settings);
  usePresetsStore.getState().setPresets(BUILT_IN_PRESETS);
  useDownloadsStore.setState({
    jobs: buildDemoJobs(now),
    pendingUrl: undefined,
    composeDraft: undefined,
  });
  useHistoryStore.setState({ entries: buildDemoHistory(now) });
  useLogsStore.setState({
    logs: buildDemoLogs(now),
    loadStatus: "ready",
    loadError: undefined,
    activeJobId: undefined,
  });
  useToolsStore.getState().setTools(buildDemoTools(now));
  useRuntimeStore.setState({
    windowMode: "full",
    queuePaused: false,
    lastFullScreen: getRequestedScreen(),
    trayStatus: {
      activeDownloads: 2,
      failedJobs: 0,
      queuePaused: false,
      appUpdateAvailable: false,
      toolUpdateCount: 0,
    },
    quickDraft: null,
  });
  useNavigationStore.getState().setScreen(getRequestedScreen());
  useAppUpdateStore.setState({
    updateAvailable: false,
    latestVersion: null,
    releaseUrl: null,
    downloadUrl: null,
    assetName: null,
    checksumUrl: null,
  });
  useAppUpdateStore.getState().setInstallContext({
    installerType: "nsis",
    installScope: "user",
    installDir: `${DEMO_USER_ROOT}\\AppData\\Local\\Programs\\HalalDL`,
    uninstallCommand: `"${DEMO_USER_ROOT}\\AppData\\Local\\Programs\\HalalDL\\uninstall.exe"`,
    detectedFrom: "marketing-demo",
    registryKey: "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\HalalDL",
  });

  const section = getRequestedSettingsSection();
  if (getRequestedScreen() === "settings" && section) {
    window.setTimeout(() => {
      useAttentionStore.getState().setTarget({
        screen: "settings",
        reason: "marketing-demo-section",
        targetType: "section",
        targetId: section,
      });
    }, 120);
  }
}
