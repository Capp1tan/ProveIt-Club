import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { avatarUrl } from '../../auth-client.js';
import { registeredProfiles } from '../../tournaments-api.js';
import { socialAction } from '../../social-api.js';
import { loadBadges, badgeElements } from '../../badges.js';
import { useAuth } from '../auth/AuthProvider.jsx';
import './FriendsPage.css';

const tabs = [['friends', 'Amigos'], ['incoming', 'Solicitudes'], ['outgoing', 'Enviadas']];

function FriendAvatar({ profile }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    let active = true;
    if (profile?.avatarPath) void avatarUrl(profile.avatarPath, { profileId: profile.id }).then((url) => { if (active) setSrc(url || ''); }).catch(() => {});
    return () => { active = false; };
  }, [profile?.id, profile?.avatarPath]);
  return <span className="react-friend-avatar">{src ? <img src={src} alt="" loading="lazy" /> : Array.from(profile?.nickname || '?')[0]?.toUpperCase()}</span>;
}

function Badges({ profile, refreshKey }) {
  const host = useRef(null);
  useEffect(() => { if (host.current) host.current.replaceChildren(badgeElements(profile?.owner?.split('::')[0])); }, [profile?.owner, refreshKey]);
  return <span className="react-friend-badges" ref={host} />;
}

export default function FriendsPage() {
  const { status: authStatus, user, profile: ownProfile } = useAuth();
  const [params, setParams] = useSearchParams();
  const [state, setState] = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [badgesVersion, setBadgesVersion] = useState(0);
  const [tab, setTab] = useState(tabs.some(([id]) => id === params.get('tab')) ? params.get('tab') : 'friends');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState('');
  const handledTarget = useRef('');

  const refresh = useCallback(async (quiet = false) => {
    if (authStatus !== 'signed-in') return;
    if (!quiet) setLoading(true);
    setError('');
    try {
      const [next, people] = await Promise.all([socialAction('STATE'), registeredProfiles()]);
      setState(next); setProfiles(people); setError('');
    } catch (cause) { setError(cause?.message || 'No pudimos cargar tus amistades.'); }
    finally { setLoading(false); }
  }, [authStatus, user?.userId]);

  useEffect(() => { if (authStatus === 'signed-in') void refresh(); else setLoading(false); }, [authStatus, refresh]);
  useEffect(() => {
    if (authStatus !== 'signed-in') return undefined;
    const timer = window.setInterval(() => { if (!document.hidden) void refresh(true); }, 30_000);
    const visible = () => { if (!document.hidden) void refresh(true); };
    document.addEventListener('visibilitychange', visible);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', visible); };
  }, [authStatus, refresh]);
  useEffect(() => { let active = true; void loadBadges().then(() => { if (active) setBadgesVersion((v) => v + 1); }).catch(() => {}); return () => { active = false; }; }, [user?.userId]);
  useEffect(() => {
    const target = params.get('persona');
    if (!target || !state || handledTarget.current === target) return;
    handledTarget.current = target;
    if (state.friends.some((item) => item.profileId === target)) void openChat(target);
    else if (state.incoming.some((item) => item.profileId === target)) chooseTab('incoming');
    else if (state.outgoing.some((item) => item.profileId === target)) chooseTab('outgoing');
    else { setPickerOpen(true); setQuery(peopleById.get(target)?.nickname || ''); }
  }, [state, params, peopleById]);

  const taken = useMemo(() => new Set([...(state?.friends || []), ...(state?.incoming || []), ...(state?.outgoing || [])].map((item) => item.profileId)), [state]);
  const available = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('es');
    return profiles.filter((person) => person.accountComplete !== false && person.id !== ownProfile?.id && person.owner?.split('::')[0] !== user?.userId && !person.owner?.startsWith(`${user?.userId}::`) && !taken.has(person.id) && q && person.nickname.toLocaleLowerCase('es').includes(q)).slice(0, 20);
  }, [profiles, query, taken, ownProfile?.id, user?.userId]);
  const peopleById = useMemo(() => new Map(profiles.map((person) => [person.id, person])), [profiles]);

  function chooseTab(id) {
    setTab(id);
    const next = new URLSearchParams(params); if (id === 'friends') next.delete('tab'); else next.set('tab', id);
    setParams(next, { replace: true });
  }

  async function act(action, profileId) {
    if (busyId) return;
    const person = peopleById.get(profileId);
    if (action === 'REMOVE' && !window.confirm(`¿Quitar a ${person?.nickname || 'esta persona'} de tus amigos? El chat quedará inaccesible hasta que vuelvan a agregarse.`)) return;
    setBusyId(profileId); setNotice('Guardando…'); setError('');
    try { await socialAction(action, { targetProfileId: profileId }); await refresh(true); setNotice(({ REQUEST: 'Solicitud enviada.', ACCEPT: '¡Sumaste un amigo! Ya pueden chatear.', DECLINE: 'Solicitud rechazada.', CANCEL: 'Solicitud cancelada.', REMOVE: 'Amistad eliminada.' })[action] || 'Listo.'); window.dispatchEvent(new Event('proveit:social-updated')); }
    catch (cause) { setError(cause?.message || 'No pudimos guardar el cambio.'); }
    finally { setBusyId(''); }
  }

  async function openChat(profileId) {
    const person = peopleById.get(profileId);
    try { const { openDirectChat } = await import('../../chat-dock.js'); openDirectChat({ profileId, name: person?.nickname || 'Chat privado' }); }
    catch (cause) { setError(cause?.message || 'No pudimos abrir el chat.'); }
  }

  async function share() {
    const data = { title: 'ProveIt Club', text: 'Armemos un desafío en ProveIt. Creá tu perfil y te agrego.', url: location.origin };
    try { if (navigator.share) await navigator.share(data); else { await navigator.clipboard.writeText(data.url); setNotice('Link copiado. Pasalo por el grupo.'); } }
    catch (cause) { if (cause?.name !== 'AbortError') setError('No pudimos compartir el enlace.'); }
  }

  const current = state?.[tab] || [];

  if (authStatus !== 'signed-in' && !loading) return <main className="react-friends-page"><section className="react-friends-panel"><p className="react-eyebrow">PROVEIT CLUB</p><h1>Amigos</h1><p>Ingresá para ver solicitudes, amistades y chats.</p><Link className="react-primary" to="/ingresar">Ingresar ↗</Link></section></main>;

  return <main className="react-friends-page">
    <header className="react-friends-heading"><div><p className="react-eyebrow">TU GRUPO EN PROVEIT</p><h1>Amigos</h1><p>Sumá rivales, organizá desafíos y sigan la charla.</p></div><button className="react-primary" type="button" onClick={() => { setPickerOpen(true); setQuery(''); setNotice(''); }}>＋ Agregar amigos</button></header>
    {state && <p className="react-friends-limit">{state.friends.length} amigos · {state.limit === null ? 'sin límite para tu cuenta' : `${state.limit} como máximo`}</p>}
    <section className="react-friends-panel">
      <div className="react-friends-tabs" role="tablist" aria-label="Amigos y solicitudes">{tabs.map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => chooseTab(id)}>{label}<span>{state?.[id]?.length || 0}</span></button>)}</div>
      {(notice || error) && <p className={`react-friends-notice${error ? ' is-error' : ''}`} role={error ? 'alert' : 'status'}>{error || notice}</p>}
      {loading ? <p className="react-friends-empty" role="status">Cargando amistades…</p> : error && !state ? <div className="react-friends-empty"><h2>No se pudieron cargar</h2><button type="button" onClick={() => void refresh()}>Reintentar</button></div> : current.length ? <ul className="react-friends-list">{current.map((ref) => {
        const person = peopleById.get(ref.profileId); const name = person?.nickname || 'Cuenta no disponible';
        return <li key={ref.profileId} className="react-friend-row"><FriendAvatar profile={person} /><div className="react-friend-copy"><Link to={`/perfil/${encodeURIComponent(ref.profileId)}`}>{name}</Link><Badges profile={person} refreshKey={badgesVersion} /><small>{tab === 'incoming' ? 'Solicitud recibida' : tab === 'outgoing' ? 'Solicitud pendiente' : 'Amigo en ProveIt'}</small></div><div className="react-friend-actions">
          {tab === 'friends' && <><button type="button" onClick={() => void openChat(ref.profileId)}>Chatear</button><Link to={`/crear-torneo?rival=${encodeURIComponent(ref.profileId)}`}>Desafiar</Link><button className="is-subtle" type="button" onClick={() => void act('REMOVE', ref.profileId)} disabled={Boolean(busyId)}>{busyId === ref.profileId ? 'Guardando…' : 'Quitar'}</button></>}
          {tab === 'incoming' && <><button type="button" onClick={() => void act('ACCEPT', ref.profileId)} disabled={Boolean(busyId)}>{busyId === ref.profileId ? 'Guardando…' : 'Aceptar'}</button><button className="is-subtle" type="button" onClick={() => void act('DECLINE', ref.profileId)} disabled={Boolean(busyId)}>Rechazar</button></>}
          {tab === 'outgoing' && <button className="is-subtle" type="button" onClick={() => void act('CANCEL', ref.profileId)} disabled={Boolean(busyId)}>Cancelar</button>}
        </div></li>;
      })}</ul> : <div className="react-friends-empty"><span aria-hidden="true">◇</span><h2>{tab === 'friends' ? 'Tu grupo está vacío' : tab === 'incoming' ? 'Nada para responder' : 'No mandaste solicitudes'}</h2><p>{tab === 'friends' ? 'Sumá a quienes siempre dicen “yo te gano”.' : tab === 'incoming' ? 'Cuando alguien te mande una solicitud, aparece acá.' : 'Buscá a tu gente y mandales una.'}</p>{tab !== 'incoming' && <button type="button" className="react-secondary" onClick={() => setPickerOpen(true)}>Buscar personas ↗</button>}{tab === 'friends' && <button type="button" className="react-secondary" onClick={() => void share()}>Compartir enlace</button>}</div>}
    </section>
    {pickerOpen && <div className="react-friends-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setPickerOpen(false); }}><section className="react-friends-picker" role="dialog" aria-modal="true" aria-labelledby="react-friends-picker-title"><header><div><p className="react-eyebrow">ENCONTRÁ A TU GENTE</p><h2 id="react-friends-picker-title">Agregar amigos</h2></div><button type="button" onClick={() => setPickerOpen(false)} aria-label="Cerrar">×</button></header><label className="react-friends-search">Buscar por nickname<input type="search" autoFocus maxLength={24} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Escribí un nick" /></label><div className="react-friends-picker-list">{available.map((person) => <article key={person.id}><FriendAvatar profile={person} /><Link to={`/perfil/${encodeURIComponent(person.id)}`} onClick={() => setPickerOpen(false)}>{person.nickname}</Link><Badges profile={person} refreshKey={badgesVersion} /><button type="button" onClick={() => void act('REQUEST', person.id)} disabled={Boolean(busyId)}>{busyId === person.id ? 'Enviando…' : 'Agregar'}</button></article>)}</div><p className="react-friends-picker-note">{!query ? 'Escribí un nick para encontrar personas.' : available.length ? `${available.length} resultados` : 'No encontramos personas disponibles con ese nick.'}</p></section></div>}
  </main>;
}
