# Plan: Tool Download Checksum Verification

## Goal

Verify downloaded tool artifacts when a reliable checksum is available, and skip with a clear warning when it is not, without blocking installs.

## Scope

- Add checksum validation for ffmpeg, yt-dlp, and deno downloads.
- Deno verification uses the extracted binary checksum.
- aria2 skips checksum validation when upstream does not provide a checksum.
- Error messages explain mismatch causes and remediation steps.

## Steps

1. Add checksum policy notes and per-tool verification rules.
2. Implement checksum fetch + validation for yt-dlp and ffmpeg download flows.
3. Verify deno via extracted binary checksum instead of zip checksum.
4. Add a warning path for aria2 when checksum is unavailable.
5. Run pnpm check.
