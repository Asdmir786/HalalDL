# Packaging: Full vs Lite vs Portable (Windows v1)

HalalDL currently ships three Windows release lanes. Keep the user-facing guidance simple: **Full setup EXE is the default recommendation**, Lite is for users who manage their own tools, and Portable is for no-install or locked-down setups.

## Full
- App build configured as "FULL" at build time (`VITE_APP_MODE=FULL`)
- Recommended for most users
- On first run, the app ensures tools exist in the app data bin folder (`AppData/bin`)
- If tools exist only on PATH (including pip `yt-dlp`), Full prompts to install app-managed copies

## Lite
- App only
- No bundled tools in the installer
- Tools can still be installed by the app into the app data bin folder (`AppData/bin`)
- Only `yt-dlp` is required; missing optional tools can be skipped

## Portable
- App build configured as "PORTABLE" at build time (`VITE_APP_MODE=PORTABLE`)
- Distributed as `HalalDL-Portable-v[VERSION]-win10+11-x64.zip`
- Keeps the app, marker file, state, thumbnails, archive, and managed tools beside the executable under `portable-data`
- Bundled tools live in `portable-data/bin`
- Portable installs do not self-update in place; they route users to GitHub Releases for manual ZIP replacement

## Tool Location Rules (Windows v1)
- Preferred location for installed builds: app data bin folder (`AppData/bin`)
- Preferred location for Portable: `portable-data/bin` beside the executable
- Tools are resolved in the app in this order:
  1. App-managed binaries (`AppData/bin`) or portable-managed binaries (`portable-data/bin`)
  2. System PATH / user-installed tools

## Update Safety
- Download new binary to temp
- Replace atomically
- Keep .old backup
- Never update while a job is running
- Portable updates are manual ZIP replacements from GitHub Releases
