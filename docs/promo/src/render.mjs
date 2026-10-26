// Renders camera-controlled frame sequences of the anatomy viewer (white theme) for the promo video.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
const OUT = process.argv[2], ONLY = process.argv[3] ? process.argv[3].split(',') : null;
const W = 1080, H = 1080;
const browser = await chromium.launch({ executablePath: process.env.CH, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.log('pageerror', e.message));
await page.addInitScript(() => {
  localStorage.setItem('theme', '"light"');
  // virtual clock: once frozen, animation time advances exactly 1/30 s per captured frame
  const pn = performance.now.bind(performance); let vt = null;
  window.__vclock = { freeze: () => { vt = pn(); }, step: (d) => { vt += d; } };
  performance.now = () => (vt === null ? pn() : vt);
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => raf((t) => cb(vt === null ? t : vt));
});
await page.goto('http://127.0.0.1:8765/index.html');
await page.waitForFunction(() => window.__anatomy && window.__anatomy.state.parts.length > 1000, null, { timeout: 300000 });
await page.waitForTimeout(1500);
await page.click('#sex-m').catch(() => {});
await page.evaluate(() => window.__vclock.freeze());
await page.addStyleTag({ content: `body > *:not(#viewport){ visibility:hidden !important } #viewport{ position:fixed !important; inset:0 !important; } .modal{display:none!important}` });
const raf = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r)))));
const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

// camera on an orbit around target: yaw (deg, 0 = front), elevation (deg), distance
async function cam(yaw, elev, dist, ty) {
  await page.evaluate(([yaw, elev, dist, ty]) => {
    const a = window.__anatomy, y = yaw * Math.PI / 180, e = elev * Math.PI / 180;
    a.controls.autoRotate = false;
    a.controls.target.set(0, ty, 0);
    a.camera.position.set(Math.sin(y) * Math.cos(e) * dist, ty + Math.sin(e) * dist, Math.cos(y) * Math.cos(e) * dist);
    a.camera.lookAt(0, ty, 0);
    a.controls.update();
  }, [yaw, elev, dist, ty]);
}
async function clip(name, frames, setup, frame) {
  if (ONLY && !ONLY.includes(name)) return;
  fs.mkdirSync(`${OUT}/${name}`, { recursive: true });
  await page.evaluate(setup);
  // let transitions finish on the virtual clock
  for (let k = 0; k < 12; k++) await page.evaluate(() => new Promise((r) => { window.__vclock.step(150); requestAnimationFrame(() => r()); }));
  const t0 = Date.now();
  for (let i = 0; i < frames; i++) {
    const t = i / (frames - 1);
    await frame(t);
    const url = await page.evaluate(() => new Promise((r) => { window.__vclock.step(1000 / 12); requestAnimationFrame(() => r(document.querySelector('#viewport canvas').toDataURL('image/png'))); }));
    if (i % 5 === 0) console.log(name, i, Date.now() - t0);
    fs.writeFileSync(`${OUT}/${name}/${String(i).padStart(4, '0')}.png`, Buffer.from(url.split(',')[1], 'base64'));
  }
  console.log(name, frames, 'frames', ((Date.now() - t0) / frames).toFixed(0), 'ms/frame');
}
const reset = `(() => { const a=window.__anatomy; a.state.parts.forEach(p=>p.hidden=false); a.select(null); a.setExplode(0); if(a.state.xray) a.toggleXray(); document.querySelector('[data-preset="all"]').click(); })()`;

// 1 · full body turning
await clip('body', 40, reset, async (t) => { const k = ease(t); await cam(-35 + 70 * k, 6, 3.3 - 0.35 * k, 0.92); });
// 2 · organs (x-ray like) close-up on the torso
await clip('organs', 34, `(() => { ${reset}; document.querySelector('[data-preset="organs"]').click(); })()`,
  async (t) => { const k = ease(t); await cam(30 - 60 * k, 8, 1.55 - 0.15 * k, 1.18); });
// 3 · explode
await clip('explode', 30, reset, async (t) => {
  const k = ease(t);
  await page.evaluate((v) => window.__anatomy.setExplode(v), 0.6 * k);
  await cam(20 - 25 * k, 10, 3.0 + 0.4 * k, 1.0);
});
// 4 · heart with blood flow
await clip('heart', 30, `(() => { ${reset}; window.__anatomy.startTour(0); document.querySelector('#btn-flow').click(); })()`,
  async (t) => { const k = ease(t); await cam(-25 + 40 * k, 8, 0.55 - 0.12 * k, 1.29); });
// 5 · skeleton
await clip('skeleton', 30, `(() => { document.querySelector('#btn-flow').click(); document.querySelector('#tours-close')?.click(); ${reset}; document.querySelector('[data-preset="skeleton"]').click(); })()`,
  async (t) => { const k = ease(t); await cam(160 + 60 * k, 12, 2.8, 0.95); });
await browser.close();
