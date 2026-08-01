# Chocolatey package: halaldl

Community package for the **Full** setup EXE (silent NSIS `/S`).

## Pack locally

```powershell
cd chocolatey
choco pack
```

## Push (after chocolatey.org account + API key)

```powershell
choco apikey --key YOUR_KEY --source https://push.chocolatey.org/
choco push halaldl.0.5.1.nupkg --source https://push.chocolatey.org/
```

Do not commit API keys. After push, watch moderation on https://community.chocolatey.org/packages/halaldl

## Update for a new release

1. Bump `<version>` in `halaldl.nuspec`
2. Update installer URL + `checksum64` in `tools/chocolateyInstall.ps1` from `SHA256SUMS.txt`
3. `choco pack` then `choco push`
