# Packaging: Lite vs Full (Windows v1)

## Lite
- App only
- No bundled tools
- Update buttons disabled for ffmpeg, aria2, deno
- Guides shown instead

## Full
- App + tools folder
- tools/
  ├─ yt-dlp/
  ├─ ffmpeg/
  ├─ aria2/
  └─ deno/

## Tool Location Rules (Windows v1)
- Prefer tools next to app executable in Full
- If installed in protected path, allow copying tools to AppData and update stored paths

## Update Safety (Full)
- Download new binary to temp
- Replace atomically
- Keep .old backup
- Never update while a job is running
