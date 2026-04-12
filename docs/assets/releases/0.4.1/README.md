# HalalDL 0.4.1 Release Assets

This folder holds the reusable visual assets prepared for the `0.4.1` release.

## Promo Images

Use the files in [`promo/`](./promo) for GitHub release notes, the website, social posts, or the repository social preview:

- `hero-light.png` / `hero-dark.png` - release overview
- `quick-panel-light.png` / `quick-panel-dark.png` - compact quick download panel and issue #6
- `latest-glow-light.png` / `latest-glow-dark.png` - latest finished result marker and notification spotlight polish
- `download-details-light.png` / `download-details-dark.png` - total output size, duration, and clip mode
- `preset-filenames-light.png` / `preset-filenames-dark.png` - preset filename templates and issue #5
- `settings-fix-light.png` / `settings-fix-dark.png` - settings persistence fix and issue #7

`promo/promo-board.html` is the local board used to render the promo images.

## Screenshots

Use the files in [`screenshots/`](./screenshots) when you want straightforward feature captures instead of the release-note promo sequence:

- `downloads-result-details-light.png` / `downloads-result-details-dark.png`
- `quick-panel-compact-light.png` / `quick-panel-compact-dark.png`
- `preset-filename-template-light.png` / `preset-filename-template-dark.png`
- `settings-persistence-light.png` / `settings-persistence-dark.png`
- `latest-result-spotlight-light.png` / `latest-result-spotlight-dark.png`

## Suggested Placement

- GitHub release hero: `promo/hero-light.png` and `promo/hero-dark.png`
- Release body feature images: use the matching `*-light.png` and `*-dark.png` pairs
- Website changelog cards: `promo/quick-panel-light.png`, `promo/download-details-light.png`, `promo/settings-fix-light.png`
- Social preview candidates: `promo/hero-light.png` and `promo/hero-dark.png`

## Capture Workflow

Each image is rendered from `promo/promo-board.html` with a `capture` query parameter:

- `?capture=hero`
- `?capture=quick-panel`
- `?capture=latest-glow`
- `?capture=download-details`
- `?capture=preset-filenames`
- `?capture=settings-fix`

Add `&theme=light` or `&theme=dark` to render the separate theme variants.
