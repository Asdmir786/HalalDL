import assert from "node:assert/strict";

const { formatLineCount, formatLogLine, formatLogLines } = await import(
  "../src/screens/logs/log-actions.ts"
);

assert.equal(
  formatLogLine({
    timestamp: "2026-06-08T10:00:00.000Z",
    level: "error",
    message: "Download failed",
  }),
  "[2026-06-08T10:00:00.000Z] [ERROR] Download failed"
);

assert.equal(
  formatLogLine({
    timestamp: "2026-06-08T10:01:00.000Z",
    level: "command",
    message: "Running yt-dlp",
    command: "yt-dlp --version",
  }),
  "[2026-06-08T10:01:00.000Z] [COMMAND] Running yt-dlp | yt-dlp --version"
);

assert.equal(
  formatLogLines([
    { timestamp: "1", level: "info", message: "First" },
    { timestamp: "2", level: "warn", message: "Second", command: "ffmpeg" },
  ]),
  "[1] [INFO] First\n[2] [WARN] Second | ffmpeg"
);

assert.equal(formatLineCount(0), "0 lines");
assert.equal(formatLineCount(1), "1 line");
assert.equal(formatLineCount(2), "2 lines");
