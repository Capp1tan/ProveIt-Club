// Tema independiente de la cuenta: se aplica antes del primer dibujo y también sin AWS.
(() => {
  const key = 'proveit:theme', root = document.documentElement;
  let theme = 'light';
  try { const saved = localStorage.getItem(key); if (saved === 'dark' || saved === 'light') theme = saved; } catch {}
  function apply(value) {
    theme = value === 'dark' ? 'dark' : 'light'; root.dataset.theme = theme;
    root.style.colorScheme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#121722' : '#dde2e9');
    const button = document.querySelector('[data-theme-toggle]');
    if (button) {
      const label = theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro';
      button.setAttribute('aria-label', label); button.title = label;
      button.setAttribute('aria-pressed', String(theme === 'dark'));
      button.innerHTML = theme === 'dark'
        ? '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/></svg>'
        : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 14A8.7 8.7 0 0 1 10 3.5 9 9 0 1 0 20.5 14Z"/></svg>';
    }
  }
  apply(theme);
  document.addEventListener('DOMContentLoaded', () => {
    const nav = document.querySelector('.top-actions');
    if (nav && !nav.querySelector('[data-theme-toggle]')) {
      const button = document.createElement('button'); button.type = 'button';
      button.className = 'theme-toggle'; button.dataset.themeToggle = '';
      button.addEventListener('click', () => { apply(theme === 'light' ? 'dark' : 'light'); try { localStorage.setItem(key, theme); } catch {} });
      nav.prepend(button);
    }
    document.querySelectorAll('.brand').forEach(brand => {
      if (brand.querySelector('.brand-emblem')) return;
      const mark = document.createElement('span'); mark.className = 'brand-emblem'; mark.setAttribute('aria-hidden', 'true');
      mark.innerHTML = '<svg viewBox="0 0 36 36" fill="none"><path d="m24 2 10 16-18-3Z" fill="currentColor" opacity=".55"/><path d="m16 15 18 3-24 15 5-13L2 25Z" fill="currentColor"/><path d="m2 25 13-5-5 13Z" fill="currentColor" opacity=".4"/></svg>';
      brand.prepend(mark);
    });
    apply(theme);
  }, { once: true });
  // Las pestañas abiertas siguen la misma preferencia, sin recargar formularios.
  window.addEventListener('storage', event => { if (event.key === key) apply(event.newValue); });
})();
