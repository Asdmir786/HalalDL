# HalalDL 0.4.1 Release Assets

This folder holds the reusable visual assets prepared for the `0.4.1` release.

## Promo Images

Use the files in [`promo/`](./promo) for GitHub release notes, the website, social posts, or the repository social preview:

- `hero.png` - release overview
- `quick-panel.png` - compact quick download panel and issue #6
- `latest-glow.png` - latest finished result marker and notification spotlight polish
- `download-details.png` - total output size, duration, and clip mode
- `preset-filenames.png` - preset filename templates and issue #5
- `settings-fix.png` - settings persistence fix and issue #7

`promo/promo-board.html` is the local board used to render the promo images.

## Screenshots

Use the files in [`screenshots/`](./screenshots) when you want straightforward feature captures instead of the release-note promo sequence:

- `downloads-result-details.png`
- `quick-panel-compact.png`
- `preset-filename-template.png`
- `settings-persistence.png`
- `latest-result-spotlight.png`

## Suggested Placement

- GitHub release hero: `promo/hero.png`
- Release body feature images: `promo/download-details.png`, `promo/quick-panel.png`, `promo/preset-filenames.png`, `promo/latest-glow.png`, `promo/settings-fix.png`
- Website changelog cards: `promo/quick-panel.png`, `promo/download-details.png`, `promo/settings-fix.png`
- Social preview candidate: `promo/hero.png`

## Capture Workflow

Each image is rendered from `promo/promo-board.html` with a `capture` query parameter:

- `?capture=hero`
- `?capture=quick-panel`
- `?capture=latest-glow`
- `?capture=download-details`
- `?capture=preset-filenames`
- `?capture=settings-fix`
