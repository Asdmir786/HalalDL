# Tools Management (v1)

## Tool List
- yt-dlp (required)
- ffmpeg (recommended)
- aria2 (optional)
- Deno (optional JS runtime)

## Tool Modes
- Bundled (Full only)
- System (PATH)
- Custom path

## Detection Order
1. Bundled (if Full)
2. System PATH
3. Custom path (user-selected)

## Behavior by Tool

### yt-dlp
- Always required
- Update allowed in Full
- Lite may guide user

### ffmpeg
- Recommended
- Lite: no update button, guide only
- Full: bundled, update optional later

### aria2
- Optional
- Disabled by default
- Toggle: “Use aria2 if available”

### Deno
- Optional runtime
- Included in Full
- Lite: guide + browse to exe

## Feature Enablement
- Missing tools disable dependent features with UI notice
- No hard failures without explanation
