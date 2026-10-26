// Renders compose.html frame by frame (deterministic timeline) to out/NNNN.png
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
const V = process.argv[2], FROM = +(process.argv[3] || 0), TO = +(process.argv[4] || 360);
fs.mkdirSync(`${V}/out`, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CH });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
page.on('pageerror', (e) => console.log('pageerror', e.message));
await page.goto(`file://${V}/compose.html`);
await page.evaluate(() => document.fonts.ready);
for (let i = FROM; i < TO; i++) {
  await page.evaluate((t) => window.render(t), i / 30);
  await page.screenshot({ path: `${V}/out/${String(i).padStart(4, '0')}.png` });
}
await browser.close();
console.log('done', FROM, TO);
