# Tools Management (v1)

## Tool List
- yt-dlp (required)
- ffmpeg (recommended)
- aria2 (optional)
- Deno (optional JS runtime; Full includes it)

## Tool Modes
- Bundled (Full only)
- System (PATH)
- Custom path (user-selected)

## Detection Order
1. Bundled (if Full)
2. System PATH
3. Custom path (if configured)

## Behavior by Tool

### yt-dlp
- Required
- Full: update supported (in-app)
- Lite: may guide user for updates (optional v1)

### ffmpeg
- Recommended
- Lite: update button disabled, show guide only
- Full: bundled (update optional later)

### aria2
- Optional
- Lite: update button disabled, show guide only
- Full: bundled
- Toggle: “Use aria2 if available” (off by default)

### Deno
- Optional runtime
- Full: bundled, allow “Download/Replace” optional
- Lite: show guide + browse path

## Feature Enablement Rules
- Missing tools disable dependent features with clear UI notice
- Do not fail silently
- Always provide reason and guidance when disabled
