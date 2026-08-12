# HalalDL 0.6.0 Release Assets

This folder contains reproducible release visuals for **The Download, Organize & Create Update**. Every generated promo card uses the shipped HalalDL symbol from `src/assets/brand/`; light cards use `halaldl-symbol-light-background.png` and dark cards use `halaldl-symbol-dark-background.png`.

| Asset | Use |
| --- | --- |
| `hero-light.png`, `hero-dark.png` | Release-header story: choose, organize, create. |
| `playlist-light.png`, `playlist-dark.png` | Exact playlist selection and queue control. |
| `library-light.png`, `library-dark.png` | Editable YouTube follow and six-hour recommendation. |
| `doctor-light.png`, `doctor-dark.png` | Download Doctor recovery story. |
| `clips-light.png`, `clips-dark.png` | Local clip-making story. |
| `reliability-light.png`, `reliability-dark.png` | Optional reliability/polish story. |
| `screenshots/*.png` | Real rendered application proof images at 1000×600. Each pair is captured in light and dark themes. |

Generate narrative cards (requires Pillow):

```powershell
python docs/assets/releases/0.6.0/generate-images.py
```

Capture the proof images while the Vite app is running at `http://localhost:1420`:

```powershell
node scripts/capture-marketing-screenshots.mjs
```

The capture script uses `?demo=marketing`, fixed fictional data, and its `state` parameter. It never reads a real queue, cookie file, watchlist, or local media file. Review every PNG at normal size before committing or linking it from a release body.
