import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { pendingInvitations } from '../../tournaments-api.js';
import { communityAction } from '../../community-api.js';
import { avatarUrl, getCurrentUser } from '../../auth-client.js';
import { notificationItems } from '../../notification-items.js';
import { notificationSoundEnabled } from '../../notification-preferences.js';
import { useAuth } from '../auth/AuthProvider.jsx';
import '../../../notifications.css';

function NotificationAvatar({ item }) {
  const [url, setUrl] = useState('');
  useEffect(() => { let alive = true; if (item.avatarPath && item.profileId) void avatarUrl(item.avatarPath, { profileId: item.profileId }).then((value) => { if (alive) setUrl(value || ''); }).catch(() => {}); return () => { alive = false; }; }, [item.avatarPath, item.profileId]);
  const icon = ({ friend: '＋', judge: '⚖', tournament: '↗', site: '·' })[item.icon] || '·';
  return <span className="notification-mini-icon">{url ? <img src={url} alt="" width="32" height="32" loading="lazy" /> : icon}</span>;
}

function routeFor(item) {
  const href = item.href;
  if (!href) return null;
  if (href.startsWith('/react/')) return href.slice('/react'.length);
  if (href.startsWith('/torneo.html')) return href.replace('/torneo.html', '/torneo');
  if (href.startsWith('/torneos.html')) return '/torneos';
  if (href.startsWith('/amigos.html')) return '/amigos';
  if (href.startsWith('/perfil.html?id=')) { const id = new URL(href, location.origin).searchParams.get('id'); return id ? `/perfil/${encodeURIComponent(id)}` : '/perfil'; }
  if (href === '/' || href === '/index.html') return '/';
  return null;
}

export default function NotificationsPanel() {
  const { status } = useAuth();
  const [items, setItems] = useState([]); const [open, setOpen] = useState(false); const [failure, setFailure] = useState(false); const [read, setRead] = useState(new Set()); const [announcement, setAnnouncement] = useState('');
  const audio = useRef(null); const soundOn = useRef(notificationSoundEnabled()); const queuedSound = useRef(false); const userId = useRef(''); const seen = useRef(new Set()); const generation = useRef(0); const openRef = useRef(open); openRef.current = open;
  const unread = useMemo(() => items.filter((item) => !read.has(item.id)).length, [items, read]);
  const persistRead = useCallback((list, accountId = userId.current) => {
    if (!accountId) return;
    const next = new Set(list.map((item) => item.id)); setRead(next);
    try { localStorage.setItem(`proveit:read-notifications:${accountId}`, JSON.stringify([...next])); } catch {}
  }, []);
  const playSound = useCallback(() => {
    if (!soundOn.current) return;
    const context = audio.current;
    if (!context || context.state !== 'running') { queuedSound.current = true; return; }
    queuedSound.current = false;
    for (const [offset, frequency] of [[0, 660], [.16, 880]]) {
      const oscillator = context.createOscillator(), gain = context.createGain(), start = context.currentTime + offset;
      oscillator.frequency.value = frequency; gain.gain.setValueAtTime(0, start); gain.gain.linearRampToValueAtTime(.09, start + .015); gain.gain.exponentialRampToValueAtTime(.001, start + .2);
      oscillator.connect(gain); gain.connect(context.destination); oscillator.start(start); oscillator.stop(start + .22);
    }
  }, []);
  const refresh = useCallback(async () => {
    if (status !== 'signed-in' || document.hidden) return;
    const token = ++generation.current;
    try {
      const account = await getCurrentUser(); if (token !== generation.current) return;
      if (userId.current !== account.userId) {
        userId.current = account.userId;
        try { seen.current = new Set(JSON.parse(localStorage.getItem(`proveit:seen-notifications:${account.userId}`) || '[]')); } catch { seen.current = new Set(); }
        try { const stored = JSON.parse(localStorage.getItem(`proveit:read-notifications:${account.userId}`) || '[]'); setRead(new Set(Array.isArray(stored) ? stored : [])); } catch { setRead(new Set()); }
      }
      const [invites, feed] = await Promise.all([pendingInvitations(), communityAction('NOTIFICATIONS')]); if (token !== generation.current) return;
      const next = notificationItems(invites, feed), newCount = next.filter((item) => !seen.current.has(item.id)).length;
      next.forEach((item) => seen.current.add(item.id)); setItems(next); setFailure(false);
      try { localStorage.setItem(`proveit:seen-notifications:${account.userId}`, JSON.stringify([...seen.current].slice(-300))); } catch {}
      if (newCount) { setAnnouncement(newCount === 1 ? 'Nueva notificación.' : 'Nuevas notificaciones.'); playSound(); }
      if (openRef.current) persistRead(next, account.userId);
    } catch { if (token === generation.current) setFailure(true); }
  }, [persistRead, playSound, status]);

  useEffect(() => {
    const unlock = async () => {
      if (!soundOn.current) return;
      try { const Constructor = window.AudioContext || window.webkitAudioContext; if (!Constructor) return; audio.current ||= new Constructor(); if (audio.current.state === 'suspended') await audio.current.resume(); if (queuedSound.current) playSound(); } catch {}
    };
    const soundChanged = () => { soundOn.current = notificationSoundEnabled(); if (!soundOn.current) queuedSound.current = false; };
    document.addEventListener('pointerdown', unlock); document.addEventListener('keydown', unlock); window.addEventListener('proveit:notification-sound-changed', soundChanged);
    return () => { document.removeEventListener('pointerdown', unlock); document.removeEventListener('keydown', unlock); window.removeEventListener('proveit:notification-sound-changed', soundChanged); void audio.current?.close().catch(() => {}); audio.current = null; };
  }, [playSound]);
  useEffect(() => {
    if (status !== 'signed-in') { generation.current++; userId.current = ''; seen.current = new Set(); setItems([]); setRead(new Set()); setFailure(false); return undefined; }
    void refresh();
    const timer = window.setInterval(() => { if (!document.hidden) void refresh(); }, 20_000);
    const onVisible = () => { if (!document.hidden) void refresh(); };
    const onChanged = () => void refresh();
    document.addEventListener('visibilitychange', onVisible); window.addEventListener('proveit:invitation-updated', onChanged); window.addEventListener('proveit:social-updated', onChanged); window.addEventListener('proveit:tournament-deleted', onChanged);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); window.removeEventListener('proveit:invitation-updated', onChanged); window.removeEventListener('proveit:social-updated', onChanged); window.removeEventListener('proveit:tournament-deleted', onChanged); generation.current++; };
  }, [refresh, status]);

  function toggle() {
    const nextOpen = !open; setOpen(nextOpen);
    if (nextOpen) { setAnnouncement(''); if (userId.current) persistRead(items); void refresh(); }
  }
  return <div className="club-notifications"><button className="notification-bell" type="button" aria-label={unread ? `Notificaciones: ${unread} sin leer` : 'Notificaciones'} aria-expanded={open} aria-controls="clubNotificationsPanel" onClick={toggle}>
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 17h14l-2-3V9a5 5 0 0 0-10 0v5zM10 20h4" /></svg>{unread > 0 && <span className="notification-count" aria-hidden="true">{unread > 99 ? '99+' : unread}</span>}
  </button><section className="notification-panel" id="clubNotificationsPanel" hidden={!open} aria-label="Notificaciones"><h2>Notificaciones</h2><div className="notification-list">
    {items.length ? items.map((item) => { const to = routeFor(item); const content = <><NotificationAvatar item={item} /><span className="notification-copy">{item.text}</span></>; return to ? <Link className="notification-item" key={item.id} to={to} onClick={() => { setOpen(false); persistRead(items); }}>{content}</Link> : <div className="notification-item" key={item.id}>{content}</div>; }) : <p className="notification-empty">{failure ? 'No pudimos cargar las notificaciones.' : 'No tenés notificaciones.'}</p>}
  </div><span className="notification-sr" role="status" aria-live="polite">{announcement}</span></section></div>;
}
