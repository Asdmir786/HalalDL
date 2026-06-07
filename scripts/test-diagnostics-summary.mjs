import assert from "node:assert/strict";

const { formatDiagnosticsSummary } = await import(
  "../src/lib/diagnostics-summary.ts"
);

const summary = formatDiagnosticsSummary({
  version: "0.5.1",
  mode: "FULL",
  packageLabel: "NSIS",
  osLabel: "Windows 11 x64",
  userAgent: "Mozilla/5.0 TestAgent",
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
});

assert.match(summary, /^HalalDL support info/m);
assert.match(summary, /Version: 0\.5\.1/);
assert.match(summary, /Mode: Full/);
assert.match(summary, /Package: NSIS/);
assert.match(summary, /OS: Windows 11 x64/);
assert.match(summary, /User agent: Mozilla\/5\.0 TestAgent/);
assert.match(summary, /Downloads running: 1/);
assert.match(summary, /History: 4 total, 3 completed, 1 failed/);
assert.match(summary, /- yt-dlp: 2026\.06\.01/);
assert.match(summary, /- FFmpeg: Missing/);
assert.doesNotMatch(summary, /Recent errors/);
assert.doesNotMatch(summary, /Detected,/);

const noErrors = formatDiagnosticsSummary({
  version: "unknown",
  mode: "LITE",
  packageLabel: "Package Unknown",
  osLabel: "Unknown OS",
  userAgent: "Unknown user agent",
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
assert.doesNotMatch(noErrors, /Recent errors/);
