import { CheckSquare, LayoutGrid, List, ListMusic, LoaderCircle, Square } from "lucide-react";
import { useMemo, useState } from "react";
import { MotionButton } from "@/components/motion/MotionButton";
import { Checkbox } from "@/components/ui/checkbox";
import { PLAYLIST_ENTRY_LIMIT, type PlaylistEntry } from "@/lib/downloader/playlist";
import { formatMediaDuration } from "../utils";
import { cn } from "@/lib/utils";

export type PlaylistPickerStatus = "idle" | "loading" | "ready" | "error";
export type PlaylistViewMode = "list" | "cards";

type PlaylistPickerProps = {
  status: PlaylistPickerStatus;
  entries: PlaylistEntry[];
  selectedKeys: Set<string>;
  onSelectedKeysChange: (next: Set<string>) => void;
  errorMessage?: string | null;
  truncated?: boolean;
  /** Show control to download only the opened video (watch?v= + list=). */
  canPreferSingleVideo?: boolean;
  preferSingleVideo?: boolean;
  onPreferSingleVideoChange?: (value: boolean) => void;
};

export function PlaylistPicker({
  status,
  entries,
  selectedKeys,
  onSelectedKeysChange,
  errorMessage,
  truncated,
  canPreferSingleVideo,
  preferSingleVideo,
  onPreferSingleVideoChange,
}: PlaylistPickerProps) {
  const [viewMode, setViewMode] = useState<PlaylistViewMode>("list");

  const selectedCount = useMemo(
    () => entries.filter((entry) => selectedKeys.has(entry.key)).length,
    [entries, selectedKeys]
  );
  const allSelected = entries.length > 0 && selectedCount === entries.length;

  if (status === "idle") return null;

  if (status === "loading") {
    return (
      <div
        aria-live="polite"
        className="flex items-center gap-2 rounded-xl border border-border/60 bg-background/82 px-3 py-2.5 text-[11px] text-muted-foreground dark:border-white/8 dark:bg-background/65"
      >
        <LoaderCircle className="h-3.5 w-3.5 shrink-0 animate-spin text-sky-600 dark:text-sky-300" />
        <span>Scanning playlist entries…</span>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div
        aria-live="polite"
        className="space-y-2 rounded-xl border border-amber-500/25 bg-amber-500/8 px-3 py-2.5 text-[11px] text-amber-800 dark:text-amber-200"
      >
        <div>
          <p className="font-medium">Could not load playlist</p>
          <p className="mt-0.5 opacity-90">
            {errorMessage?.trim() ||
              "Private lists need a cookies.txt file in Settings → Download Engine."}
          </p>
        </div>
        {canPreferSingleVideo && onPreferSingleVideoChange ? (
          <MotionButton
            type="button"
            variant="outline"
            size="sm"
            className="h-7 rounded-lg px-2 text-[10px]"
            onClick={() => onPreferSingleVideoChange(true)}
          >
            Download this video only
          </MotionButton>
        ) : null}
      </div>
    );
  }

  if (preferSingleVideo) {
    return (
      <div
        aria-live="polite"
        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/60 bg-background/82 px-3 py-2.5 text-[11px] dark:border-white/8 dark:bg-background/65"
      >
        <div className="min-w-0">
          <p className="font-medium text-foreground">This video only</p>
          <p className="mt-0.5 text-muted-foreground">
            Playlist list= ignored — one job for the open video.
          </p>
        </div>
        {onPreferSingleVideoChange ? (
          <MotionButton
            type="button"
            variant="outline"
            size="sm"
            className="h-7 shrink-0 rounded-lg px-2 text-[10px]"
            onClick={() => onPreferSingleVideoChange(false)}
          >
            Pick from playlist
          </MotionButton>
        ) : null}
      </div>
    );
  }

  if (entries.length === 0) return null;

  const toggleKey = (key: string, checked: boolean) => {
    const next = new Set(selectedKeys);
    if (checked) next.add(key);
    else next.delete(key);
    onSelectedKeysChange(next);
  };

  const selectAll = () => {
    onSelectedKeysChange(new Set(entries.map((entry) => entry.key)));
  };

  const selectNone = () => {
    onSelectedKeysChange(new Set());
  };

  return (
    <div
      aria-live="polite"
      className="overflow-hidden rounded-xl border border-border/60 bg-background/82 shadow-sm dark:border-white/8 dark:bg-background/65"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 px-3 py-2 dark:border-white/8">
        <div className="flex min-w-0 items-center gap-2 text-[11px]">
          <ListMusic className="h-3.5 w-3.5 shrink-0 text-sky-600 dark:text-sky-300" />
          <span className="font-semibold text-foreground">
            Playlist · {selectedCount}/{entries.length} selected
          </span>
          {truncated ? (
            <span className="text-muted-foreground">(first {PLAYLIST_ENTRY_LIMIT} items)</span>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {canPreferSingleVideo && onPreferSingleVideoChange ? (
            <MotionButton
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 rounded-lg px-2 text-[10px] font-semibold"
              onClick={() => onPreferSingleVideoChange(true)}
            >
              This video only
            </MotionButton>
          ) : null}
          <div className="flex h-7 items-center gap-0.5 rounded-lg border border-border/60 bg-background/70 p-0.5 dark:border-white/10">
            <MotionButton
              type="button"
              variant="ghost"
              size="sm"
              className={cn(
                "h-6 gap-1 rounded-md px-2 text-[10px] font-semibold",
                viewMode === "list" && "bg-muted text-foreground"
              )}
              onClick={() => setViewMode("list")}
              aria-pressed={viewMode === "list"}
            >
              <List className="h-3 w-3" />
              List
            </MotionButton>
            <MotionButton
              type="button"
              variant="ghost"
              size="sm"
              className={cn(
                "h-6 gap-1 rounded-md px-2 text-[10px] font-semibold",
                viewMode === "cards" && "bg-muted text-foreground"
              )}
              onClick={() => setViewMode("cards")}
              aria-pressed={viewMode === "cards"}
            >
              <LayoutGrid className="h-3 w-3" />
              Cards
            </MotionButton>
          </div>
          <MotionButton
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 gap-1 rounded-lg px-2 text-[10px] font-semibold"
            onClick={allSelected ? selectNone : selectAll}
          >
            {allSelected ? (
              <>
                <Square className="h-3 w-3" />
                None
              </>
            ) : (
              <>
                <CheckSquare className="h-3 w-3" />
                All
              </>
            )}
          </MotionButton>
        </div>
      </div>

      {viewMode === "list" ? (
        <div role="list" className="max-h-56 overflow-y-auto overscroll-contain" aria-label="Playlist items">
          {entries.map((entry) => {
            const checked = selectedKeys.has(entry.key);
            const duration = formatMediaDuration(entry.durationSeconds);
            return (
              <label
                key={entry.key}
                role="listitem"
                className="flex cursor-pointer items-start gap-2.5 border-b border-border/40 px-3 py-2 last:border-b-0 hover:bg-muted/35 dark:border-white/6 dark:hover:bg-white/[0.04]"
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={(value) => toggleKey(entry.key, value === true)}
                  className="mt-0.5"
                  aria-label={`Select ${entry.title}`}
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-2">
                    {entry.index != null ? (
                      <span className="w-7 shrink-0 font-mono text-[10px] text-muted-foreground">
                        {entry.index}
                      </span>
                    ) : null}
                    <span className="min-w-0 truncate text-[12px] font-medium text-foreground">
                      {entry.title}
                    </span>
                    {duration ? (
                      <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                        {duration}
                      </span>
                    ) : null}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      ) : (
        <div
          role="list"
          className="max-h-56 overflow-y-auto overscroll-contain p-2"
          aria-label="Playlist items as cards"
        >
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {entries.map((entry) => {
              const checked = selectedKeys.has(entry.key);
              const duration = formatMediaDuration(entry.durationSeconds);
              return (
                <label
                  key={entry.key}
                  role="listitem"
                  className={cn(
                    "flex cursor-pointer gap-2 rounded-lg border px-2.5 py-2 transition-colors",
                    checked
                      ? "border-sky-500/35 bg-sky-500/10"
                      : "border-border/50 bg-background/50 hover:bg-muted/30 dark:border-white/8"
                  )}
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(value) => toggleKey(entry.key, value === true)}
                    className="mt-0.5"
                    aria-label={`Select ${entry.title}`}
                  />
                  <span className="min-w-0 flex-1">
                    {entry.index != null ? (
                      <span className="font-mono text-[10px] text-muted-foreground">#{entry.index}</span>
                    ) : null}
                    <span className="line-clamp-2 block text-[12px] font-medium leading-snug text-foreground">
                      {entry.title}
                    </span>
                    {duration ? (
                      <span className="mt-0.5 block font-mono text-[10px] text-muted-foreground">
                        {duration}
                      </span>
                    ) : null}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      )}

      <p className="border-t border-border/50 px-3 py-1.5 text-[10px] text-muted-foreground dark:border-white/8">
        Selected items are added as separate single-video downloads (not the whole playlist URL).
      </p>
    </div>
  );
}
