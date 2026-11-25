import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useState } from 'react';
import { flushSync } from 'react-dom';

function currentTheme() {
  const applied = document.documentElement.dataset.theme;
  if (applied === 'dark' || applied === 'light') return applied;
  try { return localStorage.getItem('proveit:theme') === 'dark' ? 'dark' : 'light'; } catch { return 'light'; }
}

const spring = { type: 'spring', stiffness: 260, damping: 18 };

function SunMoon({ dark }) {
  const reduce = useReducedMotion();
  const transition = reduce ? { duration: 0 } : spring;
  return (
    <motion.svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"
      initial={false} animate={{ rotate: dark ? 40 : 90 }} transition={transition}>
      <mask id="proveit-moon-cut"><rect width="24" height="24" fill="white" />
        <motion.circle r="9" fill="black" initial={false} animate={dark ? { cx: 17, cy: 5 } : { cx: 30, cy: -6 }} transition={transition} />
      </mask>
      <motion.circle cx="12" cy="12" fill="currentColor" stroke="none" mask="url(#proveit-moon-cut)" initial={false} animate={{ r: dark ? 9 : 5 }} transition={transition} />
      <motion.g initial={false} animate={{ opacity: dark ? 0 : 1, scale: dark ? 0.4 : 1 }} style={{ originX: '12px', originY: '12px' }} transition={transition}>
        {Array.from({ length: 8 }, (_, i) => {
          const angle = (i * Math.PI) / 4;
          return <line key={i} x1={12 + Math.cos(angle) * 8} y1={12 + Math.sin(angle) * 8} x2={12 + Math.cos(angle) * 10.5} y2={12 + Math.sin(angle) * 10.5} />;
        })}
      </motion.g>
    </motion.svg>
  );
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState(currentTheme);
  const dark = theme === 'dark';

  useEffect(() => {
    const onStorage = (event) => {
      if (event.key === 'proveit:theme') {
        const next = event.newValue === 'dark' ? 'dark' : 'light';
        document.documentElement.dataset.theme = next;
        document.documentElement.style.colorScheme = next;
        setTheme(next);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  function toggle(event) {
    const next = dark ? 'light' : 'dark';
    const button = event.currentTarget;
    const bounds = button.getBoundingClientRect();
    const x = bounds.left + bounds.width / 2;
    const y = bounds.top + bounds.height / 2;
    const commit = () => {
      document.documentElement.dataset.theme = next;
      document.documentElement.style.colorScheme = next;
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', next === 'dark' ? '#121722' : '#f4f5ef');
      try { localStorage.setItem('proveit:theme', next); } catch { /* La preferencia queda aplicada en esta pestaña. */ }
      flushSync(() => setTheme(next));
    };

    if (document.startViewTransition && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const root = document.documentElement;
      const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
      root.classList.add('react-theme-transition');
      const transition = document.startViewTransition(commit);
      const cleanup = () => root.classList.remove('react-theme-transition');
      transition.finished.then(cleanup, cleanup);
      transition.ready.then(() => {
        root.animate({ clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] }, {
          duration: 800,
          easing: 'cubic-bezier(0.65, 0, 0.35, 1)',
          pseudoElement: '::view-transition-new(root)',
        });
        root.animate({ filter: ['brightness(1)', 'brightness(0.6)'] }, {
          duration: 800,
          easing: 'cubic-bezier(0.23, 1, 0.32, 1)',
          pseudoElement: '::view-transition-old(root)',
        });
      }).catch(() => {});
    } else commit();
  }

  const label = dark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro';
  return (
    <button className="react-theme-toggle" type="button" onClick={toggle} aria-label={label} title={label} aria-pressed={dark}>
      <SunMoon dark={dark} />
    </button>
  );
}
