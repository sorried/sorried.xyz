try {
  const saved = localStorage.getItem('theme');
  if (saved === 'light' || saved === 'dark') document.documentElement.dataset.theme = saved;
} catch {}

document.addEventListener('DOMContentLoaded', () => {
  const themeButton = document.querySelector('.theme-toggle');
  const systemTheme = matchMedia('(prefers-color-scheme: dark)');
  const isDark = () => document.documentElement.dataset.theme === 'dark'
    || (!document.documentElement.dataset.theme && systemTheme.matches);

  const updateTheme = () => {
    themeButton.setAttribute('aria-label', `включить ${isDark() ? 'светлую' : 'тёмную'} тему`);
    document.querySelector('meta[name="theme-color"]').content = isDark() ? '#1d1e1b' : '#f8f7f4';
  };

  themeButton.hidden = false;
  updateTheme();
  systemTheme.addEventListener('change', updateTheme);
  themeButton.addEventListener('click', () => {
    const theme = isDark() ? 'light' : 'dark';
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('theme', theme); } catch {}
    updateTheme();
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
