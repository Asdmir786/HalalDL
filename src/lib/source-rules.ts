import type { DownloadJob } from "@/store/downloads";
import type { Collection, SourceRef, SourceRule } from "@/lib/library-types";

function score(rule: SourceRule) { return rule.match.type === "creator" || rule.match.type === "playlist" ? 3 : rule.match.type === "watchlist" ? 2 : 1; }
export function resolveSourceRule(url: string, source: SourceRef | undefined, rules: SourceRule[]) {
  let domain = ""; try { domain = new URL(url).hostname.replace(/^www\./i, ""); } catch { /* invalid URL */ }
  return rules.filter((rule) => rule.enabled && (
    (rule.match.type === "domain" && rule.match.value.toLowerCase() === domain.toLowerCase()) ||
    (rule.match.type === "watchlist" && rule.match.value === source?.watchlistId) ||
    (rule.match.type === "creator" && rule.match.value.toLowerCase() === (source?.creatorId || source?.creator || "").toLowerCase()) ||
    (rule.match.type === "playlist" && rule.match.value.toLowerCase() === (source?.playlistId || source?.playlist || "").toLowerCase())
  )).sort((a, b) => score(b) - score(a) || a.priority - b.priority)[0];
}
export function applySourceRule(job: DownloadJob["overrides"] | undefined, rule: SourceRule | undefined, collection: Collection | undefined) {
  if (!rule) return job;
  return { ...(rule.downloadDir || collection?.folder ? { downloadDir: rule.downloadDir || collection?.folder } : {}), ...(rule.filenameTemplate ? { filenameTemplate: rule.filenameTemplate } : {}), ...(rule.chapterMode ? { chapterMode: rule.chapterMode } : {}), ...job };
}
