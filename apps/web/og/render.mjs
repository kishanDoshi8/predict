// Renders og/invite-card.html (1200x630) for the link-preview image. Needs Playwright:
// npm i -D playwright, then from apps/web: node og/render.mjs
import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.goto("file://" + path.join(here, "invite-card.html"));
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: path.join(here, "og-image.png") });
await browser.close();
console.log("wrote public/og-image.jpg");
