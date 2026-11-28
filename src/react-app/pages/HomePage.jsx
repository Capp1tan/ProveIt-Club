import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { homeActivity, latestChampion } from '../../../shared/home-activity.ts';
import { listClubTournaments } from '../../tournaments-api.js';
import { useAuth } from '../auth/AuthProvider.jsx';
import { avatarUrl } from '../../auth-client.js';
import { viewClubProfile } from '../../community-api.js';
import { loadWinnerGallery } from '../../community-gallery.js';
import WinnerGallery from '../components/WinnerGallery.jsx';
import './HomePage.css';

const slides = [
  { src: '/carousel/padel-1600.webp', alt: 'Amigos jugando pádel en una cancha techada.' },
  { src: '/carousel/shooter-1600.webp', alt: 'Una persona jugando un shooter desde su casa.' },
  { src: '/carousel/cartas-1600.webp', alt: 'Amigos jugando a las cartas junto a un mate.' },
];
const leagues = [
  { name: 'Principiante', detail: 'Desde 25 PP · 3 divisiones', x: '0%' },
  { name: 'Ascendente', detail: 'Desde 200 PP · 3 divisiones', x: '33.333%' },
  { name: 'Maestro', detail: 'Desde 1.000 PP · 3 divisiones', x: '66.666%' },
  { name: 'Élite', detail: 'Desde 6.000 PP · acceso muy difícil', x: '100%' },
];

function Trophy() {
  return <span className="react-trophy" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 3h8v7a4 4 0 0 1-8 0ZM8 5H4v3a4 4 0 0 0 4 4m8-7h4v3a4 4 0 0 1-4 4M12 14v6m-5 1h10" /></svg></span>;
}

function activityRoute(href) {
  if (!href) return '/torneos';
  const url = new URL(href, window.location.origin);
  if (url.pathname.endsWith('/torneo.html')) return `/torneo${url.search}`;
  if (url.pathname.endsWith('/torneos.html')) return `/torneos${url.search}`;
  return '/torneos';
}

export default function HomePage() {
  const { status } = useAuth();
  const [slide, setSlide] = useState(0);
  const [rows, setRows] = useState([]);
  const [activityState, setActivityState] = useState('loading');
  const [championAvatar, setChampionAvatar] = useState('');
  const [galleryPhotos, setGalleryPhotos] = useState([]);
  const [paused, setPaused] = useState(false);
  const [visible, setVisible] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  const activities = useMemo(() => homeActivity(rows), [rows]);
  const champion = useMemo(() => latestChampion(rows), [rows]);

  useEffect(() => {
    let alive = true;
    setChampionAvatar('');
    if (!champion?.winnerProfileId) return () => { alive = false; };
    void viewClubProfile(champion.winnerProfileId)
      .then((result) => result?.avatarPath
        ? avatarUrl(result.avatarPath, { profileId: result.id })
        : '')
      .then((url) => { if (alive) setChampionAvatar(url || ''); })
      .catch(() => { if (alive) setChampionAvatar(''); });
    return () => { alive = false; };
  }, [champion?.winnerProfileId]);

  useEffect(() => {
    let alive = true;
    let inFlight = false;
    let timer;
    const load = async () => {
      if (!alive || inFlight || document.hidden) return;
      inFlight = true;
      try {
        const photos = await loadWinnerGallery();
        if (alive) setGalleryPhotos(photos);
      } catch {
        // Keep the last successful gallery visible when a temporary request fails.
      } finally {
        inFlight = false;
        if (alive) timer = window.setTimeout(load, 60_000);
      }
    };
    const refreshNow = () => {
      window.clearTimeout(timer);
      void load();
    };
    const onVisibility = () => { if (!document.hidden) refreshNow(); };
    window.addEventListener('focus', refreshNow);
    window.addEventListener('proveit:gallery-updated', refreshNow);
    document.addEventListener('visibilitychange', onVisibility);
    void load();
    return () => {
      alive = false;
      window.clearTimeout(timer);
      window.removeEventListener('focus', refreshNow);
      window.removeEventListener('proveit:gallery-updated', refreshNow);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const onMotion = () => setReducedMotion(media.matches);
    const onVisibility = () => setVisible(!document.hidden);
    media.addEventListener('change', onMotion);
    document.addEventListener('visibilitychange', onVisibility);
    return () => { media.removeEventListener('change', onMotion); document.removeEventListener('visibilitychange', onVisibility); };
  }, []);

  useEffect(() => {
    if (paused || !visible || reducedMotion) return undefined;
    const timer = window.setTimeout(() => setSlide((current) => (current + 1) % slides.length), 4000);
    return () => clearTimeout(timer);
  }, [slide, paused, visible, reducedMotion]);

  useEffect(() => {
    if (status !== 'signed-in') {
      setRows([]);
      setActivityState(status === 'signed-out' ? 'guest' : status === 'unavailable' ? 'error' : 'loading');
      return undefined;
    }
    let alive = true;
    let timer;
    let busy = false;
    let hasData = false;
    const load = async () => {
      if (!alive || busy || document.hidden) return;
      busy = true;
      try {
        const tournaments = await listClubTournaments();
        if (alive) { setRows(tournaments); setActivityState('ready'); hasData = true; }
      } catch {
        if (alive && !hasData) setActivityState('error');
      } finally {
        busy = false;
        if (alive) timer = window.setTimeout(load, 60_000);
      }
    };
    const onVisibility = () => { if (!document.hidden) { clearTimeout(timer); void load(); } };
    document.addEventListener('visibilitychange', onVisibility);
    void load();
    return () => { alive = false; clearTimeout(timer); document.removeEventListener('visibilitychange', onVisibility); };
  }, [status]);

  return (
    <main className="react-home">
      <section className="react-hero" aria-label="Desafíos entre amigos" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocusCapture={() => setPaused(true)} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false); }}>
        <div className="react-hero-images" aria-hidden="true">
          {slides.map((item, index) => <img key={item.src} className={index === slide ? 'is-active' : ''} src={item.src} alt="" fetchPriority={index === 0 ? 'high' : 'auto'} loading={index === 0 ? 'eager' : 'lazy'} />)}
        </div>
        <div className="react-hero-copy">
          <p className="react-eyebrow">PROVEIT CLUB · DESAFÍOS ENTRE AMIGOS</p>
          <h1>Decirlo es fácil,<br /><span>demostralo.</span></h1>
          <p>Poné las reglas, invitá a tus rivales y armá el desafío.</p>
          <Link className="react-primary" to="/crear-torneo">Crear torneo <span aria-hidden="true">↗</span></Link>
        </div>
        <span className="react-sr-only" role="status" aria-live="polite">{slides[slide].alt}</span>
      </section>

      <section className="react-community" aria-label="Actividad y campeones del club">
        {activities.length > 0 && <div className="react-activity" aria-label="Novedades de torneos"><div className="react-activity-track" style={{ '--activity-time': `${Math.max(24, activities.length * 6)}s` }}>
          {[false, true].map((copy) => <ul key={String(copy)} aria-hidden={copy || undefined} inert={copy || undefined}>{activities.map((item) => <li key={item.id} data-tone={item.tone}>{item.tone === 'gold' ? <Trophy /> : <i aria-hidden="true" />}<Link to={activityRoute(item.href)} tabIndex={copy ? -1 : undefined}>{item.text}</Link></li>)}</ul>)}
        </div></div>}
        <h2 className="react-hall-heading"><Trophy /> Salón de la fama</h2>
        {champion ? <article className="react-champion-card has-feature">
          <div className="react-champion-copy">
            <div className="react-champion-label">Último campeón</div>
            <Link className="react-champion-name" to={`/perfil/${encodeURIComponent(champion.winnerProfileId)}`}><span className={championAvatar ? 'has-photo' : ''}>{championAvatar ? <img src={championAvatar} alt="" /> : Array.from(champion.winnerName)[0]}</span><strong>{champion.winnerName}</strong></Link>
            <p>Ganó <b>{champion.name}</b>{champion.decidedAt && <> · {new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(champion.decidedAt))}</>}</p>
          </div>
          <aside className="react-champion-feature" aria-label={`Galería de momentos y reconocimientos del club. Último campeón: ${champion.winnerName}, torneo ${champion.name}`}>
            <WinnerGallery photos={galleryPhotos} />
          </aside>
        </article>
          : <article className="react-champion-card is-empty"><Trophy /><h3>{activityState === 'guest' ? 'Tu próxima victoria puede quedar acá' : activityState === 'error' ? 'No pudimos cargar al último campeón' : 'El salón está vacío'}</h3><p>{activityState === 'guest' ? 'Ingresá para conocer a los campeones del club.' : activityState === 'error' ? 'Intentá nuevamente en unos momentos.' : 'El primero que gane un torneo queda acá. ¿Vas a ser vos?'}</p>{activityState === 'guest' ? <Link className="react-secondary" to="/ingresar">Ingresar ↗</Link> : <Link className="react-secondary" to="/crear-torneo">Crear torneo ↗</Link>}</article>}
      </section>

      <section className="react-reasons" aria-labelledby="reasons-title">
        <div className="react-reasons-heading"><p className="react-eyebrow">QUE TU PRÓXIMA VICTORIA CUENTE</p><h2 id="reasons-title">Competí por algo.<br /><span>Ganate tu lugar.</span></h2><p>Un premio que te motive. Rivales que te exijan. Un recorrido que se vea en tu perfil.</p></div>
        <div className="react-reasons-grid"><article><span>01 / EL DESAFÍO</span><h3>Algo está en juego.</h3><p>Una cena, un regalo, dinero o lo que acuerden. Cada torneo muestra su premio confirmado y quién lo entrega.</p><Link to="/crear-torneo">Armá tu desafío ↗</Link></article><article><span>02 / TU RECORRIDO</span><h3>No alcanza con decirlo.</h3><p>Empezás sin liga. Completá competencias válidas, sumá PP y desbloqueá logros. Llegar arriba exige constancia.</p><Link to="/perfil">Ver mi progreso ↗</Link></article><article><span>03 / EL CLUB</span><h3>Que se reconozca.</h3><p>Tus participaciones, victorias y logros quedan en tu perfil. Las recompensas especiales se anunciarán cuando estén confirmadas.</p></article></div>
        <div className="react-leagues"><div><p className="react-eyebrow">DE PRINCIPIANTE A ÉLITE</p><h3>Subir cuesta.<br />Llegar se nota.</h3><p>Cuatro ligas con tres divisiones cada una. Alcanzar Élite exige una trayectoria larga.</p></div><div className="react-league-teasers">{leagues.map((league) => <figure key={league.name} data-league={league.name}><span style={{ '--league-x': league.x, '--league-y': '0%' }} /><figcaption>{league.name}<small>{league.detail}</small></figcaption></figure>)}</div></div>
      </section>

      <section className="react-sponsors" aria-labelledby="sponsors-heading"><p className="react-eyebrow" id="sponsors-heading">MARCAS QUE ACOMPAÑAN AL CLUB</p><div><figure><img src="/sponsors/black-line.png" alt="Black Line" loading="lazy" width="350" height="220" /></figure><figure><img src="/sponsors/mila-express.png" alt="Mila Express" loading="lazy" width="350" height="220" /></figure><figure><img src="/sponsors/lee-campo-panaderia.png" alt="Lee Campo Panadería" loading="lazy" width="220" height="220" /></figure></div></section>
    </main>
  );
}
