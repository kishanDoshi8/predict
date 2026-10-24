// Renders og/invite-card.html (1200x630) to public/og-image.jpg, the image shown
// when a link to the app is pasted into a chat. Needs Playwright: from apps/web,
// npm i -D playwright, then node og/render.mjs
import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.goto("file://" + path.join(here, "invite-card.html"));
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: path.join(here, "..", "public", "og-image.jpg"), type: "jpeg", quality: 88 });
await browser.close();
console.log("wrote public/og-image.jpg");
