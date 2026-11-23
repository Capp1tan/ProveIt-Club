import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { avatarUrl, fetchUserAttributes, loadProfile, saveAvatar, saveProfile, signOut } from '../../auth-client.js';
import { viewClubProfile } from '../../community-api.js';
import { initializeAccess } from '../../badges.js';
import { communityAction } from '../../community-api.js';
import { useAuth } from '../auth/AuthProvider.jsx';
import './ProfilePage.css';
import '../../../community.css';
import '../../../leagues.css';
import '../../../site-theme.css';

const countries = [
  ['AR', 'Argentina', '+549'], ['CL', 'Chile', '+56'], ['PY', 'Paraguay', '+595'],
  ['UY', 'Uruguay', '+598'], ['PE', 'Perú', '+51'], ['BR', 'Brasil', '+55'],
];
const networkFields = ['instagram', 'twitch', 'discord', 'custom'];
const networkLabels = { instagram: 'Instagram', twitch: 'Twitch', discord: 'Discord', custom: 'Otro enlace' };
const parseLinks = (value) => { try { return JSON.parse(value || '{}'); } catch { return {}; } };

function Avatar({ profile, editable = false, onChange }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    let active = true;
    if (profile?.avatarPath) void avatarUrl(profile.avatarPath, { profileId: profile.id }).then((url) => { if (active) setSrc(url || ''); }).catch(() => {});
    else setSrc('');
    return () => { active = false; };
  }, [profile?.id, profile?.avatarPath]);
  return <label className={`react-profile-avatar${editable ? ' is-editable' : ''}`}>{src ? <img src={src} alt={`${profile?.nickname || 'Perfil'} foto de perfil`} /> : <span>{Array.from(profile?.nickname || '?')[0]?.toUpperCase()}</span>}{editable && <><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => onChange(event.target.files?.[0] || null)} /><small>Cambiar foto</small></>}</label>;
}

function Journey({ profile, own }) {
  const [data, setData] = useState(null);
  const [failure, setFailure] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!profile?.canView) return undefined;
    let active = true;
    setData(null); setFailure('');
    void communityAction('PROGRESS', { targetProfileId: profile.id }).then((result) => {
      if (!active) return;
      if (result.hidden) { setData({ hidden: true }); return; }
      if (!Array.isArray(result.history) || !Array.isArray(result.achievements) || !Number.isFinite(result.xp)) throw new Error('La actualización de ligas todavía no está disponible.');
      setData(result);
    }).catch((error) => { if (active) setFailure(error.message || 'Intentá otra vez en unos momentos.'); });
    return () => { active = false; };
  }, [profile?.id, profile?.canView, attempt]);
  if (!profile?.canView) return <section className="league-panel"><h2>Recorrido privado</h2><p>Las ligas, participaciones y logros de este perfil sólo están disponibles para sus amigos.</p></section>;
  if (failure) return <section className="league-panel"><h2>No pudimos cargar el recorrido</h2><p>{failure}</p><button className="league-action" type="button" onClick={() => setAttempt((value) => value + 1)}>Reintentar</button></section>;
  if (!data) return <section className="league-panel" aria-busy="true"><h2>Liga y participaciones</h2><p>Cargando tu recorrido en el club…</p></section>;
  if (data.hidden) return <section className="league-panel"><h2>Recorrido privado</h2><p>Este perfil sólo comparte su recorrido con amigos.</p></section>;
  const formatDate = (value) => new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value));
  return <div className="react-profile-journey">
    <section className="league-current league-panel"><div className="league-current-identity">{data.rank ? <span className="league-symbol" style={{ backgroundPosition: `${data.rank.index % 4 * 100 / 3}% ${data.rank.index < 4 ? '0%' : '100%'}` }} aria-hidden="true" /> : <span className="league-unranked" aria-hidden="true">◇</span>}<div><p className="league-eyebrow">{data.rank ? 'LIGA ACTUAL' : 'TU RECORRIDO EMPIEZA ACÁ'}</p><h2>{data.rank?.name || 'Sin liga'}</h2></div></div><div className="league-experience">{!data.rank ? <><p>Competí para desbloquear ligas y recompensas.</p><small>Completá tu primer torneo válido para obtener tu primera liga. Los logros son la primera recompensa; los premios reales se anunciarán por separado.</small><Link className="league-action" to="/torneos">Buscar torneos ↗</Link></> : <><h3>Experiencia</h3><progress max={data.nextMinimum || Math.max(1, data.xp)} value={data.xp} aria-label="Experiencia acumulada" /><p>{data.nextMinimum ? `${data.xp.toLocaleString('es')} / ${data.nextMinimum.toLocaleString('es')} XP` : `${data.xp.toLocaleString('es')} XP · Liga máxima`}</p><small>La experiencia reconoce tu recorrido en el club. No representa un saldo de dinero.</small></>}</div></section>
    <div className="league-histories"><section className="league-panel"><h2>Historial de participaciones</h2>{!data.history.length ? <p>Todavía no hay participaciones confirmadas. Tu próximo desafío puede ser el primero.</p> : <><div className="league-history-labels" aria-hidden="true"><span>TORNEO</span><span>FECHA</span><span>RESULTADO</span></div><ul className="league-event-list">{data.history.map((event) => { const closed = event.roomClosed || (event.roomClosesAt && Date.now() >= event.roomClosesAt); const content = <><span className="league-event-identity"><img className="league-event-image" src={event.coverUrl || `/tournaments/${event.status === 'COMPLETED' ? 'trophy' : 'arena'}.svg`} alt={event.coverUrl ? `Portada de ${event.name}` : ''} loading="lazy" onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = `/tournaments/${event.status === 'COMPLETED' ? 'trophy' : 'arena'}.svg`; }} /><span><strong>{event.name}</strong><small>{event.activity} · {event.role}</small>{closed && <small className="league-room-closed">Sala cerrada</small>}</span></span><time className="league-event-date" dateTime={event.date}>{formatDate(event.date)}</time><span className="league-result" data-tone={['gold', 'silver', 'bronze'].includes(event.resultTone) ? event.resultTone : 'neutral'}>{event.result}</span></>; return <li key={event.id}><div className="league-event-row">{closed ? <article className="league-event">{content}</article> : <Link className="league-event" to={`/torneo?id=${encodeURIComponent(event.id)}`}>{content}</Link>}{own && closed && event.canCommentOnJudge && <Link className="league-action" to={`/torneo?id=${encodeURIComponent(event.id)}`}>Comentar al juez</Link>}</div></li>; })}</ul>{data.history.length === 20 && <small>Se muestran las últimas 20 participaciones.</small>}</>}</section><section className="league-panel"><h2>Historial de logros</h2>{!data.achievements.length ? <p>Tus primeros logros aparecerán al completar torneos válidos.</p> : <ul className="league-achievements">{data.achievements.map((item) => <li key={`${item.kind}-${item.date}-${item.title}`}><span className="league-achievement-mark" aria-hidden="true">{item.kind === 'victory' ? '★' : '✦'}</span><span><strong>{item.title}</strong><small>{formatDate(item.date)}</small></span></li>)}</ul>}</section></div>
    <details className="league-rules"><summary>Cómo se obtiene experiencia</summary><p>25 XP por torneo completado y 10 XP adicionales por victoria. Sólo cuentan eventos creados y terminados desde el lanzamiento de ligas, con al menos dos participantes confirmados y resultado definitivo. Máximo tres eventos por día UTC y uno por el mismo grupo de rivales al día. Invitaciones pendientes, cancelaciones, pagos revertidos y resultados por sanción no suman. Los torneos anteriores se conservan en el historial sin otorgar XP retroactiva.</p></details>
  </div>;
}

function PublicSocials({ profile }) {
  if (!profile?.canView) return null;
  const links = parseLinks(profile.socialLinks);
  const labels = { instagram: 'Instagram', twitch: 'Twitch', discord: 'Discord', custom: 'Enlace personal' };
  const paths = {
    instagram: <><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".7"/></>,
    twitch: <path d="M4 3h17v12l-5 5h-5l-4 3v-3H3V6zM8 3v13h4v3l3-3h4V3M12 7v5m4-5v5"/>,
    discord: <><path d="M8 5 5 6 2 17l5 2 1-2m8-12 3 1 3 11-5 2-1-2M7 8c3-2 7-2 10 0M6 16c4 2 8 2 12 0"/><circle cx="8" cy="12" r="1"/><circle cx="16" cy="12" r="1"/></>,
    custom: <path d="m9 15 6-6m-7 9-1 1a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0m0 8a4 4 0 0 0 6 0l5-5a4 4 0 0 0-6-6l-1 1" />,
  };
  const entries = Object.entries(links).filter(([key, value]) => labels[key] && typeof value === 'string' && value.trim());
  return <div className="react-profile-social-display">{entries.map(([key, value]) => {
    const isDiscordName = key === 'discord' && !value.startsWith('https://');
    let href = '';
    if (!isDiscordName) { try { const url = new URL(value); if (url.protocol !== 'https:' || url.username || url.password) return null; href = url.href; } catch { return null; } }
    const content = <><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">{paths[key]}</svg><span>{labels[key]}</span></>;
    return isDiscordName ? <button className="social-icon" type="button" key={key} title="Copiar usuario de Discord" aria-label="Copiar usuario de Discord" onClick={async (event) => { try { await navigator.clipboard.writeText(value); event.currentTarget.querySelector('span').textContent = 'Copiado'; } catch { event.currentTarget.querySelector('span').textContent = value; } }}>{content}</button> : <a className="social-icon" key={key} href={href} target="_blank" rel="noopener noreferrer" title={`Abrir ${labels[key]}`} aria-label={`Abrir ${labels[key]}`}>{content}</a>;
  })}</div>;
}

function Reputation({ profile }) {
  const rep = profile.reputation;
  if (!profile.judgeEnabled && !(rep?.events || rep?.votes || rep?.confirmedReports)) return null;
  return <section className="judge-reputation"><h3>Reputación como juez</h3>{!rep ? <p>Cargando reputación…</p> : <>
    {rep.stars === null ? <p>Sin valoraciones</p> : <><div className="judge-stars" role="img" aria-label={`${rep.stars} de 5 estrellas`}><span>★★★★★</span><span style={{ width: `${rep.stars / 5 * 100}%` }}>★★★★★</span></div><strong>{rep.stars.toLocaleString('es')} / 5</strong></>}
    <p>{rep.events} torneos arbitrados · {rep.votes} valoraciones</p><small>{rep.positive} positivas · {rep.negative} negativas · {rep.confirmedReports} reclamos confirmados</small>
    {rep.votes > 0 && rep.votes < 5 && <small>Pocas valoraciones. Consultá también la cantidad de eventos.</small>}<small>Las estrellas reflejan votos: 1 + 4 × proporción positiva. Los reclamos se muestran por separado.</small>
    {rep.comments?.length > 0 && <details className="judge-comment-list"><summary>Comentarios recibidos ({rep.comments.length})</summary>{rep.comments.map((entry, index) => <article className="judge-feedback" key={`${entry.tournamentName}-${index}`}><strong>{entry.tournamentName}</strong><p>{entry.comment}</p></article>)}</details>}
  </>}</section>;
}

function normalizePhone(country, value) {
  const cleaned = value.trim();
  if (!cleaned) return '';
  if (cleaned.startsWith('+')) return `+${cleaned.replace(/\D/g, '')}`;
  const prefix = countries.find(([code]) => code === country)?.[2] || '';
  return prefix + cleaned.replace(/\D/g, '').replace(/^0+/, '');
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const { status: authStatus, user, profile: sessionProfile } = useAuth();
  const { profileId: pathProfileId } = useParams();
  const [params] = useSearchParams();
  const targetId = pathProfileId || params.get('id');
  const isOwn = !targetId || targetId === sessionProfile?.id;
  const [profile, setProfile] = useState(isOwn ? sessionProfile : null);
  const [account, setAccount] = useState(null);
  const [access, setAccess] = useState({ phoneOptional: false });
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState(false);
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState('');
  const [fields, setFields] = useState({ nickname: '', bio: '', country: '', phone: '', visibility: 'PRIVATE', ...Object.fromEntries(networkFields.map((key) => [key, ''])) });

  useEffect(() => {
    let active = true;
    setBusy(true);
    const load = async () => {
      try {
        if (isOwn) {
          const [{ profile: ownProfile, account: privateAccount }, permissions] = await Promise.all([loadProfile({ includePrivate: true }), initializeAccess()]);
          if (!active) return;
          setProfile(ownProfile ? { ...ownProfile, canView: true } : null);
          setAccount(privateAccount);
          setAccess(permissions || { phoneOptional: false });
          if (ownProfile) {
            const links = parseLinks(ownProfile.socialLinks);
            setFields({ nickname: ownProfile.nickname || '', bio: ownProfile.bio || '', country: ownProfile.country || privateAccount?.country || '', phone: privateAccount?.phoneNumber || '', visibility: ownProfile.visibility === 'PUBLIC' ? 'PUBLIC' : 'PRIVATE', ...Object.fromEntries(networkFields.map((key) => [key, links[key] || ''])) });
          } else {
            try {
              const attributes = await fetchUserAttributes();
              let signupCountry = '';
              try { const draft = JSON.parse(sessionStorage.getItem('proveit:signup-country') || '{}'); if (draft.email === attributes.email?.toLowerCase()) signupCountry = draft.country || ''; } catch {}
              if (active) setFields((current) => ({ ...current, nickname: attributes.nickname || '', phone: privateAccount?.phoneNumber || attributes.phone_number || '', country: signupCountry }));
            } catch {}
          }
        } else {
          const result = await viewClubProfile(targetId);
          if (!result) throw new Error('Este perfil no está disponible.');
          if (!active) return;
          setProfile(result);
        }
      } catch (cause) {
        if (active) { setNotice(cause?.message || 'No pudimos cargar el perfil.'); setError(true); }
      } finally { if (active) setBusy(false); }
    };
    if (authStatus === 'signed-in') void load();
    else if (authStatus !== 'checking') { setBusy(false); setNotice('Iniciá sesión para ver los perfiles del club.'); }
    return () => { active = false; };
  }, [authStatus, isOwn, targetId, user?.userId]);

  useEffect(() => {
    if (!avatarFile) { setAvatarPreview(''); return undefined; }
    const url = URL.createObjectURL(avatarFile);
    setAvatarPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [avatarFile]);

  const set = (key, value) => setFields((current) => ({ ...current, [key]: value }));
  const ownProfileReady = Boolean(profile?.id);

  async function submit(event) {
    event.preventDefault();
    if (saving) return;
    if (!fields.country) { setNotice('Elegí tu país.'); setError(true); return; }
    if (!access.phoneOptional && !fields.phone.trim()) { setNotice('Completá tu teléfono para guardar el perfil.'); setError(true); return; }
    setSaving(true); setError(false); setNotice('Guardando perfil…');
    try {
      let avatarPath = profile?.avatarPath || '';
      if (avatarFile) avatarPath = await saveAvatar(avatarFile);
      const social = Object.fromEntries(networkFields.map((key) => [key, fields[key].trim()]));
      const saved = await saveProfile(profile?.id || null, {
        nickname: fields.nickname, bio: fields.bio, avatarPath,
        phoneNumber: normalizePhone(fields.country, fields.phone), country: fields.country,
        visibility: fields.visibility, judgeEnabled: true, socialLinks: JSON.stringify(social),
      });
      const next = { ...profile, ...saved, id: saved.id || profile?.id, avatarPath, socialLinks: JSON.stringify(social), canView: true };
      setProfile({ ...next, canView: true }); setAvatarFile(null); setNotice('Perfil guardado.');
      try { sessionStorage.removeItem('proveit:signup-country'); } catch {}
      window.dispatchEvent(new Event('proveit:profile-updated'));
    } catch (cause) { setNotice(cause?.message || 'No pudimos guardar el perfil.'); setError(true); }
    finally { setSaving(false); }
  }

  async function logout() {
    try { await signOut(); navigate('/', { replace: true }); }
    catch (cause) { setNotice(cause?.message || 'No pudimos cerrar sesión.'); setError(true); }
  }

  if (busy || authStatus === 'checking') return <main className="react-profile-page"><p role="status">Cargando perfil…</p></main>;
  if (error && !profile && !isOwn) return <main className="react-profile-page"><section className="react-profile-panel"><h1>Perfil no disponible</h1><p role="alert">{notice}</p><Link className="react-primary" to="/torneos">Volver al club ↗</Link></section></main>;
  if (authStatus !== 'signed-in') return <main className="react-profile-page"><section className="react-profile-panel"><h1>Entrá al club</h1><p>{notice}</p><Link className="react-primary" to="/ingresar">Ir a ingresar ↗</Link></section></main>;
  if (!isOwn && !profile?.canView && profile) return <main className="react-profile-page"><section className="react-profile-panel"><h1>Perfil privado</h1><p>Este perfil comparte sus datos con sus amistades.</p><Link className="react-primary" to={`/amigos?persona=${encodeURIComponent(profile.id)}`}>Amistad y mensajes ↗</Link></section></main>;

  return <main className="react-profile-page">
    <section className="react-profile-panel">
      {isOwn ? <>
        <header className="react-profile-heading"><p className="react-eyebrow">TU ESPACIO EN PROVEIT</p><h1>{ownProfileReady ? 'Tu perfil' : 'Completá tu registro'}</h1><p>Tu correo y teléfono se mantienen privados para todos, también para tus amigos.</p></header>
        <div className="react-profile-top"><Avatar profile={{ ...profile, nickname: fields.nickname }} editable onChange={setAvatarFile} />{avatarPreview && <img className="react-profile-preview" src={avatarPreview} alt="Vista previa de la foto elegida" />}<div><h2>{fields.nickname || 'Elegí tu nick'}</h2><p>{fields.bio || 'Una breve presentación para el club.'}</p></div></div>
        <form className="react-profile-form" onSubmit={submit}>
          <label>Nick único<input required minLength={2} maxLength={30} value={fields.nickname} onChange={(event) => set('nickname', event.target.value)} autoComplete="nickname" /></label>
          <label>Biografía breve<textarea rows={3} maxLength={280} value={fields.bio} onChange={(event) => set('bio', event.target.value)} placeholder="Contá algo sobre vos." /></label>
          <div className="react-profile-form-row"><label>País<select required value={fields.country} onChange={(event) => set('country', event.target.value)}><option value="">Elegí tu país</option>{countries.map(([code, name]) => <option key={code} value={code}>{name}</option>)}</select></label><label>Teléfono <small>{access.phoneOptional ? 'opcional · privado' : 'requerido · privado'}</small><input type="tel" required={!access.phoneOptional} value={fields.phone} onChange={(event) => set('phone', event.target.value)} placeholder={countries.find(([code]) => code === fields.country)?.[2] || '+54 9…'} autoComplete="tel" /></label></div>
          <label>Visibilidad del perfil<select value={fields.visibility} onChange={(event) => set('visibility', event.target.value)}><option value="PUBLIC">Público</option><option value="PRIVATE">Privado · solo amistades</option></select><small>La privacidad también se aplica a las consultas del servidor.</small></label>
          <fieldset className="react-profile-social-fields"><legend>Redes sociales opcionales</legend>{networkFields.map((key) => <label key={key}>{networkLabels[key]}<input maxLength={500} value={fields[key]} onChange={(event) => set(key, event.target.value)} placeholder={key === 'discord' ? 'Tu usuario o invitación' : 'https://…'} /></label>)}</fieldset>
          <button className="react-primary" type="submit" disabled={saving}>{saving ? 'Guardando…' : 'Guardar perfil'} <span aria-hidden="true">↗</span></button>
          {(notice || error) && <p className={`react-profile-notice${error ? ' is-error' : ''}`} role={error ? 'alert' : 'status'}>{notice}</p>}
        </form>
        {ownProfileReady && <><Journey profile={profile} own /><div className="react-profile-footer-actions"><button type="button" onClick={() => void logout()}>Cerrar sesión</button><Link to="/torneos">Buscar torneos ↗</Link></div></>}
      </> : profile && <>
        <header className="react-profile-public-top"><Avatar profile={profile} /><div><p className="react-eyebrow">PERFIL DEL CLUB</p><h1>{profile.nickname}</h1><p>{profile.bio || 'Compitiendo en ProveIt Club.'}</p></div></header>
        <PublicSocials profile={profile} />
        <Journey profile={profile} own={false} />
        <Reputation profile={profile} />
        <div className="react-profile-footer-actions"><Link to={`/amigos?persona=${encodeURIComponent(profile.id)}`}>Amistad y mensajes ↗</Link></div>
      </>}
    </section>
  </main>;
}
