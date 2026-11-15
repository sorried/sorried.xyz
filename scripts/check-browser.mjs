import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const { chromium } = await import(process.argv[2] || 'playwright');
const server = spawn(process.execPath, ['scripts/serve.mjs', 'dist'], {
  cwd: new URL('..', import.meta.url), env: { ...process.env, PORT: '0' }, stdio: ['ignore', 'pipe', 'inherit'],
});
let browser;
try {
  const [ready] = await once(server.stdout, 'data');
  const origin = ready.toString().match(/http:\/\/127\.0\.0\.1:\d+/)[0];
  browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH });
  if (process.env.PREVIEW_DIR) await mkdir(process.env.PREVIEW_DIR, { recursive: true });
  for (const width of [320, 375, 430, 768, 960, 1280]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, isMobile: width < 768, hasTouch: width < 768, deviceScaleFactor: 2, reducedMotion: 'reduce' });
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(origin);
    await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), width, `horizontal overflow at ${width}`);
    assert.equal(await page.locator('.project-link').count(), 6);
    assert.ok(await page.locator('.portrait img').isVisible(), `avatar must be visible at ${width}`);
    const avatar = await page.locator('.portrait img').evaluate(image => ({
      natural: image.naturalWidth, rendered: image.getBoundingClientRect().width, scale: devicePixelRatio,
      transform: getComputedStyle(image.parentElement).transform,
    }));
    assert.ok(avatar.natural >= Math.ceil(avatar.rendered * avatar.scale), `avatar must have enough pixels at ${width}`);
    assert.equal(avatar.transform, 'none');
    assert.ok(await page.getByRole('heading', { name: 'плагины freshGram' }).isVisible());
    assert.equal(await page.locator('.project-status').textContent(), 'в архиве');
    assert.ok(await page.evaluate(() => document.fonts.check('500 24px Unbounded')));
    for (const id of ['projects', 'contacts', 'about']) {
      const link = page.locator(`nav a[href="#${id}"]`);
      await link.click();
      assert.equal(await link.getAttribute('aria-current'), 'location', `${id} selection at ${width}`);
      const top = await page.locator(`#${id}`).evaluate(element => element.getBoundingClientRect().top);
      assert.ok(top >= 64 && top <= 750, `${id} target must remain visible below the header at ${width}: ${top}`);
    }
    await page.locator('.tools summary').click();
    assert.equal(await page.locator('.tools').getAttribute('open'), '');
    await page.locator('.tools summary').click();
    await page.locator('nav a[href="#contacts"]').click();
    await page.getByRole('button', { name: 'скопировать Telegram' }).click();
    await page.locator('.copy-status').filter({ hasText: '@i_sorried скопирован' }).waitFor();
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), '@i_sorried');
    await page.getByRole('button', { name: 'включить светлую тему' }).click();
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'light');
    await page.reload();
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'light');
    await page.getByRole('button', { name: 'включить тёмную тему' }).click();
    await page.locator('.wordmark').click();
    if (process.env.PREVIEW_DIR && [375, 1280].includes(width)) {
      await page.screenshot({ path: resolve(process.env.PREVIEW_DIR, width === 375 ? 'mobile.png' : 'desktop.png'), fullPage: true, scale: 'css' });
    }
    await page.route('https://github.com/sorried/xyecoc-ipa', route => route.fulfill({ contentType: 'text/html', body: '<title>project destination</title>' }));
    await page.locator('.project-link[href="https://github.com/sorried/xyecoc-ipa"]').click({ position: { x: 30, y: 65 } });
    await page.waitForURL('https://github.com/sorried/xyecoc-ipa');
    for (const plugin of ['foxdrop', 'coverdrop']) {
      await page.goto(origin);
      const url = `https://github.com/sorried/freshgram-plugins/tree/main/${plugin}`;
      await page.route(url, route => route.fulfill({ contentType: 'text/html', body: '<title>plugin destination</title>' }));
      await page.locator(`.project-link[href="${url}"]`).click({ position: { x: 30, y: 65 } });
      await page.waitForURL(url);
    }
    await page.goto(origin);
    await page.route('https://t.me/i_sorried', route => route.fulfill({ contentType: 'text/html', body: '<title>contact destination</title>' }));
    await page.getByRole('link', { name: 'написать в Telegram' }).click();
    await page.waitForURL('https://t.me/i_sorried');
    assert.deepEqual(errors, []);
    console.log(`${width}px: layout, sharp avatar, plugins, navigation, contacts and themes passed`);
    await context.close();
  }
  const page = await browser.newPage({ viewport: { width: 375, height: 812 }, javaScriptEnabled: false });
  await page.goto(origin);
  assert.ok(await page.getByRole('heading', { name: 'sorried.' }).isVisible());
  assert.equal(await page.locator('.project-link').count(), 6);
  await page.locator('.tools summary').click();
  assert.equal(await page.locator('.tools').getAttribute('open'), '');
  console.log('no-JavaScript content and native details: passed');
} finally {
  await browser?.close();
  server.kill();
  await once(server, 'exit');
}
