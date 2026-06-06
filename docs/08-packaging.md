# Packaging Logic (Full vs Lite vs Portable)

## Overview
HalalDL is distributed in three Windows lanes:

1. **Full**: Recommended for most users. The app manages required tools in the app data bin folder (`AppData/bin`).
2. **Lite**: Lightweight installer for power users who want to provide or manage their own `yt-dlp`, `ffmpeg`, `aria2`, and optional runtime pieces.
3. **Portable**: ZIP package for no-install or locked-down setups. The app, state, thumbnails, archive, and managed tools live beside the executable under `portable-data`.

This document outlines the configuration and logic required to switch between these modes during the build process.

## 2. Mode Implementation

We use a build-time flag to tell the frontend which mode it is:

### Strategy: Environment Variable & Scripting
We set `VITE_APP_MODE` when building.

#### Full Build
1. **Action**: Build with `VITE_APP_MODE=FULL`
2. **App Logic**: Full mode requires tools to exist in `AppData/bin` and prompts to install them if not.

#### Lite Build
1. **Action**: Build with `VITE_APP_MODE=LITE`
2. **App Logic**: Lite mode only requires `yt-dlp`; missing optional tools can be skipped.

#### Portable Build
1. **Action**: Build with `VITE_APP_MODE=PORTABLE`
2. **App Logic**: Portable mode resolves tools and data under `portable-data` beside the executable.
3. **Package Logic**: `scripts/package-portable.js` stages the app, writes the portable marker, bundles tools into `portable-data/bin`, and creates the ZIP under `out/`.

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
    "build:lite": "cross-env VITE_APP_MODE=LITE pnpm tauri build && node scripts/rename-release.js LITE",
    "build:full": "cross-env VITE_APP_MODE=FULL pnpm tauri build && node scripts/rename-release.js FULL",
    "build:portable": "cross-env VITE_APP_MODE=PORTABLE pnpm tauri build --no-bundle && node scripts/package-portable.js",
    "build:all": "pnpm build:lite && pnpm build:full && pnpm build:portable"
  }
}
```

## 5. NSIS Installer Configuration
For the "Full" version, the NSIS installer size will increase significantly (~100MB+).
- **Compression**: Ensure `lzma` compression is enabled in `tauri.conf.json` for maximum size reduction.
- **Install Mode**: Use `perMachine` if possible to avoid permission issues with executing sidecars from AppData.

## Checklist for Release
- [ ] Run `pnpm build:full` to generate the recommended installed build.
- [ ] Run `pnpm build:lite` to generate the power-user installed build.
- [ ] Run `pnpm build:portable` to generate the no-install ZIP build.
- [ ] Confirm release asset names match the README and release notes.
- [ ] Confirm `SHA256SUMS.txt` includes every file in `out/`.
