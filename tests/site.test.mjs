import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

const script = await readFile(new URL('../main.js', import.meta.url), 'utf8');

function loadPage({ saved, dark = false, blocked = false } = {}) {
  const state = { theme: saved };
  const elements = {
    '.theme-toggle': { hidden: true, setAttribute(name, value) { this[name] = value; }, addEventListener(event, callback) { this[event] = callback; } },
    'meta[name="theme-color"]': {},
    '#local-time': {},
    '#year': {},
  };
  const document = {
    documentElement: { dataset: {} },
    querySelector: (selector) => elements[selector],
    addEventListener(event, callback) { this.ready = callback; },
  };
  const media = { matches: dark, addEventListener(event, callback) { this.change = callback; } };
  runInNewContext(script, {
    document, Intl, Date,
    localStorage: {
      getItem() { if (blocked) throw new Error('storage blocked'); return state.theme; },
      setItem(key, value) { if (blocked) throw new Error('storage blocked'); state.theme = value; },
    },
    matchMedia: () => media,
    setInterval() {},
  });
  document.ready();
  return { document, elements, media, state };
}

test('theme follows the system and saves an explicit choice', () => {
  const { document, elements, state, media } = loadPage({ dark: true });
  const button = elements['.theme-toggle'];
  assert.equal(button.hidden, false);
  assert.equal(button['aria-label'], 'включить светлую тему');
  button.click();
  assert.equal(document.documentElement.dataset.theme, 'light');
  assert.equal(state.theme, 'light');
  assert.equal(elements['meta[name="theme-color"]'].content, '#ffffff');
  media.change();
  assert.equal(document.documentElement.dataset.theme, 'light');
});

test('saved theme overrides the system', () => {
  const { document, elements } = loadPage({ saved: 'dark' });
  assert.equal(document.documentElement.dataset.theme, 'dark');
  assert.equal(elements['meta[name="theme-color"]'].content, '#0d1117');
});

test('blocked storage does not break the theme or clock', () => {
  const { document, elements } = loadPage({ blocked: true });
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
  assert.equal((await fetch(origin, { method: 'POST' })).status, 405);
});
