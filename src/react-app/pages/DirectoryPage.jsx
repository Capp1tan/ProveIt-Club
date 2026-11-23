import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { directoryBase, directorySort, directoryStatus, directoryTone, DIRECTORY_FILTERS } from '../../../shared/tournament-directory.ts';
import { formats } from '../../tournament-formats.js';
import { listClubTournaments } from '../../tournaments-api.js';
import { myPendingPayments, money } from '../../billing-api.js';
import { tournamentCoverUrl } from '../../tournament-cover.js';
import { useAuth } from '../auth/AuthProvider.jsx';
import './DirectoryPage.css';

const cache = { rows: null, updatedAt: 0, paymentsByUser: new Map(), paymentsAtByUser: new Map() };
const labels = { live: 'En juego', soon: 'Por arrancar', done: 'Terminados', pending: 'Faltan confirmaciones', waiting: 'Sala de espera' };

function dateText(t) {
  const value = t.winnerProfileId ? t.decidedAt : t.startsAt;
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return t.winnerProfileId ? 'Finalizado' : 'Sin fecha definida';
  return new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(date);
}

function EventCard({ tournament }) {
  const [cover, setCover] = useState('');
  const format = formats.find((item) => item.id === tournament.format)?.name || tournament.format;
  const state = directoryStatus(tournament);
  const tone = directoryTone(tournament);
  const accepted = tournament.rosterStatuses?.filter((item) => item === 'ACCEPTED').length;
  const total = tournament.participantIds?.length || 0;

  useEffect(() => {
    let active = true;
    if (tournament.coverPath) void tournamentCoverUrl(tournament.id).then((url) => { if (active) setCover(url || ''); }).catch(() => {});
    return () => { active = false; };
  }, [tournament.id, tournament.coverPath]);

  return (
    <article className="react-event-card" data-tone={tone}>
      <Link className="react-event-open" to={`/torneo?id=${encodeURIComponent(tournament.id)}`} aria-label={`Abrir ${tournament.name}`}>
        <span className="react-event-art">
          {cover ? <img src={cover} alt="" loading="lazy" decoding="async" /> : <span aria-hidden="true">{state === 'live' ? '●' : '🏆'}</span>}
        </span>
        <span className="react-event-copy">
          <span className="react-event-topline"><span>{tournament.activity || 'Competencia'}</span><span className="react-event-state" data-state={tone}>{tone === 'live' && <i aria-hidden="true" />}{labels[tone] || labels[state]}</span></span>
          <strong>{tournament.name}</strong>
          <span>{format}{tournament.prizeName ? ` · Premio: ${tournament.prizeName}` : ''}</span>
          <span className="react-event-bottom">{dateText(tournament)}{total ? ` · ${accepted ?? 0}/${total} confirmados` : ''}</span>
        </span>
        <span className="react-event-arrow" aria-hidden="true">↗</span>
      </Link>
    </article>
  );
}

export default function DirectoryPage() {
  const { status: authStatus, user, profile } = useAuth();
  const [params, setParams] = useSearchParams();
  const [rows, setRows] = useState(cache.rows || []);
  const [payments, setPayments] = useState(cache.paymentsByUser.get(user?.userId) || []);
  const [loading, setLoading] = useState(!cache.rows);
  const [error, setError] = useState('');
  const [query, setQuery] = useState(params.get('q') || '');
  const [mine, setMine] = useState(params.get('mios') === '1');
  const [filter, setFilter] = useState(DIRECTORY_FILTERS.some(([key]) => key === params.get('estado')) ? params.get('estado') : 'all');
  const [order, setOrder] = useState(params.get('orden') || 'smart');

  const refresh = useCallback(async ({ quiet = false } = {}) => {
    if (authStatus !== 'signed-in') return;
    if (!quiet) setLoading(true);
    setError('');
    try {
      const [tournaments, pending] = await Promise.all([
        listClubTournaments(),
        Date.now() - (cache.paymentsAtByUser.get(user?.userId) || 0) < 30_000 ? Promise.resolve(cache.paymentsByUser.get(user?.userId) || []) : myPendingPayments().catch(() => []),
      ]);
      cache.rows = tournaments;
      cache.updatedAt = Date.now();
      cache.paymentsByUser.set(user?.userId, pending);
      cache.paymentsAtByUser.set(user?.userId, Date.now());
      setRows(tournaments);
      setPayments(pending);
    } catch (cause) {
      setError(cause?.message || 'No pudimos traer los torneos.');
    } finally {
      setLoading(false);
    }
  }, [authStatus, profile?.id, user?.userId]);

  useEffect(() => {
    if (cache.rows && Date.now() - cache.updatedAt < 30_000) {
      setRows(cache.rows);
      setPayments(cache.paymentsByUser.get(user?.userId) || []);
      setLoading(false);
      return;
    }
    void refresh({ quiet: Boolean(cache.rows) });
  }, [refresh, user?.userId]);
  useEffect(() => {
    if (authStatus !== 'signed-in') return undefined;
    const timer = window.setInterval(() => { if (!document.hidden) void refresh({ quiet: true }); }, 60_000);
    const onVisible = () => { if (!document.hidden && Date.now() - cache.updatedAt > 60_000) void refresh({ quiet: true }); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, [authStatus, refresh]);

  const base = useMemo(() => directoryBase(rows, query, mine, user?.userId || '', profile?.id), [rows, query, mine, user?.userId, profile?.id]);
  const visible = useMemo(() => {
    return directorySort(base, order).filter((item) => filter === 'all' || directoryStatus(item) === filter);
  }, [base, order, filter]);

  function updateFilters(next) {
    const values = { q: query.trim(), mios: mine ? '1' : '', estado: filter === 'all' ? '' : filter, orden: order === 'smart' ? '' : order, ...next };
    const updated = new URLSearchParams(params);
    Object.entries(values).forEach(([key, value]) => value ? updated.set(key, value) : updated.delete(key));
    setParams(updated, { replace: true });
  }

  if (authStatus === 'checking' || authStatus === 'refreshing') return <main className="react-content-page"><p className="react-eyebrow">PROVEIT CLUB</p><h1>Torneos</h1><p role="status">Comprobando tu sesión…</p></main>;
  if (authStatus !== 'signed-in') return <main className="react-content-page"><p className="react-eyebrow">PROVEIT CLUB</p><h1>Ingresá para ver los torneos</h1><p>{authStatus === 'unavailable' ? 'No se pudo conectar con el servicio de cuentas.' : 'El directorio requiere una sesión del club.'}</p><Link className="react-primary" to="/ingresar">Ir a iniciar sesión <span aria-hidden="true">↗</span></Link></main>;

  return (
    <main className="react-directory">
      <div className="react-directory-heading"><div><p className="react-eyebrow">PROVEIT CLUB</p><h1>Torneos</h1><p>Buscá un desafío o seguí cómo vienen los que ya arrancaron.</p></div><Link className="react-primary" to="/crear-torneo">Crear torneo <span aria-hidden="true">↗</span></Link></div>
      {payments.length > 0 && <aside className="react-payment-reminder"><b>{payments.length === 1 ? 'Tenés una inscripción pendiente.' : `Tenés ${payments.length} inscripciones pendientes.`}</b>{payments.slice(0, 3).map((payment) => <Link key={payment.id} to={`/pago?id=${encodeURIComponent(payment.id)}`}>{payment.tournamentName || 'Continuar inscripción'} · {money(payment.amountCents)} <span aria-hidden="true">↗</span></Link>)}</aside>}
      <div className="react-directory-controls">
        <label className="react-directory-search"><span aria-hidden="true">⌕</span><input type="search" maxLength={100} value={query} onChange={(event) => { setQuery(event.target.value); updateFilters({ q: event.target.value.trim() }); }} placeholder="Buscá por nombre o juego" aria-label="Buscar torneos" /></label>
        <div className="react-directory-filters" role="tablist" aria-label="Filtrar torneos">{DIRECTORY_FILTERS.map(([key, label]) => <button key={key} type="button" role="tab" aria-selected={filter === key} disabled={mine && key === 'done'} onClick={() => { setFilter(key); updateFilters({ estado: key === 'all' ? '' : key }); }}>{label}<span>{key === 'all' ? base.length : base.filter((item) => directoryStatus(item) === key).length}</span></button>)}</div>
        <label className="react-directory-sort">Ordenar por<select value={order} onChange={(event) => { setOrder(event.target.value); updateFilters({ orden: event.target.value === 'smart' ? '' : event.target.value }); }}><option value="smart">Lo más cercano</option><option value="recent">Recién creados</option><option value="name">Por nombre</option></select></label>
        <button className="react-directory-mine" type="button" aria-pressed={mine} onClick={() => { setMine((value) => !value); updateFilters({ mios: mine ? '' : '1' }); }}>Donde participo</button>
      </div>
      {error && <div className="react-error" role="alert">{error}<button type="button" onClick={() => void refresh()}>Reintentar</button></div>}
      {loading && rows.length === 0 ? <div className="react-directory-empty" role="status">Cargando torneos…</div> : visible.length ? <div className="react-event-list">{visible.map((tournament) => <EventCard key={tournament.id} tournament={tournament} />)}</div> : <div className="react-directory-empty"><h2>{query || mine || filter !== 'all' ? 'No encontramos torneos con esos filtros' : 'Todavía no hay torneos'}</h2><p>{query || mine || filter !== 'all' ? 'Probá con otro nombre o estado.' : 'Creá el primer desafío del club.'}</p>{!query && !mine && filter === 'all' && <Link className="react-primary" to="/crear-torneo">Crear torneo <span aria-hidden="true">↗</span></Link>}</div>}
      <p className="react-directory-note">Los torneos y permisos se consultan directamente desde el servicio del club.</p>
    </main>
  );
}
