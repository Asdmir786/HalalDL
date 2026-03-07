# Tools Management (v1)

## Tool List
- yt-dlp (required)
- ffmpeg (recommended)
- aria2 (optional)
- Deno (optional JS runtime)

## Tool Modes
- App-managed (downloaded into `AppData/bin`)
- System (PATH / OS install / pip)
- Manual (user-selected executable copied into `AppData/bin`)

## Detection Order
1. App-managed (`AppData/bin`)
2. System PATH

## Behavior by Tool

### yt-dlp
- Required
- Full: enforced app-managed copy (even if pip exists)
- Lite: required, app can install it into `AppData/bin`

### ffmpeg
- Recommended
- Full: enforced app-managed copy (installed into `AppData/bin`)
- Lite: optional, can be installed into `AppData/bin` or provided via PATH

### aria2
- Optional
- Full: enforced app-managed copy (installed into `AppData/bin`)
- Lite: optional, can be installed into `AppData/bin` or provided via PATH

### Deno
- Optional runtime
- Full: enforced app-managed copy (installed into `AppData/bin`)
- Lite: optional, can be installed into `AppData/bin` or provided via PATH

## Feature Enablement Rules
- Missing tools disable dependent features with clear UI notice
- Do not fail silently
- Always provide reason and guidance when disabled
