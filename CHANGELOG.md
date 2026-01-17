# Changelog

## 0.3.2 - 2026-01-18
- **Power Features**: Added "Paranoid Backup Mode" to auto-save download history.
- **Power Features**: Implemented Global Drag & Drop support for adding links from anywhere.
- **Power Features**: Added advanced Context Menu to downloads (Copy Link, View Logs, Show in Explorer, etc.).
- **UI/UX**: Added Taskbar Progress integration (green progress bar on app icon).
- **UI/UX**: Added Rich Thumbnail previews for downloads.
- **Settings**: Added enhanced Speed Limiter with unit selection (MB/s, KB/s, etc.).
- **Fixes**: Fixed "Show in Explorer" not selecting the file on Windows.
- **Fixes**: Fixed blank screen crashes when navigating between Logs/Downloads during updates.
- **Fixes**: Fixed background color glitch when navigating from Logs.

## 0.3.1 - 2026-01-17
- **Settings**: Added persistent "Restore Defaults" and granular "Reset" options for appearance, storage, behavior, and download engine.
- **Settings**: Improved header layout with responsive buttons (prevented cramping on smaller screens).
- **Sidebar**: Added active downloads badge and progress indicator that auto-hides when idle.
- **Logs**: Revamped UI with a modern dark terminal theme, syntax highlighting for commands, and a status bar.
- **Logs**: Fixed scrolling behavior (removed scroll-smooth interference, improved stick-to-bottom logic) and added an auto-scroll toggle.
- **Tools**: Restyled Lite Mode notice to be a subtle note instead of a warning.

## 0.3.0 - 2026-01-16
- Modernized UI across all screens with glassmorphism, staggered animations, and motion buttons.
- Updated sidebar styling and alignment for consistent navigation visuals.
- Improved tool/setup dialogs with glass styling and consistent card surfaces.
- Fixed motion container typing/return issues to ensure animations render correctly.

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
