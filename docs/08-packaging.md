# Batch 8: Packaging Logic (Lite vs Full)

## Overview
HalalDL is designed to be distributed in two primary flavors:
1. **Lite**: A lightweight (<10MB) installer containing only the app shell. Users must provide their own `yt-dlp` and `ffmpeg`.
2. **Full**: A "batteries-included" installer that bundles the necessary binaries (`yt-dlp.exe`, `ffmpeg.exe`) via Tauri's sidecar mechanism.

This document outlines the configuration and logic required to switch between these modes during the build process.

## 1. Sidecar Configuration (Tauri v2)

Tauri v2 uses the `externalBin` array in `tauri.conf.json` to define sidecars.

### Configuration Structure
In `src-tauri/tauri.conf.json`:
```json
"bundle": {
  "externalBin": [
    "binaries/yt-dlp",
    "binaries/ffmpeg",
    "binaries/aria2c"
  ]
}
```

### Binary Naming Convention
Tauri requires binaries to be placed in `src-tauri/binaries/` and named with the target triple suffix:
- `yt-dlp-x86_64-pc-windows-msvc.exe` (Windows)
- `ffmpeg-x86_64-pc-windows-msvc.exe` (Windows)

## 2. Lite vs Full Implementation

Since we cannot dynamically change `tauri.conf.json` at runtime, we use a build-time strategy:

### Strategy: Environment Variable & Scripting
We use a CI/CD script (or a local helper script) to modify `tauri.conf.json` before building.

#### Full Build (Bundled)
1. **Action**: Ensure `externalBin` is populated.
2. **Action**: Ensure binaries exist in `src-tauri/binaries/`.
3. **App Logic**: The app detects it is in "Full" mode (via a build flag) and defaults `Tools` to `Bundled` mode.

#### Lite Build (Standalone)
1. **Action**: Set `externalBin` to `[]` (empty array).
2. **Action**: Do not include binaries in the `binaries/` folder (saves space).
3. **App Logic**: The app defaults `Tools` to `Auto` or `Manual` mode and prompts the user to install tools if missing.

## 3. Application Logic Integration

We use the `import.meta.env` to expose the build mode to the frontend.

### `vite.config.ts`
Add a define to pass the mode:
```typescript
export default defineConfig({
  define: {
    __APP_MODE__: JSON.stringify(process.env.APP_MODE || 'LITE')
  }
})
```

### `src/store/tools.ts`
Initialize the store based on the mode:
```typescript
const IS_FULL_VERSION = import.meta.env.VITE_APP_MODE === 'FULL';

const INITIAL_TOOLS: Tool[] = [
  {
    id: "yt-dlp",
    mode: IS_FULL_VERSION ? "Bundled" : "Auto",
    // ...
  }
]
```

## 4. Packaging Scripts (package.json)

We will add convenience scripts to `package.json` to streamline this:

```json
{
  "scripts": {
    "build:lite": "cross-env APP_MODE=LITE pnpm tauri build",
    "build:full": "cross-env APP_MODE=FULL pnpm tauri build"
  }
}
```

## 5. NSIS Installer Configuration
For the "Full" version, the NSIS installer size will increase significantly (~100MB+).
- **Compression**: Ensure `lzma` compression is enabled in `tauri.conf.json` for maximum size reduction.
- **Install Mode**: Use `perMachine` if possible to avoid permission issues with executing sidecars from AppData.

## Checklist for Release
- [ ] Download latest `yt-dlp.exe` and `ffmpeg.exe`.
- [ ] Rename them with the correct target triple.
- [ ] Place them in `src-tauri/binaries/`.
- [ ] Run `pnpm build:full` to generate the bundled installer.
- [ ] Run `pnpm build:lite` to generate the lightweight installer.
