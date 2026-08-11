import type { ChapterMode } from "@/lib/chapters";

export type WatchlistKind = "youtube-channel" | "youtube-playlist" | "collection";
export type WatchlistFirstRunMode = "ask" | "backlog" | "future-only";
export type WatchlistDeliveryMode = "ask" | "start" | "queue";

export interface SourceRef {
  watchlistId?: string;
  creator?: string;
  creatorId?: string;
  playlist?: string;
  playlistId?: string;
}

export interface Watchlist {
  id: string;
  label: string;
  url: string;
  kind: WatchlistKind;
  enabled: boolean;
  intervalHours: number;
  maxItemsPerCheck: number;
  firstRunMode: WatchlistFirstRunMode;
  /** Per-source delivery takes precedence over the legacy global default. */
  deliveryMode?: Exclude<WatchlistDeliveryMode, "ask">;
  initializedAt?: number;
  lastCheckedAt?: number;
  lastSuccessAt?: number;
  lastError?: string;
  collectionId?: string;
  presetId?: string;
  chapterMode?: ChapterMode;
  lastDiscoveredCount?: number;
  lastQueuedCount?: number;
}

export type SourceActivityKind = "checked" | "queued" | "paused" | "resumed" | "error";
export interface SourceActivity { id: string; watchlistId: string; kind: SourceActivityKind; detail: string; createdAt: number; }

export interface Collection {
  id: string;
  name: string;
  folder?: string;
  tags: string[];
  presetId?: string;
  createdAt: number;
}

export type SourceRuleMatch =
  | { type: "domain"; value: string }
  | { type: "watchlist"; value: string }
  | { type: "creator"; value: string }
  | { type: "playlist"; value: string };

export interface SourceRule {
  id: string;
  name: string;
  enabled: boolean;
  priority: number;
  match: SourceRuleMatch;
  collectionId?: string;
  presetId?: string;
  downloadDir?: string;
  filenameTemplate?: string;
  tags?: string[];
  chapterMode?: ChapterMode;
}
