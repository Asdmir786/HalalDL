# HalalDL 0.4.0 Release Assets

This folder holds the reusable visual assets prepared for the `0.4.0` release.

## Screenshots

Use the files in [`screenshots/`](./screenshots) for straightforward product captures:

- `downloads.png`
- `downloads-dark.png`
- `presets.png`
- `tools.png`
- `tools-dark.png`
- `logs.png`
- `history.png`
- `history-dark.png`
- `settings.png`
- `settings-dark.png`
- `about-update.png`
- `about-update-dark.png`
- `behavior-settings.png`
- `behavior-tray-lower.png`
- `behavior-tray-lower-dark.png`

## Promo Images

Use the files in [`promo/`](./promo) for GitHub release notes, the website, or social posts:

- `hero.png`
- `hero-dark.png`
- `quick-flow.png`
- `quick-flow-dark.png`
- `subtitle-presets.png`
- `subtitle-presets-dark.png`
- `downloads-refresh.png`
- `downloads-refresh-dark.png`
- `history-refresh.png`
- `history-refresh-dark.png`
- `update-flow.png`
- `update-flow-dark.png`
- `notification-spotlight.png`
- `notification-spotlight-dark.png`

`promo/promo-board.html` is the local board used to render the promo images from the screenshots above.

## Suggested Placement

Based on the current `halaldl.vercel.app` structure:

- Homepage hero: `promo/hero.png`
- Homepage hero dark mode: `promo/hero-dark.png`
- Homepage feature grid or carousel: `promo/quick-flow.png`, `promo/subtitle-presets.png`, `promo/downloads-refresh.png`, `promo/history-refresh.png`
- Homepage feature grid or carousel dark mode: `promo/quick-flow-dark.png`, `promo/subtitle-presets-dark.png`, `promo/downloads-refresh-dark.png`, `promo/history-refresh-dark.png`
- Changelog or release highlight section: `promo/update-flow.png`
- Changelog or release highlight dark mode: `promo/update-flow-dark.png`
- Notification routing showcase: `promo/notification-spotlight.png`
- Notification routing showcase dark mode: `promo/notification-spotlight-dark.png`
- Download or install pages: `screenshots/about-update.png` or `screenshots/downloads.png`
- Theme-aware product sections: pair `screenshots/downloads.png` with `screenshots/downloads-dark.png`, `screenshots/history.png` with `screenshots/history-dark.png`, and `screenshots/about-update.png` with `screenshots/about-update-dark.png`

## Demo Capture Workflow

The seeded browser demo mode is there so release screenshots can be regenerated without touching real user data.

- Run the app in the browser with `?demo=marketing`
- Pick a screen with `?screen=downloads|presets|tools|logs|history|settings`
- Pick a theme with `?theme=light|dark`
- Example: `http://127.0.0.1:1420/?demo=marketing&screen=downloads&theme=dark`

The promo board also supports theme variants:

- Light: `http://127.0.0.1:4177/promo/promo-board.html`
- Dark: `http://127.0.0.1:4177/promo/promo-board.html?theme=dark`
