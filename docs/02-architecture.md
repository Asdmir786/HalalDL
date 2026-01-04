# Architecture (v1)

## Stack
- Tauri (Rust backend)
- React + TypeScript
- Vite
- TailwindCSS + shadcn/ui
- Zustand (state)
- TanStack Virtual (queue rendering)

## Process Model
- HalalDL spawns external binaries (yt-dlp, ffmpeg, aria2)
- No Node.js runtime required by the app
- Stdout and stderr are merged into a single log stream

## Data Storage
- JSON files only
- Stored in app data directory

## Performance Rules
- Throttle log UI updates (do not re-render on every line)
- Virtualize long lists (queue/history)
- Never block UI thread on process execution clearly

## Future Compatibility
- All paths and tool resolution must be platform-agnostic
- No hard-coded Windows-only logic outside packaging
