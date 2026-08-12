/**
 * Capture HalalDL marketing screenshots at 1000×600 via marketing demo mode.
 *
 * Prerequisites:
 *   1. pnpm dev (http://localhost:1420)
 *   2. Playwright available, e.g.:
 *        pnpm --dir tmp-playwright-capture exec node ../../scripts/capture-marketing-screenshots.mjs
 *      or from tmp-playwright-capture after `pnpm add playwright`
 *
 * Usage:
 *   node scripts/capture-marketing-screenshots.mjs
 */
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, "../docs/assets/releases/0.6.0/screenshots");
const base = "http://localhost:1420/";

const shots = [
  { file: "playlist", screen: "downloads", state: "playlist" },
  { file: "queue-selection", screen: "downloads", state: "queue" },
  { file: "download-doctor", screen: "downloads", state: "doctor" },
  { file: "library-follow", screen: "library", state: "library" },
  { file: "clip-maker", screen: "history", state: "clips" },
];

function urlFor(theme, shot) {
  const params = new URLSearchParams({
    demo: "marketing",
    theme,
    screen: shot.screen,
  });
  if (shot.section) params.set("section", shot.section);
  if (shot.state) params.set("state", shot.state);
  return `${base}?${params.toString()}`;
}

async function captureTheme(page, theme) {
  for (const shot of shots) {
    const suffix = theme === "dark" ? "-dark" : "";
    const dest = path.join(outDir, `${shot.file}${suffix}.png`);
    await page.goto(urlFor(theme, shot), { waitUntil: "networkidle" });
    // History mounts after the persisted fixture pass; give its nested dialogs time to settle.
    await page.waitForTimeout(shot.state === "clips" ? 5000 : 1200);
    await page.screenshot({ path: dest, type: "png" });
    console.log(`wrote ${dest}`);
  }
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 1000, height: 600 },
  deviceScaleFactor: 1,
});

await mkdir(outDir, { recursive: true });
await captureTheme(page, "light");
await captureTheme(page, "dark");
await browser.close();
console.log("done");
