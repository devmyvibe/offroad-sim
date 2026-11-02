// Usage: node scripts/screenshot.mjs [name] [--mobile] [--wait=ms] [--url=...]
// Starts the Vite dev server (unless --url given), loads the game in headless
// Chromium with software WebGL, waits, screenshots, and fails on console errors.
import { createRequire } from 'node:module';
const { chromium, devices } = createRequire(import.meta.url)('playwright');
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const name = args.find((a) => !a.startsWith('--')) ?? 'shot';
const mobile = args.includes('--mobile');
const wait = Number((args.find((a) => a.startsWith('--wait=')) ?? '--wait=4000').split('=')[1]);
const urlArg = args.find((a) => a.startsWith('--url='))?.slice(6);
const nofog = args.includes('--nofog');
const cam = args.find((a) => a.startsWith('--cam='))?.split('=')[1];
const quality = (args.find((a) => a.startsWith('--quality=')) ?? '--quality=low').split('=')[1];
const outDir = process.env.SHOT_DIR ?? path.resolve('shots');
mkdirSync(outDir, { recursive: true });

let server = null;
let url = urlArg;
if (!url) {
  server = spawn('npx', ['vite', '--port', '5199', '--strictPort'], { stdio: 'ignore', detached: false });
  url = 'http://localhost:5199/';
  const deadline = Date.now() + 30000;
  while (true) {
    try { const r = await fetch(url); if (r.ok) break; } catch { /* not up yet */ }
    if (Date.now() > deadline) throw new Error('vite did not start');
    await new Promise((r) => setTimeout(r, 300));
  }
}

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const context = await browser.newContext(mobile ? { ...devices['iPhone 13'], hasTouch: true } : { viewport: { width: 1280, height: 720 } });
const page = await context.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); if (process.env.VERBOSE) console.log('[console]', m.type(), m.text()); });
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
await page.goto(url + (url.includes('?') ? '&' : '?') + 'quality=' + quality + (cam ? '&cam=' + cam : '') + (nofog ? '&nofog=1' : ''), { waitUntil: 'load' });
await page.waitForTimeout(wait);
const debug = await page.evaluate(() => window.__debug ?? null);
const file = path.join(outDir, `${name}${mobile ? '-mobile' : ''}.png`);
console.log('debug:', JSON.stringify(debug));
await page.screenshot({ path: file, timeout: 90000 });
console.log('screenshot:', file);
await browser.close();
server?.kill();
if (errors.length) { console.error('console errors:\n' + errors.join('\n')); process.exit(1); }
