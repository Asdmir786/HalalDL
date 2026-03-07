# Batch 8: Packaging Logic (Lite vs Full)

## Overview
HalalDL is designed to be distributed in two primary flavors:
1. **Lite**: A lightweight (<10MB) installer containing only the app shell. Users must provide their own `yt-dlp` and `ffmpeg`.
2. **Full**: A "batteries-included" app build that ensures required tools exist as app-managed binaries in the app data bin folder (`AppData/bin`).

This document outlines the configuration and logic required to switch between these modes during the build process.

## 2. Lite vs Full Implementation

We use a build-time flag to tell the frontend which mode it is:

### Strategy: Environment Variable & Scripting
We set `VITE_APP_MODE` when building.

#### Full Build
1. **Action**: Build with `VITE_APP_MODE=FULL`
2. **App Logic**: Full mode requires tools to exist in `AppData/bin` and prompts to install them if not.

#### Lite Build
1. **Action**: Build with `VITE_APP_MODE=LITE`
2. **App Logic**: Lite mode only requires `yt-dlp`; missing optional tools can be skipped.

## 3. Application Logic Integration

We use the `import.meta.env` to expose the build mode to the frontend.

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

Convenience scripts in `package.json`:

```json
{
  "scripts": {
    "build:lite": "cross-env VITE_APP_MODE=LITE pnpm tauri build",
    "build:full": "cross-env VITE_APP_MODE=FULL pnpm tauri build"
  }
}
```

## 5. NSIS Installer Configuration
For the "Full" version, the NSIS installer size will increase significantly (~100MB+).
- **Compression**: Ensure `lzma` compression is enabled in `tauri.conf.json` for maximum size reduction.
- **Install Mode**: Use `perMachine` if possible to avoid permission issues with executing sidecars from AppData.

## Checklist for Release
- [ ] Run `pnpm build:full` to generate the bundled installer.
- [ ] Run `pnpm build:lite` to generate the lightweight installer.
