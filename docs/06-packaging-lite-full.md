# Packaging: Lite vs Full (Windows v1)

## Lite
- App only
- No bundled tools in the installer
- Tools can still be installed by the app into the app data bin folder (`AppData/bin`)
- Only `yt-dlp` is required; missing optional tools can be skipped

## Full
- App build configured as "FULL" at build time (`VITE_APP_MODE=FULL`)
- On first run, the app ensures tools exist in the app data bin folder (`AppData/bin`)
- If tools exist only on PATH (including pip `yt-dlp`), Full prompts to install app-managed copies

## Tool Location Rules (Windows v1)
- Preferred location: app data bin folder (`AppData/bin`)
- Tools are resolved in the app in this order:
  1. App-managed binaries (`AppData/bin`)
  2. System PATH / user-installed tools

## Update Safety (Full)
- Download new binary to temp
- Replace atomically
- Keep .old backup
- Never update while a job is running
