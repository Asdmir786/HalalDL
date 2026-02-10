# Tauri + React + Typescript

This template should help get you started developing with Tauri, React and Typescript in Vite.

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

## Build Cache (Rust)

The project auto-uses `sccache` for Rust/Tauri commands when `sccache` is installed and available in `PATH`.

- If `sccache` exists: Rust compiles run with `RUSTC_WRAPPER=sccache`
- If `sccache` is missing: commands fall back to normal `cargo` behavior

This applies to:

- `pnpm cargo:check`
- `pnpm tauri ...` (including `pnpm build:lite` and `pnpm build:full`)
