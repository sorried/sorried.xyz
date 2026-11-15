try {
  const saved = localStorage.getItem('theme');
  if (saved === 'light' || saved === 'dark') document.documentElement.dataset.theme = saved;
} catch {}

document.addEventListener('DOMContentLoaded', () => {
  const themeButton = document.querySelector('.theme-toggle');
  const isDark = () => document.documentElement.dataset.theme !== 'light';
  const updateTheme = () => {
    themeButton.setAttribute('aria-label', `включить ${isDark() ? 'светлую' : 'тёмную'} тему`);
    document.querySelector('meta[name="theme-color"]').content = isDark() ? '#080a09' : '#f7faf7';
  };
  themeButton.hidden = false;
  updateTheme();
  themeButton.addEventListener('click', () => {
    const theme = isDark() ? 'light' : 'dark';
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('theme', theme); } catch {}
    updateTheme();
  });

  const links = [...document.querySelectorAll('.nav a')];
  const selectLink = (hash) => {
    links.forEach(link => {
      if (link.hash === hash) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  };
  links.forEach(link => link.addEventListener('click', () => selectLink(link.hash)));
  const sections = links.map(link => document.querySelector(link.hash));
  const updateSection = () => {
    const current = sections.findLast(section => section.getBoundingClientRect().top <= innerHeight * .45);
    selectLink(current ? `#${current.id}` : '');
  };
  window.addEventListener('scroll', updateSection, { passive: true });
  window.addEventListener('hashchange', () => selectLink(location.hash));
  selectLink(location.hash);

  const copyButton = document.querySelector('.copy-button');
  copyButton.hidden = false;
  copyButton.addEventListener('click', async () => {
    const status = document.querySelector('.copy-status');
    try {
      await navigator.clipboard.writeText('@i_sorried');
      status.textContent = '@i_sorried скопирован';
    } catch {
      status.textContent = 'можно скопировать вручную: @i_sorried';
    }
  });

  const clock = document.querySelector('#local-time');
  const formatTime = new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Asia/Yekaterinburg', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  });
  const formatYear = new Intl.DateTimeFormat('en', { timeZone: 'Asia/Yekaterinburg', year: 'numeric' });
  const updateClock = () => {
    const now = new Date();
    clock.textContent = formatTime.format(now);
    clock.dateTime = now.toISOString();
    document.querySelector('#year').textContent = formatYear.format(now);
  };
  updateClock();
  setInterval(updateClock, 30_000);
});
