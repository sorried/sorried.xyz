import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

const { chromium } = await import(process.argv[2] || 'playwright');
const server = spawn(process.execPath, ['scripts/serve.mjs', 'dist'], {
  cwd: new URL('..', import.meta.url), env: { ...process.env, PORT: '0' }, stdio: ['ignore', 'pipe', 'inherit'],
});
let browser;
try {
  const [ready] = await once(server.stdout, 'data');
  const origin = ready.toString().match(/http:\/\/127\.0\.0\.1:\d+/)[0];
  browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(origin);
  await page.locator('nav a[href="#projects"]').click();
  await page.waitForTimeout(250);
  assert.equal(await page.locator('nav a[href="#projects"]').getAttribute('aria-current'), 'location', 'navigation must indicate the selected section');
  await page.route('https://github.com/sorried/xyecoc-ipa', route => route.fulfill({ contentType: 'text/html', body: '<title>project destination</title>' }));
  await page.locator('.project-link').first().click({ position: { x: 40, y: 65 } });
  await page.waitForURL('https://github.com/sorried/xyecoc-ipa');
  console.log('navigation and full project links: passed');
} finally {
  await browser?.close();
  server.kill();
  await once(server, 'exit');
}
