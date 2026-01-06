# Batch 7: Wiring & Persistence

## Overview
This batch moves HalalDL from a static UI to a functional, state-persisting application. It integrates the frontend with the Rust-based Tauri backend using the latest Tauri v2 plugin ecosystem.

## Implementation Decisions

### 1. Persistence Strategy: `tauri-plugin-store`
- **Rationale**: We chose `@tauri-apps/plugin-store` over raw `fs` writes for `settings.json` and `presets.json`.
- **Benefits**:
  - **Cross-Platform**: Automatically handles standard data directory resolution on Windows (`AppData`), macOS, and Linux.
  - **Simplicity**: Provides a key-value API (`get`, `set`, `save`) that maps well to our JSON requirements.
  - **Safety**: Abstraction layer prevents common file locking or path traversal issues.
- **Location**: Files are stored in the application's local data directory (e.g., `%LOCALAPPDATA%\com.halal.halaldl\`).

### 2. Tool Execution: `tauri-plugin-shell`
- **Rationale**: Executing external binaries (`yt-dlp`, `ffmpeg`) requires strict security sandboxing.
- **Configuration**:
  - We strictly scoped the `shell` capability to allow only specific binaries (`yt-dlp`, `ffmpeg`, `aria2c`).
  - **Auto-Detection**: The app checks the system `PATH` for these binaries on startup using the `--version` flag.

### 3. State Management Wiring: `PersistenceManager`
- **Rationale**: Instead of coupling persistence deeply into Zustand middleware (which can be opaque), we implemented a dedicated `PersistenceManager` component.
- **Mechanism**:
  - **Load**: On mount, it hydrates the Zustand stores from disk.
  - **Watch**: It subscribes to store changes and debounces writes to disk (500ms).
  - **Merge**: For Presets, it intelligently merges "Built-in" presets (from code) with "User" presets (from disk) to ensure updates to built-ins are propagated while preserving user data.

## Version-Specific Requirements

### Tauri v2
- **Plugins**: Must use the `@tauri-apps/plugin-*` namespace (NPM) and `tauri-plugin-*` (Cargo).
- **Capabilities**: Permissions must be explicitly defined in `src-tauri/capabilities`. We created a `shell.json` capability to allow binary execution.
- **Frontend**: Uses React 19 + TypeScript 5.9.

### Dependencies
- `@tauri-apps/plugin-store`: ~2.4.1
- `@tauri-apps/plugin-shell`: ~2.3.3
- `@tauri-apps/plugin-dialog`: ~2.4.2
- `@tauri-apps/plugin-fs`: ~2.4.4

## Testing Protocols

### 1. Persistence Verification
- **Test**: Change a setting (e.g., Theme to Dark), close the app, and reopen.
- **Expected**: Theme remains Dark. `settings.json` in AppData should reflect the change.

### 2. Tool Detection
- **Test**: Ensure `yt-dlp` is installed in `PATH`. Open the app.
- **Expected**: Tools Manager shows "Detected" with the correct version number.
- **Test**: Remove `ffmpeg` from `PATH`.
- **Expected**: Tools Manager shows "Missing" (red badge).

### 3. Presets Merging
- **Test**: Create a new user preset "My Preset". Close and reopen.
- **Expected**: "My Preset" exists alongside "Global Default" and "WhatsApp Optimized".

## Security Audit
- **Shell Scope**: Only `yt-dlp`, `ffmpeg`, and `aria2c` are allowed. Arbitrary command execution is blocked.
- **File System**: `plugin-store` is sandboxed to the app data directory. `plugin-fs` usage is minimal.

## Maintenance Guidelines
- **Adding New Tools**:
  1. Add the tool name to `src/store/tools.ts`.
  2. Add a check function in `src/lib/commands.ts`.
  3. Update `src-tauri/capabilities/shell.json` to allow execution.
- **Schema Changes**: If `Settings` interface changes, ensure backward compatibility in `PersistenceManager` loading logic (e.g., provide default values for new fields).
