import { useEffect, useState } from 'react';

function currentTheme() {
  const applied = document.documentElement.dataset.theme;
  if (applied === 'dark' || applied === 'light') return applied;
  try { return localStorage.getItem('proveit:theme') === 'dark' ? 'dark' : 'light'; } catch { return 'light'; }
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState(currentTheme);

  useEffect(() => {
    const onStorage = (event) => {
      if (event.key === 'proveit:theme') {
        const next = event.newValue === 'dark' ? 'dark' : 'light';
        document.documentElement.dataset.theme = next;
        setTheme(next);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark';
    const commit = () => {
      document.documentElement.dataset.theme = next;
      document.documentElement.style.colorScheme = next;
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', next === 'dark' ? '#121722' : '#dde2e9');
      try { localStorage.setItem('proveit:theme', next); } catch { /* La preferencia vive en este navegador. */ }
      setTheme(next);
    };
    if (document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      document.documentElement.classList.add('react-theme-transition');
      const transition = document.startViewTransition(commit);
      transition.finished.finally(() => document.documentElement.classList.remove('react-theme-transition'));
    } else commit();
  }

  const label = theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro';
  return (
    <button className="react-theme-toggle" type="button" onClick={toggle} aria-label={label} title={label} aria-pressed={theme === 'dark'}>
      {theme === 'dark'
        ? <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" /></svg>
        : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 14A8.7 8.7 0 0 1 10 3.5 9 9 0 1 0 20.5 14Z" /></svg>}
    </button>
  );
}
