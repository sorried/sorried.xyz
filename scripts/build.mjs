import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import site from '../content.js';

const escape = (value) => value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
let html = await readFile('index.html', 'utf8');
html = html.replace(/<title>[^<]*<\/title>/, `<title>${escape(site.title)}</title>`);
for (const [attribute, value] of [
  ['name="description"', site.description],
  ['property="og:title"', site.title],
  ['property="og:description"', site.description],
  ['property="og:url"', site.url],
  ['property="og:image"', new URL(site.featured.image, site.url).href],
]) {
  html = html.replace(new RegExp(`(<meta ${attribute} content=")[^"]*(">)`), (_, start, end) => `${start}${escape(value)}${end}`);
}
html = html.replace(/<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${escape(site.url)}">`);
await mkdir('dist', { recursive: true });
await writeFile('dist/index.html', html);
for (const file of ['main.js', 'content.js', 'styles.css', 'assets']) {
  await cp(file, `dist/${file}`, { recursive: true });
}
console.log('built static site in dist/');
