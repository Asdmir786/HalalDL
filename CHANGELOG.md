# Changelog

## 0.3.6 - 2026-02-15
- **Downloads**: Completely reworked fallback download logic — fallback now downloads the best available quality with yt-dlp first, then runs a separate FFmpeg conversion step to match the preset's intended codec/container (e.g. H.264 + AAC for WhatsApp). Much simpler and more reliable than the previous in-pipeline approach.
- **Downloads**: Fixed WhatsApp-incompatible output when using the "WhatsApp Optimized" preset on sites like Instagram — videos with VP9 codecs are now properly converted to H.264/AAC/MP4 with `yuv420p` and `faststart`.
- **Downloads**: Added indeterminate (sliding) progress bar and "Converting..." label during FFmpeg post-processing, replacing the stale percentage that used to freeze.
- **Thumbnails**: Fixed Instagram/TikTok thumbnail loading failures by replacing the unreliable yt-dlp generic extractor with a direct HTTP download via the Rust backend (`reqwest`).
- **Thumbnails**: Fixed a React rendering bug where failed thumbnails would permanently hide (DOM `display:none`) even if a valid URL was later available — now uses proper React state.
- **Thumbnails**: Removed the "Thumbnail: Unavailable" status text from the download list UI.
- **Tools**: Added **rollback/revert** — after updating a tool, the previous version is kept as a `.old` backup. You can revert to it or delete it from the Tools screen dropdown menu.
- **Tools**: Added "Clean up backups" header button to delete all `.old` backup files at once.
- **Tools**: Backup status is now checked on app startup and after every install/update, so revert/cleanup options always reflect the current state.
- **Tools**: Redesigned the Tools screen with a streamlined UI — clearer update flow, progress modal for installs/updates, variant detection (pip vs GitHub for yt-dlp, full vs essentials for FFmpeg), and smart update behavior per mode (Lite redirects, Full downloads directly).
- **Tools**: All tool statuses are now refreshed on app startup to fix stale UI edge cases (e.g. showing "Update" when already on the latest version).
- **Backend**: Added `download_url_to_file` Rust command for reliable direct HTTP downloads (used for thumbnails).
- **Backend**: Added `rename_file` Rust command for safe file swaps during FFmpeg conversion.
- **Backend**: Added rollback commands: `list_tool_backups`, `rollback_tool`, `cleanup_tool_backup`, `cleanup_all_backups`.
- **Backend**: Fixed `process|restart` ACL error by adding the permission to Tauri capabilities.
- **UX**: Double-clicking a download list item now opens the file directly.

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
