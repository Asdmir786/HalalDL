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
const outDir = path.resolve(__dirname, "../docs/assets/screenshots");
const base = "http://localhost:1420/";

const shots = [
  { file: "halaldl-downloads", screen: "downloads" },
  { file: "halaldl-presets", screen: "presets" },
  { file: "halaldl-tools", screen: "tools" },
  { file: "halaldl-history", screen: "history" },
  { file: "halaldl-logs", screen: "logs" },
  { file: "halaldl-settings", screen: "settings", section: "appearance" },
  { file: "halaldl-settings-performance", screen: "settings", section: "performance" },
  { file: "halaldl-about-trust", screen: "settings", section: "about" },
  { file: "halaldl-support-prompt", screen: "settings", section: "about" },
];

function urlFor(theme, shot) {
  const params = new URLSearchParams({
    demo: "marketing",
    theme,
    screen: shot.screen,
  });
  if (shot.section) params.set("section", shot.section);
  return `${base}?${params.toString()}`;
}

async function captureTheme(page, theme) {
  for (const shot of shots) {
    const suffix = theme === "dark" ? "-dark" : "";
    const dest = path.join(outDir, `${shot.file}${suffix}.png`);
    await page.goto(urlFor(theme, shot), { waitUntil: "networkidle" });
    await page.waitForTimeout(900);
    if (shot.screen === "logs") {
      await page.waitForTimeout(300);
      await page.getByRole("combobox").click();
      await page.getByRole("option", { name: "All Jobs" }).click();
      await page.waitForTimeout(400);
    }
    if (shot.section === "about" || shot.section === "performance") {
      await page.waitForTimeout(500);
      await page.evaluate((sectionId) => {
        document.getElementById(sectionId)?.scrollIntoView({ block: "start" });
      }, shot.section);
      await page.waitForTimeout(500);
    }
    if (shot.file === "halaldl-support-prompt") {
      await page.evaluate(() => {
        const el = Array.from(document.querySelectorAll("p, h2, h3, span, button")).find((node) =>
          /help improve|star|feedback|not now/i.test(node.textContent || "")
        );
        el?.scrollIntoView?.({ block: "center" });
      });
      await page.waitForTimeout(400);
    }
    if (shot.file === "halaldl-about-trust") {
      await page.evaluate(() => {
        const el = Array.from(document.querySelectorAll("p, h2, h3")).find((node) =>
          /install trust/i.test(node.textContent || "")
        );
        el?.scrollIntoView?.({ block: "center" });
      });
      await page.waitForTimeout(400);
    }
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
