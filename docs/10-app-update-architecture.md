# App Update Architecture

## Current State

- App updates are currently discovered from the latest GitHub release.
- Tool updates already use checksum verification, but app updates do not yet self-install.
- Release artifacts already follow stable names:
  - `HalalDL-Full-vX.Y.Z-win10+11-x64.msi`
  - `HalalDL-Full-vX.Y.Z-win10+11-x64-setup.exe`
  - `HalalDL-Lite-vX.Y.Z-win10+11-x64.msi`
  - `HalalDL-Lite-vX.Y.Z-win10+11-x64-setup.exe`

## Detection Contract

App update selection needs two inputs:

1. Build mode
   - Source: `VITE_APP_MODE`
   - Values: `FULL` or `LITE`
2. Installer type
   - Source: Windows uninstall registry entries, with filesystem fallback
   - Values: `msi`, `nsis`, or `unknown`

The app now detects installer type by checking uninstall entries under:

- `HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall`
- `HKLM\Software\Microsoft\Windows\CurrentVersion\Uninstall`
- `HKLM\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall`

Detection rules:

- `WindowsInstaller=1` or `msiexec` in uninstall command => `msi`
- `unins*.exe`, `uninstall.exe`, or `nsis` markers in uninstall command => `nsis`
- No match => `unknown`

## Asset Selection

For the current repo, preferred asset selection is filename-based:

- `FULL + msi` => `HalalDL-Full-vX.Y.Z-win10+11-x64.msi`
- `FULL + nsis` => `HalalDL-Full-vX.Y.Z-win10+11-x64-setup.exe`
- `LITE + msi` => `HalalDL-Lite-vX.Y.Z-win10+11-x64.msi`
- `LITE + nsis` => `HalalDL-Lite-vX.Y.Z-win10+11-x64-setup.exe`

If installer type is `unknown`, the app should not guess a direct installer. It should fall back to the GitHub release page.

## Next Step

The next implementation slice should replace filename-only selection with a release manifest attached to each GitHub release. Suggested shape:

```json
{
  "version": "0.3.9",
  "publishedAt": "2026-03-13T00:00:00Z",
  "packages": [
    {
      "mode": "FULL",
      "installerType": "msi",
      "assetName": "HalalDL-Full-v0.3.9-win10+11-x64.msi",
      "url": "https://github.com/Asdmir786/HalalDL/releases/download/v0.3.9/HalalDL-Full-v0.3.9-win10+11-x64.msi",
      "sha256": "..."
    }
  ]
}
```

That manifest should become the single source of truth for:

- package selection
- checksum verification
- future silent install flow
