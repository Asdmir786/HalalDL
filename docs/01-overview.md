# HalalDL – Overview (v1)

HalalDL is a lightweight, modern desktop GUI for yt-dlp, focused on speed, clarity, and reliability.

## Goals
- Fast startup and low memory usage
- Clean, modern UI without unnecessary complexity
- Preset-driven workflow
- Full transparency via raw yt-dlp logs
- Windows-first v1, cross-platform-ready architecture

## Non-Goals (v1)
- No built-in media player
- No account or login system
- No cloud sync
- No SQLite (JSON only)
- No macOS/Linux packaging in v1

## Releases
- HalalDL Lite: app only, user provides tools
- HalalDL Full: app + bundled tools

## Supported Tools
- yt-dlp (required)
- ffmpeg (recommended)
- aria2 (optional)
- Deno JS runtime (optional, included in Full)

## Core UX Principles
- Never hide raw output
- Disable features gracefully when tools are missing
- Defaults should be safe and beginner-friendly
