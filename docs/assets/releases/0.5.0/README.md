# HalalDL 0.5.0 Release Assets

This folder holds the reusable visual assets planned for the `0.5.0` release.

## Promo Images

Use the files in [`promo/`](./promo) for GitHub release notes, the website, social posts, or the repository social preview:

- `hero-light.png` / `hero-dark.png` - release overview and three-version lineup
- `portable-mode-light.png` / `portable-mode-dark.png` - portable package, local bundled tools, and manual update path
- `instagram-reliability-light.png` / `instagram-reliability-dark.png` - stronger Instagram fallback, previews, and metadata
- `archive-contact-sheets-light.png` / `archive-contact-sheets-dark.png` - archive, richer finished results, and contact sheet support

## Screenshots

Use the files in [`screenshots/`](./screenshots) when you want straightforward feature captures instead of the release-note promo sequence:

- `portable-tools-light.png` / `portable-tools-dark.png`
- `portable-about-light.png` / `portable-about-dark.png`
- `instagram-preview-light.png` / `instagram-preview-dark.png`
- `archive-history-light.png` / `archive-history-dark.png`

## Suggested Placement

- GitHub release hero: `promo/hero-light.png` and `promo/hero-dark.png`
- Release body feature images: use the matching `*-light.png` and `*-dark.png` pairs
- Website changelog cards: `promo/portable-mode-light.png`, `promo/instagram-reliability-light.png`, `promo/archive-contact-sheets-light.png`
- Social preview candidates: `promo/hero-light.png` and `promo/hero-dark.png`

## Capture Workflow

- Prefer a deterministic local generator or React-based promo board for the promo images.
- Keep light and dark variants separate.
- Visually inspect every image referenced in the release notes before tagging.
