import '../header-ui.css';

const icons = {
  user: '<circle cx="12" cy="8" r="3"/><path d="M5 21v-3a7 7 0 0 1 14 0v3Z"/>',
  friends: '<circle cx="9" cy="8" r="3"/><path d="M2 21v-3a7 7 0 0 1 14 0v3M16 5a3 3 0 0 1 0 6m3 10v-3a7 7 0 0 0-3-6"/>',
  logout: '<path d="M9 4H3v16h6m5-13 5 5-5 5m-7-5h12"/>',
};
function icon(name) { return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`; }
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// La navegación comparte enlaces; el contenido y las pantallas de perfil no cambian.
const header = document.querySelector('header.topbar');
if (header) {
  const brand = header.querySelector('.brand');
  header.querySelectorAll('nav a').forEach(link => {
    if (new URL(link.href).pathname === '/torneos.html') link.remove();
  });
  if (brand && !header.querySelector('.club-primary-nav')) {
    const nav = document.createElement('div'); nav.className = 'club-primary-nav'; nav.setAttribute('role', 'navigation'); nav.setAttribute('aria-label', 'Principal');
    for (const [label,href,paths] of [['Torneos','/torneos.html',['/torneos.html','/torneo.html','/crear-torneo.html']],['Amigos','/amigos.html',['/amigos.html']]]) {
      const link = document.createElement('a'); link.href = href; link.textContent = label;
      if (paths.includes(location.pathname)) link.setAttribute('aria-current', 'page');
      nav.append(link);
    }
    brand.after(nav);
  }
}

export function mountAccountMenu(trigger, signOut) {
  if (!trigger) return { update() {}, reset() {} };
  const wrapper = document.createElement('div'); wrapper.className = 'account-menu';
  trigger.before(wrapper); wrapper.append(trigger);
  const panel = document.createElement('div'); panel.id = 'clubAccountMenu'; panel.className = 'account-menu-panel'; panel.hidden = true;
  panel.setAttribute('role', 'menu'); panel.setAttribute('aria-label', 'Mi cuenta');
  const name = document.createElement('p'); name.className = 'account-menu-name'; name.setAttribute('role', 'presentation');
  panel.append(name);
  for (const [label, href, key] of [['Mi perfil', '/perfil.html', 'user'], ['Amigos', '/amigos.html', 'friends']]) {
    const link = document.createElement('a'); link.href = href; link.setAttribute('role', 'menuitem'); link.tabIndex = -1;
    link.innerHTML = icon(key); link.append(document.createTextNode(label)); panel.append(link);
  }
  const exit = document.createElement('button'); exit.type = 'button'; exit.tabIndex = -1; exit.setAttribute('role', 'menuitem');
  exit.className = 'account-menu-exit'; exit.innerHTML = icon('logout'); exit.append(document.createTextNode('Cerrar sesión')); panel.append(exit);
  const error = document.createElement('p'); error.className = 'account-menu-error'; error.setAttribute('role', 'status'); error.hidden = true; panel.append(error);
  wrapper.append(panel);
  trigger.setAttribute('role', 'button'); trigger.setAttribute('aria-haspopup', 'menu'); trigger.setAttribute('aria-controls', panel.id); trigger.setAttribute('aria-expanded', 'false');
  let animation, generation = 0;
  const items = () => [...panel.querySelectorAll('[role="menuitem"]')];
  function close(restore = false, immediate = false) {
    const token = ++generation; animation?.cancel(); trigger.setAttribute('aria-expanded', 'false');
    if (panel.hidden) return;
    if (restore && !trigger.hidden) trigger.focus();
    if (immediate || reduced() || !panel.animate) { panel.hidden = true; return; }
    animation = panel.animate([{ opacity: 1, transform: 'translateY(0) scale(1)' }, { opacity: 0, transform: 'translateY(-4px) scale(.98)' }], { duration: 110, easing: 'cubic-bezier(.23,1,.32,1)' });
    animation.finished.then(() => { if (generation === token) panel.hidden = true; }).catch(() => {});
  }
  function open(focus = false) {
    ++generation; animation?.cancel(); panel.hidden = false; trigger.setAttribute('aria-expanded', 'true');
    if (!reduced() && panel.animate) animation = panel.animate([{ opacity: 0, transform: 'translateY(-5px) scale(.96)' }, { opacity: 1, transform: 'translateY(0) scale(1)' }], { duration: 170, easing: 'cubic-bezier(.23,1,.32,1)' });
    if (focus) items()[0]?.focus();
  }
  trigger.addEventListener('click', event => { event.preventDefault(); trigger.getAttribute('aria-expanded') === 'true' ? close() : open(); });
  trigger.addEventListener('keydown', event => {
    if ([' ', 'ArrowDown', 'ArrowUp'].includes(event.key)) { event.preventDefault(); event.stopPropagation(); open(true); if (event.key === 'ArrowUp') items().at(-1)?.focus(); }
  });
  wrapper.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); close(true); }
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key) && !panel.hidden) {
      event.preventDefault(); const all = items(), at = all.indexOf(document.activeElement);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? all.length - 1 : (at + (event.key === 'ArrowDown' ? 1 : -1) + all.length) % all.length;
      all[next]?.focus();
    }
  });
  document.addEventListener('pointerdown', event => { if (!wrapper.contains(event.target)) close(); });
  wrapper.addEventListener('focusout', event => { if (!wrapper.contains(event.relatedTarget)) close(); });
  panel.querySelectorAll('a').forEach(link => link.addEventListener('click', () => close(false, true)));
  exit.addEventListener('click', async () => {
    exit.disabled = true; error.hidden = true;
    try { await signOut(); close(false, true); }
    catch { error.textContent = 'No pudimos cerrar la sesión. Intentá nuevamente.'; error.hidden = false; }
    finally { exit.disabled = false; }
  });
  return {
    update(nickname) { name.textContent = nickname; trigger.setAttribute('aria-label', `Menú de ${nickname}`); trigger.title = `Mi cuenta: ${nickname}`; },
    reset() { close(false, true); name.textContent = ''; error.hidden = true; },
  };
}
