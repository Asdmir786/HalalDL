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

## Tool Location Rules
- Prefer tools next to app executable
- If not writable, copy to AppData and update paths automatically

## Update Safety
- Download new binary
- Verify basic integrity
- Replace atomically
- Keep .old backup
