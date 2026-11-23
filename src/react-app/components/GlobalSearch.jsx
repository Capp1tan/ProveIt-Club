import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { clubDirectory } from '../../community-api.js';
import { listClubTournaments } from '../../tournaments-api.js';
import { avatarUrl } from '../../auth-client.js';
import '../../../site-search.css';

const readArray = (key) => { try { const data = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(data) ? data : []; } catch { return []; } };
function SearchAvatar({ profile }) {
  const [src, setSrc] = useState('');
  useEffect(() => { let active = true; if (profile.avatarPath) void avatarUrl(profile.avatarPath, { profileId: profile.id }).then((url) => { if (active) setSrc(url || ''); }).catch(() => {}); return () => { active = false; }; }, [profile.id, profile.avatarPath]);
  return <span className="person-avatar">{src ? <img src={src} alt="" width="34" height="34" loading="lazy" /> : (profile.nickname?.[0] || '?')}</span>;
}

export default function GlobalSearch() {
  const [open, setOpen] = useState(false); const [query, setQuery] = useState(''); const [people, setPeople] = useState([]); const [tournaments, setTournaments] = useState([]); const [loading, setLoading] = useState(false); const [error, setError] = useState(''); const [recent, setRecent] = useState(() => readArray('proveit:recent-searches')); const [hidden, setHidden] = useState(() => readArray('proveit:hidden-search-suggestions'));
  const dialog = useRef(null); const input = useRef(null); const epoch = useRef(0);
  useEffect(() => {
    const element = dialog.current;
    if (!open || !element) return undefined;
    if (!element.open) element.showModal();
    input.current?.focus();
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) element.animate([{ opacity: 0, transform: 'translateY(8px) scale(.985)' }, { opacity: 1, transform: 'none' }], { duration: 190, easing: 'cubic-bezier(.23,1,.32,1)' });
    const token = ++epoch.current; let alive = true;
    setQuery(''); setLoading(true); setError(''); setPeople([]); setTournaments([]);
    void Promise.all([clubDirectory(), listClubTournaments()]).then(([profiles, events]) => { if (alive && token === epoch.current) { setPeople(profiles); setTournaments(events); } }).catch((cause) => { if (alive && token === epoch.current) setError(cause.message || 'No pudimos cargar la búsqueda.'); }).finally(() => { if (alive && token === epoch.current) setLoading(false); });
    return () => { alive = false; epoch.current++; if (element.open) element.close(); };
  }, [open]);
  const normalized = query.trim().toLocaleLowerCase('es');
  const matches = useMemo(() => normalized ? people.filter((p) => !hidden.includes(p.id) && p.nickname?.toLocaleLowerCase('es').includes(normalized)).slice(0, 20) : [], [people, hidden, normalized]);
  const events = useMemo(() => normalized ? tournaments.filter((t) => !hidden.includes(t.id) && `${t.name} ${t.activity}`.toLocaleLowerCase('es').includes(normalized)).slice(0, 20) : [], [tournaments, hidden, normalized]);
  function remember(label, href) { const entry = { label, query: label, url: href }; const next = [entry, ...recent.filter((item) => item.label !== label)].slice(0, 12); setRecent(next); try { localStorage.setItem('proveit:recent-searches', JSON.stringify(next)); } catch {} }
  function removeHidden(id) { const next = [...new Set([...hidden, id])].slice(-200); setHidden(next); try { localStorage.setItem('proveit:hidden-search-suggestions', JSON.stringify(next)); } catch {} }
  function close() { setOpen(false); }
  return <>
    <button className="club-search-toggle" type="button" aria-label="Buscar personas y torneos" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m15.5 15.5 5 5" /></svg><span>Buscar</span></button>
    <dialog ref={dialog} className="club-search-dialog" aria-label="Buscar en el club" onCancel={(event) => { event.preventDefault(); close(); }} onClick={(event) => { if (event.target === dialog.current) close(); }}>
      <div className="club-search-head"><h2>Buscar en el club</h2><button className="club-search-close" type="button" aria-label="Cerrar buscador" onClick={close}>×</button></div>
      <input ref={input} type="search" maxLength={100} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Torneo, jugador o algo para hacer" aria-label="Buscar personas y torneos" onKeyDown={(event) => { if (event.key === 'Enter' && normalized) remember(query.trim(), ''); }} />
      <div className="club-search-links"><Link to="/amigos" onClick={close}>Amigos y solicitudes</Link><Link to="/torneos" onClick={close}>Todos los torneos</Link></div>
      {recent.length > 0 && <div className="club-search-history"><small>Búsquedas recientes</small>{recent.map((item) => <div className="club-search-history-row" key={item.label}><button type="button" onClick={() => setQuery(item.query || item.label)}>{item.label}</button><button type="button" aria-label={`Eliminar búsqueda ${item.label}`} onClick={() => { const next = recent.filter((entry) => entry.label !== item.label); setRecent(next); try { localStorage.setItem('proveit:recent-searches', JSON.stringify(next)); } catch {} }}>×</button></div>)}<button type="button" onClick={() => { setRecent([]); try { localStorage.removeItem('proveit:recent-searches'); } catch {} }}>Borrar historial</button></div>}
      <p className="club-search-status" role="status">{loading ? 'Cargando personas y torneos…' : error || (normalized && !matches.length && !events.length ? 'No hay coincidencias. Ingresá con tu cuenta si todavía no lo hiciste.' : '')}</p>
      <div className="club-search-results">{matches.length > 0 && <><h3>Personas</h3>{matches.map((person) => { const href = `/perfil/${encodeURIComponent(person.id)}`; return <Link className="club-search-result-row club-search-person" key={person.id} to={href} onClick={() => { remember(person.nickname, href); close(); }}><SearchAvatar profile={person} /><span>{person.nickname}</span></Link>; })}</>}{events.length > 0 && <><h3>Torneos</h3>{events.map((item) => { const href = `/torneo?id=${encodeURIComponent(item.id)}`; return <div className="club-search-result-row" key={item.id}><Link to={href} onClick={() => { remember(item.name, href); close(); }}><strong>{item.name}</strong><small>{item.activity}</small></Link><button type="button" aria-label={`Ocultar sugerencia ${item.name}`} onClick={() => removeHidden(item.id)}>×</button></div>; })}</>}</div>
    </dialog>
  </>;
}
