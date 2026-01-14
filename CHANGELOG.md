# Changelog

## 0.2.0 - 2026-01-14
- Fixed Windows test runner stability by switching Vitest to threads pool.
- Fixed logs screen/tests issues found by project checks.
- Improved Windows downloads reliability by fixing tool spawning permissions (ACL).
- Improved system tool detection flow (auto-detect + success confirmation UI).
- Enabled background notifications for tool discovery and download success flow.
- Updated Tauri shell ACL to allow spawning required download tools.

## 0.1.0

- Initial Windows-first release (Tauri v2 + React/TS + Zustand).
- Tool management: bundled/system/custom resolution for yt-dlp, ffmpeg, aria2, deno.
- Persistence: settings and presets stored in app data using Tauri store plugin.
- Downloads: spawn external tools and stream merged stdout/stderr into logs UI.
- Packaging: Lite vs Full builds with sidecar/bundled tools strategy.
