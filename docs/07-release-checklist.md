# Release Checklist

## Before Release

- `pnpm lint`
- `pnpm typecheck`
- `pnpm build`
- `pnpm cargo:check`
- Verify core screens still work
- Verify Lite vs Full packaging still behaves as expected
- Confirm installer names match the README and release template

## Release Assets

- `HalalDL-Full-v[VERSION]-win10+11-x64-setup.exe`
- `HalalDL-Lite-v[VERSION]-win10+11-x64-setup.exe`
- Optional MSI variants if still distributed
- `SHA256SUMS.txt`

## Release Notes

Use [RELEASE_TEMPLATE.md](./RELEASE_TEMPLATE.md) and include:

- What changed
- Who the release is for
- Full vs Lite guidance
- Checksum verification note
- Known limitations
- Upgrade notes

## Post-Release

- Verify the latest release page opens and downloads correctly
- Verify `SHA256SUMS.txt` is attached
- Check GitHub Insights baseline numbers
- Post the release announcement and social update from [github-launch-kit.md](./github-launch-kit.md)
