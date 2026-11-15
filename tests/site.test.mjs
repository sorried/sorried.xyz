import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

const script = await readFile(new URL('../main.js', import.meta.url), 'utf8');

function loadPage({ saved, blocked = false } = {}) {
  const state = { theme: saved };
  const elements = {
    '.theme-toggle': { hidden: true, setAttribute(name, value) { this[name] = value; }, addEventListener(event, callback) { this[event] = callback; } },
    'meta[name="theme-color"]': {},
    '#local-time': {},
    '#year': {},
    '.copy-button': { addEventListener() {} },
  };
  const document = {
    documentElement: { dataset: {} },
    querySelector: (selector) => elements[selector],
    querySelectorAll: () => [],
    addEventListener(event, callback) { this.ready = callback; },
  };
  runInNewContext(script, {
    document, Intl, Date,
    window: { addEventListener() {} }, location: { hash: '' },
    localStorage: {
      getItem() { if (blocked) throw new Error('storage blocked'); return state.theme; },
      setItem(key, value) { if (blocked) throw new Error('storage blocked'); state.theme = value; },
    },
    setInterval() {},
  });
  document.ready();
  return { document, elements, state };
}

test('theme defaults to light and saves an explicit choice', () => {
  const { document, elements, state } = loadPage();
  const button = elements['.theme-toggle'];
  assert.equal(button.hidden, false);
  assert.equal(button['aria-label'], 'включить тёмную тему');
  button.click();
  assert.equal(document.documentElement.dataset.theme, 'dark');
  assert.equal(state.theme, 'dark');
  assert.equal(elements['meta[name="theme-color"]'].content, '#211d29');
});

test('saved dark theme overrides the light default', () => {
  const { document, elements } = loadPage({ saved: 'dark' });
  assert.equal(document.documentElement.dataset.theme, 'dark');
  assert.equal(elements['meta[name="theme-color"]'].content, '#211d29');
});

test('blocked storage does not break the theme or clock', () => {
  const { document, elements } = loadPage({ blocked: true, saved: 'light' });
  elements['.theme-toggle'].click();
  assert.equal(document.documentElement.dataset.theme, 'dark');
  const clock = elements['#local-time'];
  assert.equal(clock.textContent, new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Asia/Yekaterinburg', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(new Date(clock.dateTime)));
});

test('built page serves all local assets and keeps repository files private', async (t) => {
  const server = spawn(process.execPath, ['scripts/serve.mjs', 'dist'], {
    cwd: new URL('..', import.meta.url), env: { ...process.env, PORT: '0' }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  t.after(async () => { server.kill(); await once(server, 'exit'); });
  const ready = await Promise.race([
    once(server.stdout, 'data').then(([data]) => data.toString()),
    once(server, 'exit').then(([code]) => { throw new Error(`server exited with ${code}`); }),
  ]);
  const origin = ready.match(/http:\/\/127\.0\.0\.1:\d+/)[0];
  const response = await fetch(origin);
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<html lang="ru">/);
  assert.match(html, /Maya Moon/);
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(new Set(ids).size, ids.length);
  for (const [, target] of html.matchAll(/href="#([^"]+)"/g)) assert.ok(ids.includes(target), target);
  for (const [, path] of html.matchAll(/(?:src|href)="(\.\/[^\"]+)"/g)) {
    const asset = await fetch(new URL(path, origin));
    assert.equal(asset.status, 200, path);
    assert.ok((await asset.arrayBuffer()).byteLength > 0, path);
  }
  assert.match((await fetch(`${origin}/assets/avatar.jpg`)).headers.get('content-type'), /image\/jpeg/);
  assert.equal((await fetch(`${origin}/`, { method: 'HEAD' })).status, 200);
  assert.equal((await fetch(`${origin}/`, { method: 'HEAD' })).headers.get('content-type'), 'text/html; charset=utf-8');
  for (const path of ['/.git/config', '/package.json', '/docs/design.md', '/assets/%2e%2e%2fpackage.json', '/missing', '/%ZZ']) {
    assert.ok([400, 404].includes((await fetch(`${origin}${path}`)).status), path);
  }
  for (const path of ['/sex', '/sex/', '/sex/index.html']) {
    const photoPage = await fetch(`${origin}${path}`);
    assert.equal(photoPage.status, 200, path);
    assert.match(photoPage.headers.get('content-type'), /text\/html/);
    assert.match(await photoPage.text(), /src="\/assets\/secret\/six\.jpg"/);
  }
  const photo = await fetch(`${origin}/assets/secret/six.jpg`);
  assert.equal(photo.status, 200);
  assert.equal(photo.headers.get('content-type'), 'image/jpeg');
  assert.deepEqual(Buffer.from(await photo.arrayBuffer()), await readFile(new URL('../assets/secret/six.jpg', import.meta.url)));
  assert.equal((await fetch(origin, { method: 'POST' })).status, 405);
});
