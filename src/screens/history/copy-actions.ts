import { type HistoryEntry } from "../../store/history.ts";
import { getExplicitOutputPaths } from "../../lib/output-paths.ts";

export type HistoryCopyState = {
  filteredCopyablePaths: string[];
  filteredCopyableEntryCount: number;
  selectedCopyablePaths: string[];
  selectedCopyableEntryCount: number;
};

function getCopyablePaths(
  entry: HistoryEntry,
  fileExistsMap: Record<string, boolean>
): string[] {
  if (entry.status !== "completed") return [];
  if (fileExistsMap[entry.id] !== true) return [];
  return getExplicitOutputPaths(entry);
}

function collectCopyable(
  entries: HistoryEntry[],
  fileExistsMap: Record<string, boolean>
) {
  const paths: string[] = [];
  let entryCount = 0;

  for (const entry of entries) {
    const entryPaths = getCopyablePaths(entry, fileExistsMap);
    if (entryPaths.length === 0) continue;
    paths.push(...entryPaths);
    entryCount += 1;
  }

  return { paths, entryCount };
}

export function buildHistoryCopyState({
  entries,
  filtered,
  selectedIds,
  fileExistsMap,
}: {
  entries: HistoryEntry[];
  filtered: HistoryEntry[];
  selectedIds: string[];
  fileExistsMap: Record<string, boolean>;
}): HistoryCopyState {
  const selectedSet = new Set(selectedIds);
  const selectedEntries = entries.filter((entry) => selectedSet.has(entry.id));
  const filteredCopyable = collectCopyable(filtered, fileExistsMap);
  const selectedCopyable = collectCopyable(selectedEntries, fileExistsMap);

  return {
    filteredCopyablePaths: filteredCopyable.paths,
    filteredCopyableEntryCount: filteredCopyable.entryCount,
    selectedCopyablePaths: selectedCopyable.paths,
    selectedCopyableEntryCount: selectedCopyable.entryCount,
  };
}
