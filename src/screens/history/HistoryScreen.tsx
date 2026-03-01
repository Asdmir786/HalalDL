import { useCallback, useLayoutEffect, useMemo, useRef, useState, useEffect, type UIEvent } from "react";
import { useHistoryStore, type HistoryEntry } from "@/store/history";
import { useDownloadsStore } from "@/store/downloads";
import { useNavigationStore } from "@/store/navigation";
import { FadeInStagger } from "@/components/motion/StaggerContainer";
import { HistoryHeader, type StatusFilter, type DateFilter, type SortOrder, type ViewMode } from "./components/HistoryHeader";
import { HistoryItem } from "./components/HistoryItem";
import { HistoryGrid } from "./components/HistoryGrid";
import { HistoryInsights } from "./components/HistoryInsights";
import { DiskAwareness } from "./components/DiskAwareness";
import { SmartSuggestions } from "./components/SmartSuggestions";
import { HistoryExport } from "./components/HistoryExport";
import { exists, readDir } from "@tauri-apps/plugin-fs";
import { toast } from "sonner";
import { History as HistoryIcon } from "lucide-react";

type PathParts = {
  dir: string;
  base: string;
  ext: string;
  baseNoExt: string;
  sep: string;
};

function getPathParts(path: string): PathParts {
  const slashIdx = path.lastIndexOf("/");
  const backslashIdx = path.lastIndexOf("\\");
  const lastSepIdx = Math.max(slashIdx, backslashIdx);
  const sep = backslashIdx >= slashIdx ? "\\" : "/";
  const dir = lastSepIdx >= 0 ? path.slice(0, lastSepIdx) : "";
  const base = lastSepIdx >= 0 ? path.slice(lastSepIdx + 1) : path;
  const dotIdx = base.lastIndexOf(".");
  const ext = dotIdx > 0 ? base.slice(dotIdx + 1) : "";
  const baseNoExt = dotIdx > 0 ? base.slice(0, dotIdx) : base;
  return { dir, base, ext, baseNoExt, sep };
}

function buildPath(dir: string, sep: string, name: string) {
  if (!dir) return name;
  return `${dir}${sep}${name}`;
}

function stripAnsiSimple(input: string): string {
  let out = "";
  for (let i = 0; i < input.length; i++) {
    if (input.charCodeAt(i) === 27 && input[i + 1] === "[") {
      i += 2;
      while (i < input.length && input[i] !== "m") i++;
      continue;
    }
    out += input[i];
  }
  return out;
}

function stripFileUriPrefix(path: string): string {
  const lower = path.toLowerCase();
  if (!lower.startsWith("file:")) return path;

  let out = path.replace(/^file:\/\//i, "").replace(/^file:\//i, "");
  out = out.replace(/^localhost\//i, "");
  if (/^\/[a-zA-Z]:\//.test(out)) out = out.slice(1);

  try {
    out = decodeURIComponent(out);
  } catch {
    void 0;
  }

  return out;
}

function normalizeFsPath(path: string): string {
  const trimmed = path.trim();
  const unquoted =
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
      ? trimmed.slice(1, -1)
      : trimmed;
  let cleaned = stripAnsiSimple(unquoted).trim().replace(/[\r\n]/g, "");
  cleaned = stripFileUriPrefix(cleaned);
  const isWindows = navigator.userAgent.toLowerCase().includes("windows");
  return isWindows ? cleaned.replace(/\//g, "\\") : cleaned;
}

function isLikelyStaleOutput(entry: HistoryEntry): boolean {
  const outputPath = entry.outputPath ? normalizeFsPath(entry.outputPath) : "";
  if (!outputPath) return false;
  if (outputPath.endsWith(".part")) return true;
  if (outputPath.includes(".converting.")) return true;
  const { ext } = getPathParts(outputPath);
  const format = (entry.format ?? entry.overrides?.format ?? "").toLowerCase().trim();
  if (format && ext && ext.toLowerCase() !== format) return true;
  return false;
}

async function resolveAlternativePath(entry: HistoryEntry): Promise<string | null> {
  const outputPath = entry.outputPath ? normalizeFsPath(entry.outputPath) : "";
  if (!outputPath) return null;
  const { dir, base, baseNoExt, sep } = getPathParts(outputPath);
  const candidates = new Set<string>();

  if (base.endsWith(".part")) {
    candidates.add(outputPath.slice(0, -5));
  }
  if (outputPath.includes(".converting.")) {
    candidates.add(outputPath.replace(".converting.", "."));
  }

  const format = (entry.format ?? entry.overrides?.format ?? "").toLowerCase().trim();
  if (format && baseNoExt) {
    candidates.add(buildPath(dir, sep, `${baseNoExt}.${format}`));
  }

  for (const candidate of candidates) {
    try {
      if (candidate && await exists(candidate)) return candidate;
    } catch {
      void 0;
    }
  }

  if (dir && baseNoExt) {
    try {
      const items = await readDir(dir);
      const match = items.find((item) => {
        if (!item.name) return false;
        if (!item.name.startsWith(baseNoExt)) return false;
        return !item.name.endsWith(".part");
      });
      const matchPath = match?.name ? buildPath(dir, sep, match.name) : "";
      if (matchPath && await exists(matchPath)) return matchPath;
    } catch {
      void 0;
    }
  }

  return null;
}

function matchesDateFilter(entry: HistoryEntry, filter: DateFilter): boolean {
  if (filter === "all") return true;
  const now = Date.now();
  const ts = entry.downloadedAt;
  if (filter === "24h") return now - ts < 24 * 60 * 60 * 1000;
  if (filter === "today") {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    return ts >= startOfDay.getTime();
  }
  if (filter === "week") return now - ts < 7 * 24 * 60 * 60 * 1000;
  if (filter === "month") return now - ts < 30 * 24 * 60 * 60 * 1000;
  return true;
}

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

export function HistoryScreen() {
  const entries = useHistoryStore((s) => s.entries);
  const setEntries = useHistoryStore((s) => s.setEntries);
  const removeEntry = useHistoryStore((s) => s.removeEntry);
  const clearHistory = useHistoryStore((s) => s.clearHistory);
  const addJob = useDownloadsStore((s) => s.addJob);
  const setScreen = useNavigationStore((s) => s.setScreen);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [insightsExpanded, setInsightsExpanded] = useState(false);
  const [hideMissing, setHideMissing] = useState(false);
  const [groupByDomain, setGroupByDomain] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollTopRef = useRef(0);
  const fileCheckRetryRef = useRef<Record<string, number>>({});
  const retryTimeoutRef = useRef<number | null>(null);
  const resolveAttemptRef = useRef<Record<string, string | undefined>>({});

  // Track file existence for visible entries
  const [fileExistsMap, setFileExistsMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    if (retryTimeoutRef.current) {
      window.clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    const activeIds = new Set(entries.map((e) => e.id));
    for (const id of Object.keys(fileCheckRetryRef.current)) {
      if (!activeIds.has(id)) delete fileCheckRetryRef.current[id];
    }
    for (const id of Object.keys(resolveAttemptRef.current)) {
      if (!activeIds.has(id)) delete resolveAttemptRef.current[id];
    }

    const resetIds: string[] = [];
    for (const entry of entries) {
      const attemptedFor = resolveAttemptRef.current[entry.id];
      if (
        fileExistsMap[entry.id] === false &&
        isLikelyStaleOutput(entry) &&
        attemptedFor !== entry.outputPath
      ) {
        resolveAttemptRef.current[entry.id] = entry.outputPath;
        fileCheckRetryRef.current[entry.id] = 0;
        resetIds.push(entry.id);
      }
    }
    const candidates = entries.filter((e) => e.outputPath && e.status === "completed");
    const MAX_RETRIES = 3;
    const toCheck = candidates.filter(
      (e) =>
        fileExistsMap[e.id] !== true &&
        (fileCheckRetryRef.current[e.id] ?? 0) < MAX_RETRIES
    );

    if (toCheck.length === 0) return;

    const check = async () => {
      if (resetIds.length > 0) {
        setFileExistsMap((prev) => {
          const next = { ...prev };
          for (const id of resetIds) delete next[id];
          return next;
        });
      }
      const results = await Promise.all(
        toCheck.map(async (entry) => {
          try {
            const normalizedPath = normalizeFsPath(entry.outputPath!);
            const ex = normalizedPath ? await exists(normalizedPath) : false;
            if (ex) {
              return {
                id: entry.id,
                exists: true,
                resolvedPath: normalizedPath !== entry.outputPath ? normalizedPath : undefined
              };
            }
            const resolvedPath = await resolveAlternativePath(entry);
            if (resolvedPath) return { id: entry.id, exists: true, resolvedPath };
            return { id: entry.id, exists: false };
          } catch {
            return { id: entry.id, exists: false };
          }
        })
      );

      if (cancelled) return;

      const resolvedMap = new Map<string, string>();
      for (const r of results) {
        if (r.resolvedPath) {
          resolvedMap.set(r.id, r.resolvedPath);
        }
      }
      if (resolvedMap.size > 0) {
        setEntries(
          entries.map((entry) => {
            const resolved = resolvedMap.get(entry.id);
            return resolved ? { ...entry, outputPath: resolved } : entry;
          })
        );
      }

      let shouldRetry = false;
      for (const r of results) {
        if (r.exists) {
          delete fileCheckRetryRef.current[r.id];
          continue;
        }
        const nextCount = (fileCheckRetryRef.current[r.id] ?? 0) + 1;
        fileCheckRetryRef.current[r.id] = nextCount;
        if (nextCount < MAX_RETRIES) shouldRetry = true;
      }

      setFileExistsMap((prev) => {
        const next = { ...prev };
        for (const r of results) {
          if (r.exists) {
            next[r.id] = true;
            continue;
          }
          const retries = fileCheckRetryRef.current[r.id] ?? 0;
          if (retries >= MAX_RETRIES) {
            next[r.id] = false;
          }
        }
        return next;
      });

      if (shouldRetry) {
        retryTimeoutRef.current = window.setTimeout(check, 2000);
      }
    };

    void check();

    return () => {
      cancelled = true;
      if (retryTimeoutRef.current) {
        window.clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
    };
  }, [entries, fileExistsMap, setEntries]);

  const filtered = useMemo(() => {
    let result = entries;

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (e) => e.title.toLowerCase().includes(q) || e.url.toLowerCase().includes(q)
      );
    }

    if (statusFilter !== "all") {
      result = result.filter((e) => e.status === statusFilter);
    }

    result = result.filter((e) => matchesDateFilter(e, dateFilter));

    if (hideMissing) {
      result = result.filter((e) => !(e.outputPath && fileExistsMap[e.id] === false));
    }

    if (sortOrder === "oldest") {
      result = [...result].sort((a, b) => a.downloadedAt - b.downloadedAt);
    } else if (sortOrder === "largest") {
      result = [...result].sort((a, b) => (b.fileSize ?? 0) - (a.fileSize ?? 0));
    }
    // "newest" is default order (entries are prepended)

    return result;
  }, [entries, search, statusFilter, dateFilter, sortOrder, hideMissing, fileExistsMap]);

  const selectedIdsFiltered = useMemo(
    () => selectedIds.filter((id) => entries.some((e) => e.id === id)),
    [selectedIds, entries]
  );

  const selectedIdsSet = useMemo(() => new Set(selectedIdsFiltered), [selectedIdsFiltered]);

  const groupedEntries = useMemo(() => {
    if (!groupByDomain) return [];
    const map = new Map<string, HistoryEntry[]>();
    for (const entry of filtered) {
      const key = entry.domain || "Unknown";
      const group = map.get(key) ?? [];
      group.push(entry);
      map.set(key, group);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered, groupByDomain]);

  const handleClearAll = useCallback(() => {
    if (entries.length === 0) return;
    clearHistory();
    toast.success("History cleared");
  }, [entries.length, clearHistory]);

  const handleRemove = useCallback((id: string) => {
    removeEntry(id);
    toast.success("Removed from history");
  }, [removeEntry]);

  const handleToggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedIds([]);
  }, []);

  const handleSelectAllFiltered = useCallback(() => {
    setSelectedIds(filtered.map((e) => e.id));
  }, [filtered]);

  const handleBulkRedownload = useCallback(() => {
    if (selectedIdsFiltered.length === 0) return;
    const selectedEntries = entries.filter((e) => selectedIdsFiltered.includes(e.id));
    selectedEntries.forEach((entry) => {
      addJob(entry.url, entry.presetId, entry.overrides);
    });
    setScreen("downloads");
    toast.success(`Queued ${selectedEntries.length} download${selectedEntries.length === 1 ? "" : "s"}`);
  }, [addJob, entries, selectedIdsFiltered, setScreen]);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = scrollTopRef.current;
  });

  const handleScroll = (event: UIEvent<HTMLDivElement>) => {
    scrollTopRef.current = event.currentTarget.scrollTop;
  };

  return (
    <div className="flex flex-col h-full bg-background max-w-6xl mx-auto w-full" role="main">
      <FadeInStagger className="flex flex-col h-full">
        <div className="p-8 pb-4">
          <HistoryHeader
            totalCount={entries.length}
            search={search}
            onSearchChange={setSearch}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            dateFilter={dateFilter}
            onDateFilterChange={setDateFilter}
            sortOrder={sortOrder}
            onSortOrderChange={setSortOrder}
            hideMissing={hideMissing}
            onHideMissingChange={setHideMissing}
            groupByDomain={groupByDomain}
            onGroupByDomainChange={setGroupByDomain}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            onClearAll={handleClearAll}
          >
            {selectedIdsFiltered.length > 0 && (
              <>
                <button
                  onClick={handleSelectAllFiltered}
                  className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-muted"
                >
                  Select all
                </button>
                <button
                  onClick={handleClearSelection}
                  className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-muted"
                >
                  Clear
                </button>
              </>
            )}
            <button
              onClick={handleBulkRedownload}
              disabled={selectedIdsFiltered.length === 0}
              className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${
                selectedIdsFiltered.length === 0
                  ? "text-muted-foreground/60 bg-muted/40 cursor-not-allowed"
                  : "bg-primary text-primary-foreground hover:bg-primary/90"
              }`}
            >
              Re-download selected {selectedIdsFiltered.length > 0 ? `(${selectedIdsFiltered.length})` : ""}
            </button>
            <HistoryExport entries={entries} />
          </HistoryHeader>
        </div>

        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 overflow-auto px-8 pb-8"
        >
          {entries.length > 0 && (
            <div className="flex flex-col gap-3 mb-4">
              <HistoryInsights entries={entries} expanded={insightsExpanded} onToggle={() => setInsightsExpanded((p) => !p)} />
              {insightsExpanded && (
                <>
                  <DiskAwareness entries={entries} fileExistsMap={fileExistsMap} />
                  <SmartSuggestions entries={entries} />
                </>
              )}
            </div>
          )}
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <HistoryIcon className="w-12 h-12 text-muted-foreground/30 mb-3" />
              <p className="text-lg font-medium text-muted-foreground/60">
                {entries.length === 0 ? "No archived downloads yet" : "No results match your filters"}
              </p>
              <p className="text-sm text-muted-foreground/40 mt-1">
                {entries.length === 0
                  ? "Completed and failed downloads will be saved here."
                  : "Try adjusting your search or filter criteria."}
              </p>
            </div>
          ) : groupByDomain ? (
            <div className={viewMode === "list" ? "flex flex-col gap-4" : "flex flex-col gap-8"}>
              {groupedEntries.map(([domain, entriesForDomain]) => (
                <div key={domain} className="flex flex-col gap-2">
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground px-1">
                    {domain} • {entriesForDomain.length}
                  </div>
                  <div className={viewMode === "list" ? "flex flex-col gap-2" : "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4"}>
                    {entriesForDomain.map((entry) => (
                      viewMode === "list" ? (
                        <HistoryItem
                          key={entry.id}
                          entry={entry}
                          onRemove={handleRemove}
                          fileExists={fileExistsMap[entry.id] ?? null}
                          formatRelativeTime={formatRelativeTime}
                          isSelected={selectedIdsSet.has(entry.id)}
                          onToggleSelection={handleToggleSelection}
                        />
                      ) : (
                        <HistoryGrid
                          key={entry.id}
                          entry={entry}
                          onRemove={handleRemove}
                          fileExists={fileExistsMap[entry.id] ?? null}
                          formatRelativeTime={formatRelativeTime}
                          isSelected={selectedIdsSet.has(entry.id)}
                          onToggleSelection={handleToggleSelection}
                        />
                      )
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className={viewMode === "list" ? "flex flex-col gap-2" : "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4"}>
              {filtered.map((entry) => (
                viewMode === "list" ? (
                  <HistoryItem
                    key={entry.id}
                    entry={entry}
                    onRemove={handleRemove}
                    fileExists={fileExistsMap[entry.id] ?? null}
                    formatRelativeTime={formatRelativeTime}
                    isSelected={selectedIdsSet.has(entry.id)}
                    onToggleSelection={handleToggleSelection}
                  />
                ) : (
                  <HistoryGrid
                    key={entry.id}
                    entry={entry}
                    onRemove={handleRemove}
                    fileExists={fileExistsMap[entry.id] ?? null}
                    formatRelativeTime={formatRelativeTime}
                    isSelected={selectedIdsSet.has(entry.id)}
                    onToggleSelection={handleToggleSelection}
                  />
                )
              ))}
            </div>
          )}
        </div>
      </FadeInStagger>
    </div>
  );
}
