# HalalDL

A modern, powerful, and privacy-focused media downloader.

## Features

- **Downloads**: High-quality video and audio downloads from various platforms.
- **History**: Keep track of your downloads with a built-in media library.
- **Tools**: Automatic management of yt-dlp, ffmpeg, and other dependencies.
- **Presets**: Customizable download presets for different devices and formats.
- **Privacy**: Local-first architecture with no tracking.

## Tech Stack

- [Tauri](https://tauri.app/) (v2)
- [React](https://react.dev/)
- [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vitejs.dev/)
- [Tailwind CSS](https://tailwindcss.com/)
- [shadcn/ui](https://ui.shadcn.com/)

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

## Build Cache (Rust)

The project auto-uses `sccache` for Rust/Tauri commands when `sccache` is installed and available in `PATH`.

- If `sccache` exists: Rust compiles run with `RUSTC_WRAPPER=sccache`
- If `sccache` is missing: commands fall back to normal `cargo` behavior

This applies to:

- `pnpm cargo:check`
- `pnpm tauri ...` (including `pnpm build:lite` and `pnpm build:full`)
