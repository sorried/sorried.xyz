import site from './content.js';

const byId = (id) => document.getElementById(id);

function icon(name, className = 'icon') {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  const id = `icon-${name}`;
  use.setAttribute('href', `#${byId(id) ? id : 'icon-link'}`);
  svg.setAttribute('class', className);
  svg.setAttribute('aria-hidden', 'true');
  svg.append(use);
  return svg;
}

function link(url) {
  const anchor = document.createElement('a');
  const parsed = new URL(url, window.location.href);
  if (!['https:', 'http:', 'mailto:', 'tel:'].includes(parsed.protocol)) {
    throw new Error(`unsupported link protocol: ${parsed.protocol}`);
  }
  anchor.href = parsed.href;
  if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
  }
  return anchor;
}

document.title = site.title;
document.querySelector('meta[name="description"]').content = site.description;
document.querySelector('meta[property="og:title"]').content = site.title;
document.querySelector('meta[property="og:description"]').content = site.description;
document.querySelector('meta[property="og:url"]').content = site.url;
document.querySelector('meta[property="og:image"]').content = new URL(site.featured.image, site.url).href;
document.querySelector('link[rel="canonical"]').href = site.url;
document.querySelector('.wordmark').firstChild.textContent = new URL(site.url).hostname;
document.querySelector('.wordmark').setAttribute('aria-label', `${site.profile.name}, главная`);
byId('name').textContent = site.profile.name;
byId('avatar').src = site.profile.avatar;
byId('bio').textContent = site.profile.bio;
byId('signature').textContent = site.profile.signature;
byId('note').textContent = site.note;
byId('photo').src = site.photo.src;
byId('photo').alt = site.photo.alt;
byId('caption').textContent = site.photo.caption;
byId('section-title').textContent = site.section;
byId('footer-note').textContent = site.footer;

byId('socials').replaceChildren(...site.socials.map((social) => {
  const anchor = link(social.url);
  anchor.className = 'social-link';
  const label = document.createElement('span');
  label.textContent = social.label;
  anchor.append(icon(social.icon), label);
  return anchor;
}));

const featuredLink = link(site.featured.url);
for (const attribute of ['href', 'target', 'rel']) {
  if (featuredLink.hasAttribute(attribute)) {
    byId('featured').setAttribute(attribute, featuredLink.getAttribute(attribute));
  } else {
    byId('featured').removeAttribute(attribute);
  }
}
byId('featured-image').src = site.featured.image;
byId('featured-image').alt = site.featured.imageAlt;
byId('featured-title').textContent = site.featured.title;
byId('featured-description').textContent = site.featured.description;
byId('featured-label').textContent = site.featured.label;

byId('link-list').replaceChildren(...site.links.map((item) => {
  const anchor = link(item.url);
  anchor.className = 'paper link-card';
  const badge = document.createElement('span');
  badge.className = 'link-icon';
  badge.setAttribute('aria-hidden', 'true');
  badge.append(icon(item.icon));
  const copy = document.createElement('div');
  copy.className = 'link-copy';
  const title = document.createElement('h3');
  title.textContent = item.title;
  const description = document.createElement('p');
  description.textContent = item.description;
  copy.append(title, description);
  anchor.append(badge, copy, icon('arrow', 'icon link-arrow'));
  return anchor;
}));

const clockFormat = new Intl.DateTimeFormat('ru-RU', { timeZone: 'Asia/Yekaterinburg', hour: '2-digit', minute: '2-digit' });
function updateClock() {
  const now = new Date();
  byId('clock').textContent = clockFormat.format(now);
  byId('clock').dateTime = now.toISOString();
}
updateClock();
setInterval(updateClock, 1000);

byId('share').disabled = false;
let shareTimeout;
byId('share').addEventListener('click', async () => {
  clearTimeout(shareTimeout);
  try {
    await navigator.clipboard.writeText(site.url);
    byId('share-status').textContent = 'ссылка скопирована';
    shareTimeout = setTimeout(() => { byId('share-status').textContent = ''; }, 4000);
  } catch {
    byId('share-status').textContent = `адрес страницы: ${site.url}`;
  }
});

const photoDialog = byId('photo-dialog');
byId('open-photo').disabled = false;
byId('open-photo').addEventListener('click', () => {
  byId('dialog-image').src = site.photo.src;
  byId('dialog-image').alt = site.photo.alt;
  byId('dialog-caption').textContent = site.photo.caption;
  photoDialog.showModal();
});
byId('close-photo').addEventListener('click', () => photoDialog.close());
photoDialog.addEventListener('click', (event) => {
  const bounds = photoDialog.getBoundingClientRect();
  if (event.target === photoDialog && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) {
    photoDialog.close();
  }
});
