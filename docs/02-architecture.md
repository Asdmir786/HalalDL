# Architecture (v1)

## Stack
- Tauri v2 (Rust backend)
- React + TypeScript
- Vite
- TailwindCSS + shadcn/ui
- Zustand (state)
- TanStack Virtual (queue/history rendering)

## Process Model
- HalalDL spawns external binaries (yt-dlp, ffmpeg, aria2)
- No Node.js runtime required by the app
- Stdout and stderr are merged into a single log stream for logs UI

## Data Storage
- JSON files only
- Stored in the app data directory

## Performance Rules
- Throttle log UI updates (avoid re-render per line)
- Virtualize long lists (queue/history)
- Never block UI thread while process runs
- Parsing progress must be optional (raw logs always visible)

## Future Compatibility
- All tool resolution must be platform-agnostic by design
- Avoid Windows-only assumptions in core logic (only packaging is Windows-first)
