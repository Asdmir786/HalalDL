import assert from "node:assert/strict";

const { formatDiagnosticsSummary } = await import(
  "../src/lib/diagnostics-summary.ts"
);

const summary = formatDiagnosticsSummary({
  version: "0.5.1",
  mode: "FULL",
  packageLabel: "NSIS",
  osLabel: "Windows 11 x64",
  activeDownloadCount: 1,
  history: {
    total: 4,
    completed: 3,
    failed: 1,
  },
  tools: [
    { name: "yt-dlp", status: "Detected", version: "2026.06.01" },
    { name: "FFmpeg", status: "Missing" },
  ],
  recentErrors: ["yt-dlp exited with code 1"],
});

assert.match(summary, /^HalalDL diagnostics/m);
assert.match(summary, /Version: 0\.5\.1/);
assert.match(summary, /Mode: Full/);
assert.match(summary, /Package: NSIS/);
assert.match(summary, /OS: Windows 11 x64/);
assert.match(summary, /Active downloads: 1/);
assert.match(summary, /History: 4 total, 3 completed, 1 failed/);
assert.match(summary, /- yt-dlp: Detected, 2026\.06\.01/);
assert.match(summary, /- FFmpeg: Missing/);
assert.match(summary, /Recent errors:\n- yt-dlp exited with code 1/);

const noErrors = formatDiagnosticsSummary({
  version: "unknown",
  mode: "LITE",
  packageLabel: "Package Unknown",
  osLabel: "Unknown OS",
  activeDownloadCount: 0,
  history: {
    total: 0,
    completed: 0,
    failed: 0,
  },
  tools: [],
  recentErrors: [],
});

assert.match(noErrors, /Mode: Lite/);
assert.match(noErrors, /Tools:\n- No tools loaded/);
assert.match(noErrors, /Recent errors:\n- No recent errors/);
