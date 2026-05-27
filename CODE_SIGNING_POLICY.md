# Code Signing Policy

HalalDL uses automated GitHub Actions workflows to build Windows release artifacts from the public source repository.

## Scope

This policy applies to HalalDL Windows release artifacts published from the official repository:

- `HalalDL-Full-...-setup.exe`
- `HalalDL-Full-....msi`
- `HalalDL-Lite-...-setup.exe`
- `HalalDL-Lite-....msi`
- `HalalDL-Portable-....zip`

## Source And Build Integrity

- Release artifacts must be built from the public `Asdmir786/HalalDL` source repository.
- Release builds must run through the repository's GitHub Actions release workflow.
- Release artifacts must match the version declared in the source tree for that release.
- SHA256 checksums are published with each GitHub Release.

## Signing Intent

HalalDL is currently working toward code signing for public Windows releases. Until signing is active, releases may trigger Windows SmartScreen because the project does not yet have a trusted publisher signature.

Once code signing is available, signed release artifacts should be produced by the automated release workflow and published to GitHub Releases only after signing succeeds.

## Verification

Users should download HalalDL only from the official GitHub Releases page or trusted package managers such as WinGet, and should verify release files against the published `SHA256SUMS.txt` file when needed.
