import { fetchPlaylistEntries } from "@/lib/downloader/playlist";
import { getWatchlistArchiveIds } from "@/lib/downloader/archive";
import { getWatchlistYtDlpArchivePath } from "@/lib/downloader/archive";
import { resolveTool, ytDlpEnv } from "@/lib/downloader/tool-env";
import { appendJsRuntimeArgs } from "@/lib/downloader/js-runtime";
import { runResolvedTool } from "@/lib/process/app-bin";
import { startQueuedJobs } from "@/lib/downloader";
import { useDownloadsStore } from "@/store/downloads";
import { useLibraryStore } from "@/store/library";
import { useSettingsStore } from "@/store/settings";
import { useLogsStore } from "@/store/logs";
import { resolveSourceRule, applySourceRule } from "@/lib/source-rules";
import type { Watchlist } from "@/lib/library-types";

let checking = false;
export async function checkWatchlist(watchlist: Watchlist, force = false) {
  if (checking && !force) return 0;
  checking = true;
  const { updateWatchlist, collections, rules, addActivity } = useLibraryStore.getState();
  try {
    updateWatchlist(watchlist.id, { lastCheckedAt: Date.now(), lastError: undefined });
    addActivity({ watchlistId: watchlist.id, kind: "checked", detail: force ? "Manual check started" : "Scheduled check started" });
    const result = await fetchPlaylistEntries(watchlist.url);
    const archivedIds = await getWatchlistArchiveIds(watchlist.id);
    if (!watchlist.initializedAt && watchlist.firstRunMode === "future-only") {
      const ytDlp = await resolveTool("yt-dlp");
      const archive = await getWatchlistYtDlpArchivePath(watchlist.id);
      const baselineArgs = ["--flat-playlist", "--skip-download", "--force-write-archive", "--download-archive", archive, watchlist.url];
      await appendJsRuntimeArgs(baselineArgs, watchlist.url);
      const baseline = await runResolvedTool(ytDlp, "yt-dlp", baselineArgs, { env: ytDlpEnv(), timeoutMs: 120000 });
      if (baseline.code !== 0) throw new Error(baseline.stderr.trim() || "Could not create the future-only baseline.");
      updateWatchlist(watchlist.id, { initializedAt: Date.now(), lastSuccessAt: Date.now(), lastError: undefined, lastDiscoveredCount: result.entries.length, lastQueuedCount: 0 });
      addActivity({ watchlistId: watchlist.id, kind: "checked", detail: `Baseline recorded: ${result.entries.length} item(s) discovered` });
      return 0;
    }
    const existingUrls = new Set(useDownloadsStore.getState().jobs.map((job) => job.url));
    const candidates = result.entries.filter((entry) => !archivedIds.has(entry.id) && !existingUrls.has(entry.url)).slice(0, Math.max(1, watchlist.maxItemsPerCheck || 25));
    const addJob = useDownloadsStore.getState().addJob;
    const updateJob = useDownloadsStore.getState().updateJob;
    const collection = collections.find((item) => item.id === watchlist.collectionId);
    for (const entry of candidates) {
      const sourceRef = { watchlistId: watchlist.id };
      const rule = resolveSourceRule(entry.url, sourceRef, rules);
      const overrides = applySourceRule(undefined, rule, collection);
      const id = addJob(entry.url, rule?.presetId || watchlist.presetId || collection?.presetId || "default", {
        ...overrides,
        chapterMode: rule?.chapterMode || watchlist.chapterMode,
        sourceRef,
        collectionId: rule?.collectionId || watchlist.collectionId,
        appliedRuleId: rule?.id,
        origin: "app",
      });
      updateJob(id, { title: entry.title, mediaDurationSeconds: entry.durationSeconds, sourceRef, collectionId: rule?.collectionId || watchlist.collectionId, appliedRuleId: rule?.id });
    }
    updateWatchlist(watchlist.id, { initializedAt: watchlist.initializedAt || Date.now(), lastSuccessAt: Date.now(), lastError: undefined, lastDiscoveredCount: result.entries.length, lastQueuedCount: candidates.length });
    addActivity({ watchlistId: watchlist.id, kind: candidates.length ? "queued" : "checked", detail: candidates.length ? `${candidates.length} new item(s) queued` : `Checked ${result.entries.length} item(s); nothing new` });
    const delivery = watchlist.deliveryMode ?? useSettingsStore.getState().settings.watchlistDeliveryMode;
    if (candidates.length && delivery === "start" && !useDownloadsStore.getState().jobs.some((j) => j.status === "Paused")) startQueuedJobs();
    useLogsStore.getState().addLog({ level: "info", message: `Watchlist ${watchlist.label}: found ${candidates.length} new item(s).` });
    return candidates.length;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    updateWatchlist(watchlist.id, { lastError: message.slice(0, 280) });
    addActivity({ watchlistId: watchlist.id, kind: "error", detail: message.slice(0, 280) });
    useLogsStore.getState().addLog({ level: "warn", message: `Watchlist ${watchlist.label} failed: ${message}` });
    return 0;
  } finally { checking = false; }
}

export async function checkDueWatchlists() {
  const now = Date.now();
  for (const watchlist of useLibraryStore.getState().watchlists) {
    if (!watchlist.enabled || watchlist.firstRunMode === "ask") continue;
    const due = !watchlist.lastCheckedAt || now - watchlist.lastCheckedAt >= Math.max(1, watchlist.intervalHours || 6) * 3_600_000;
    if (due) await checkWatchlist(watchlist);
  }
}
