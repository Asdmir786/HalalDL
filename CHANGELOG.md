# Changelog

## 0.3.5 - 2026-01-26
- **Logs**: Fixed log export/write failures caused by Windows ACL restrictions by writing via the Tauri backend.
- **Logs**: Added timestamped log export filenames for easier sharing and no overwrites.
- **Logs**: Hardened downloader output handling to avoid invalid UTF-8 sequence errors.
- **Logs**: Mirrored UI toast errors and background failures into the in-app logs for easier troubleshooting.
- **Tools**: Improved version/update logging and error visibility during tool checks, installs, and manual path staging.
- **Fixes**: Improved open/show-in-folder fallback logging and error reporting.

## 0.3.4 - 2026-01-24
- **UI/UX**: Revamped "Empty Queue" screen with a modern hero section, animated particles, and quick action cards.
- **UI/UX**: Modernized "Tool Setup" dialog (UpgradePrompt) with glassmorphism, smoother animations, and a cleaner aesthetic.
- **UX**: Added loading states to critical actions (Tool Setup, Presets Import/Export, Tools Status Check) for better responsiveness.
- **Presets**: Added "WhatsApp Optimized" preset (1080p, H.264) for easy social sharing.
- **Fixes**: Fixed "Congratulations" popup not showing by implementing persistence for tool installation success across restarts.
- **Fixes**: Fixed "Copy File" reliability by improving Windows clipboard integration and path handling.
- **Fixes**: Improved final output path detection and file URI decoding for copying.
- **Fixes**: Improved stdout/stderr handling for chunked output to avoid missing lines.
- **Fixes**: Fixed scrolling issues in the Preset selection menu.
- **Fixes**: Resolved ESLint errors in persistence and upgrade modules.

## 0.3.3 - 2026-01-20
- **Power Features**: Added "Auto-Copy File" to settings. Automatically copies the downloaded file to the clipboard upon completion.
- **Power Features**: Added "Copy File" context menu item to copy the downloaded file directly to the clipboard (like Windows Explorer).
- **Settings**: Improved "Restore Defaults" to show a detailed summary of what settings were reset.
- **Fixes**: Fixed missing "Copy File" and "Show in Explorer" context menu options by improving output parsing to reliably capture file paths.
- **Fixes**: Fixed Rust compiler warnings related to Windows clipboard integration.

## 0.3.2 - 2026-01-19
- **UI/UX**: Enhanced Downloads screen with a "Cinematic" glassmorphism design, smoother animations, and refined typography.
- **UI/UX**: Cleaned up download list items (removed redundant badges, improved layout).
- **Fixes**: Fixed "Show in Explorer" on Windows to correctly highlight the selected file.
- **Fixes**: Fixed black/missing thumbnails for non-YouTube sources (Instagram, TikTok, etc.) by improving metadata fetching.
- **Fixes**: Resolved React purity issues (ESLint errors) for better performance and stability.
- **Power Features**: Added "Paranoid Backup Mode" to auto-save download history.
- **Power Features**: Implemented Global Drag & Drop support for adding links from anywhere.
- **Power Features**: Added advanced Context Menu to downloads (Copy Link, View Logs, Show in Explorer, etc.).
- **UI/UX**: Added Taskbar Progress integration (green progress bar on app icon).
- **Settings**: Added enhanced Speed Limiter with unit selection (MB/s, KB/s, etc.).
- **Fixes**: Fixed blank screen crashes when navigating between Logs/Downloads during updates.
- **Fixes**: Fixed background color glitch when navigating from Logs.
- **Fixes**: Resolved text overlap issues in logs console.

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
