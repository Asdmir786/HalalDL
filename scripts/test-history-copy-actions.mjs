import assert from "node:assert/strict";

const { buildHistoryCopyState } = await import(
  "../src/screens/history/copy-actions.ts"
);

function entry(id, status, outputPath, outputPaths) {
  return {
    id,
    status,
    outputPath,
    outputPaths,
    title: id,
    url: `https://example.com/${id}`,
    presetId: "video-best",
    downloadedAt: Date.now(),
    domain: "example.com",
  };
}

const doneVisible = entry("done-visible", "completed", "C:\\Videos\\a.mp4");
const doneMulti = entry("done-multi", "completed", undefined, [
  "C:\\Videos\\b.mp4",
  "C:\\Videos\\b.srt",
]);
const missing = entry("missing", "completed", "C:\\Videos\\missing.mp4");
const failed = entry("failed", "failed", "C:\\Videos\\failed.mp4");
const hiddenSelected = entry("hidden-selected", "completed", "C:\\Videos\\hidden.mp4");

const entries = [doneVisible, doneMulti, missing, failed, hiddenSelected];
const filtered = [doneVisible, doneMulti, missing, failed];
const selectedIds = ["done-visible", "missing", "hidden-selected"];
const state = buildHistoryCopyState({
  entries,
  filtered,
  selectedIds,
  fileExistsMap: {
    "done-visible": true,
    "done-multi": true,
    missing: false,
    failed: true,
    "hidden-selected": true,
  },
});

assert.deepEqual(state.filteredCopyablePaths, [
  "C:\\Videos\\a.mp4",
  "C:\\Videos\\b.mp4",
  "C:\\Videos\\b.srt",
]);
assert.equal(state.filteredCopyableEntryCount, 2);
assert.deepEqual(state.selectedCopyablePaths, [
  "C:\\Videos\\a.mp4",
  "C:\\Videos\\hidden.mp4",
]);
assert.equal(state.selectedCopyableEntryCount, 2);
