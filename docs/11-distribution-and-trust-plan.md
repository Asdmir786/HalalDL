# Distribution And Trust Plan

This is the current practical plan for getting HalalDL in front of more real Windows users while releases are still unsigned.

## Current Baseline

- Latest public release: `v0.5.0`
- Main installer signal: the Full setup EXE is the primary download path
- Trust state: releases are unsigned, so Windows SmartScreen may warn on first run
- Existing trust assets: public source, GitHub Actions release workflow, GitHub Releases, `SHA256SUMS.txt`, WinGet package ID

GitHub release download counts are **asset downloads**, not unique people. They are still useful as directional signal: if the Full setup EXE is much higher than Lite or Portable, the default user path is working.

## Immediate Priority

Make the install path boring and clear:

1. Recommend `HalalDL-Full-v[VERSION]-win10+11-x64-setup.exe` for most users.
2. Keep Lite and Portable visible, but secondary.
3. Put the SmartScreen explanation near every download path.
4. Put the SHA256 verification command near every download path.
5. Route all users back to GitHub Releases as the canonical download source.

## User-Facing Verification Copy

Use this language in README, release notes, website download pages, and install videos:

```text
HalalDL releases are currently unsigned, so Windows SmartScreen may warn on first run.
Download only from the official GitHub Releases page, then verify the file against SHA256SUMS.txt.
```

PowerShell command for the recommended build:

```powershell
Get-FileHash .\HalalDL-Full-v0.5.0-win10+11-x64-setup.exe -Algorithm SHA256
```

## Channel Order

1. **GitHub Releases**: canonical download source.
2. **WinGet**: already present; keep it current after every release.
3. **Scoop**: next best technical Windows package-manager channel. Scoop manifests require fields such as version, description, URL, and hash.
4. **Chocolatey**: useful trust bridge because packages are moderated, but expect review back-and-forth.
5. **AlternativeTo**: useful for users searching for alternatives to other `yt-dlp` GUIs.
6. **Reddit and YouTube**: use honest feedback and install/tutorial content, not hype.

## What Not To Do Yet

- Do not spend money on random cheap code signing until the provider clearly supports your legal identity and country.
- Do not assume code signing instantly removes SmartScreen. Microsoft says reputation still builds over time for signed apps.
- Do not make Microsoft Store the first distribution push for this app category.
- Do not market HalalDL as a way to violate platform terms. Keep the wording around authorized downloads, local-first workflow, presets, raw logs, and transparent tooling.

## Source Notes

- Microsoft SmartScreen reputation guidance: https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/smartscreen-reputation
- Scoop manifest guidance: https://github.com/ScoopInstaller/Scoop/wiki/App-Manifests
- Chocolatey moderation guidance: https://docs.chocolatey.org/en-us/community-repository/moderation/
- AlternativeTo: https://alternativeto.net/
