# HalalDL 0.5.1 Release Assets

This folder holds the reusable visual assets prepared for the `0.5.1` release.

## Promo Images

Use the files in [`promo/`](./promo) for GitHub release notes, the website, social posts, or the repository social preview:

- `hero-light.png` / `hero-dark.png` - release overview for Trust And Feedback
- `trust-diagnostics-light.png` / `trust-diagnostics-dark.png` - Install Trust card and Copy Diagnostics
- `support-prompts-light.png` / `support-prompts-dark.png` - Star / Feedback / Not now after real usage
- `faster-startup-light.png` / `faster-startup-dark.png` - Performance settings and on-demand tool checks
- `brand-identity-light.png` / `brand-identity-dark.png` - Steel Blue + Mint official brand

## Screenshots

Use the files in [`screenshots/`](./screenshots) when you want straightforward feature captures instead of the release-note promo sequence:

- `about-trust-light.png` / `about-trust-dark.png`
- `support-prompt-light.png` / `support-prompt-dark.png`
- `settings-performance-light.png` / `settings-performance-dark.png`
- `brand-logo-light.png` / `brand-logo-dark.png`

## Suggested Placement

- GitHub release hero: `promo/hero-light.png` and `promo/hero-dark.png`
- Release body feature images: use the matching `*-light.png` and `*-dark.png` pairs
- Website changelog cards: `promo/trust-diagnostics-light.png`, `promo/faster-startup-light.png`, `promo/brand-identity-light.png`
- Social preview candidates: `promo/hero-light.png` and `promo/hero-dark.png`

## Capture Workflow

Generate all images with:

```bash
python docs/assets/releases/0.5.1/generate-images.py
```

Images use the locked Steel Blue + Mint palette from the app theme. Keep light and dark variants separate. Visually inspect every image referenced in the release notes before tagging.
