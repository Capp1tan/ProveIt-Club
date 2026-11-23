import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider.jsx';
import { configureAmplify, getCurrentUser, avatarUrl } from '../../auth-client.js';
import { getClubTournament, registeredProfiles, pendingRoomInvitations, watchTournamentLobby, ensureClubTournamentDraw, recordClubDuelResult } from '../../tournaments-api.js';
import { loadBadges, badgeElements, initializeAccess } from '../../badges.js';
import { createRealLobby } from '../../tournament-real-lobby.js';
import { attendancePanel, drawAudit, animateDraw, animateWinner, cancelDrawReveal } from '../../tournament-competition.js';
import { drawBoard } from '../../tournament-bracket.js';
import { renderTournamentPreview } from '../../tournament-preview.js';
import { judgePanel, judgeComments } from '../../judge-ui.js';
import { prizePanel } from '../../tournament-prize.js';
import { mountChat } from '../../chat-ui.js';
import { deleteTournament } from '../../maintenance-api.js';
import { formats, formatImage } from '../../tournament-formats.js';
import { scheduleLabel } from '../../tournament-schedule.js';
import { usesCompetition } from '../../../shared/competition.ts';
import { allEntriesPaid, roomIsClosed, tournamentIsLive, validatePodium } from '../../../shared/tournament-room.ts';
import './TournamentPage.css';
import '../../../site-theme.css';

const node = (tag, text = '', cls = '') => { const el = document.createElement(tag); el.textContent = text; if (cls) el.className = cls; return el; };
const owner = (profile) => profile?.owner?.split('::')[0] || '';

function playerLink(id, name, profiles) {
  const profile = profiles.get(id); const link = node('a', '', 'participant-trigger');
  link.href = `/react/perfil/${encodeURIComponent(id)}`; link.setAttribute('aria-label', `Ver perfil de ${name}`);
  const avatar = node('span', Array.from(name.trim())[0]?.toUpperCase() || '?', 'participant-avatar');
  if (profile?.avatarPath) void avatarUrl(profile.avatarPath, { profileId: id }).then((url) => { if (url && avatar.isConnected) { const image = node('img'); image.src = url; image.alt = ''; image.loading = 'lazy'; avatar.replaceChildren(image); } }).catch(() => {});
  const nameLine = node('span', '', 'participant-name-line'); nameLine.append(node('span', name, 'participant-name'));
  const badges = badgeElements(owner(profile)); const verified = badges.querySelector('[data-code="VERIFIED"]'); if (verified) nameLine.append(verified.cloneNode(true));
  link.append(avatar, nameLine, badges); return link;
}

function resultPanel(t, profiles, user, onSaved) {
  const card = node('section', '', 'tournament-panel react-result-panel');
  if (t.winnerProfileId) {
    card.append(node('h2', 'Resultado del torneo'), node('p', `🏆 ${t.winnerName || t.participantNames[t.participantIds.indexOf(t.winnerProfileId)] || 'Ganador'}`, 'duel-winner'));
    if (t.decidedAt) card.append(node('p', `Decisión registrada · ${scheduleLabel(t.decidedAt, t.timeZone)}`, 'field-help'));
    for (const [id, label] of [[t.runnerUpProfileId, '2.º puesto'], [t.thirdPlaceProfileId, '3.º puesto']]) if (id) { const i = t.participantIds.indexOf(id); if (i >= 0) card.append(node('p', `${label} · ${t.participantNames[i]}`)); }
    if (t.resultReason) card.append(node('p', `Motivo: ${t.resultReason}`));
    return card;
  }
  const isJudge = t.judgeIds?.some((id, i) => owner(profiles.get(id)) === user?.userId && (!t.rosterStatuses || t.rosterStatuses[t.participantIds.length + i] === 'ACCEPTED'));
  const canDecide = t.arbitrationMode === 'ORGANIZER' ? user?.userId === t.createdBySub || user?.username === t.createdBySub : isJudge;
  if (!canDecide || !t.draw || !allEntriesPaid(t) || !tournamentIsLive(t)) return null;
  const details = node('details', '', 'tournament-panel tournament-decision'), summary = node('summary', 'Registrar decisión'); details.append(summary);
  const form = node('form', '', 'duel-result-form'), winner = document.createElement('select'), kind = document.createElement('select'), reason = document.createElement('textarea'); winner.required = true;
  const placeholder = node('option', 'Elegí al ganador'); placeholder.value = ''; winner.append(placeholder);
  t.participantIds.forEach((id, i) => { const option = node('option', t.participantNames[i]); option.value = id; winner.append(option); });
  const winnerLabel = node('label', 'Quién ganó'); winnerLabel.append(winner); form.append(winnerLabel);
  const second = document.createElement('select'), third = document.createElement('select');
  if (t.participantIds.length > 2) for (const [select, label] of [[second, 'Segundo puesto (opcional)'], [third, 'Tercer puesto (opcional)']]) {
    const none = node('option', 'Sin definir'); none.value = ''; select.append(none);
    t.participantIds.forEach((id, i) => { const option = node('option', t.participantNames[i]); option.value = id; select.append(option); });
    const field = node('label', label); field.append(select); form.append(field);
  }
  const decisionKind = node('label', 'Tipo de decisión');
  for (const [value, label] of [['NORMAL', 'Resultado normal'], ['DISPUTED', 'Resultado discutido'], ['SANCTION', 'Sanción']]) { const option = node('option', label); option.value = value; kind.append(option); }
  decisionKind.append(kind); const reasonLabel = node('label', 'Motivo breve si hubo discusión o sanción'); reason.maxLength = 500; reason.rows = 3; reasonLabel.append(reason); form.append(decisionKind, reasonLabel);
  kind.addEventListener('change', () => { reason.required = kind.value !== 'NORMAL'; reason.minLength = reason.required ? 10 : 0; });
  const message = node('p', '', 'field-help'); message.setAttribute('role', 'status'); const save = node('button', 'Confirmar resultado', 'primary-button'); save.type = 'submit'; form.append(node('p', 'La decisión será definitiva y quedará registrada. Confirmala con los participantes antes de continuar.', 'field-help'), save, message);
  form.addEventListener('submit', async (event) => {
    event.preventDefault(); if (!winner.value || save.disabled) return;
    try { validatePodium(t.participantIds, winner.value, second.value || null, third.value || null); }
    catch (cause) { message.textContent = cause.message; return; }
    const name = t.participantNames[t.participantIds.indexOf(winner.value)];
    if (!window.confirm(`¿Confirmar a ${name} como ganador? Esta decisión quedará registrada y no se podrá cambiar desde el sitio.`)) return;
    save.disabled = true; message.textContent = 'Guardando resultado…';
    try { const saved = await recordClubDuelResult(t.id, winner.value, reason.value, kind.value, second.value || null, third.value || null); if (!saved?.winnerProfileId) throw new Error('AWS no confirmó el resultado. Actualizá para revisar el estado.'); onSaved(); }
    catch (cause) { message.textContent = cause.message || 'No pudimos guardar el resultado.'; save.disabled = false; }
  });
  details.append(form); return details;
}

export default function TournamentPage() {
  const { status: authStatus, user } = useAuth();
  const navigate = useNavigate();
  const navigateRef = useRef(navigate); navigateRef.current = navigate;
  const [params] = useSearchParams(); const id = params.get('id');
  const [phase, setPhase] = useState('loading'); const [error, setError] = useState('');
  const host = useRef(null);
  const title = useMemo(() => 'Torneo — ProveIt Club', []);

  useEffect(() => {
    if (!host.current || authStatus !== 'signed-in') return undefined;
    document.body.classList.add('proveit-theme');
    let alive = true, refreshBusy = false, refreshAgain = false, stopped = false, subscription, retryTimer, pollTimer, clockTimer, pendingInvites = [], connected = false;
    let currentUser = null, currentTournament = null, profiles = new Map(), cleanupChat, chatNode = null, chatRoomId = '', boardCleanup, boardNode, lastVersion = '', previousWinner = '';
    const container = host.current; container.replaceChildren();
    const peopleButton = (profileId, name) => playerLink(profileId, name, profiles);
    const previewService = { button: peopleButton, setProfiles() {}, dismiss() {}, lock() {} };
    const realLobby = createRealLobby({ profilePreview: previewService, getUser: () => currentUser, getConnection: () => connected, onChanged: () => refresh(true) });

    function cleanupDraw() { cancelDrawReveal(); boardCleanup?.(); boardCleanup = null; }
    function closeChat() { cleanupChat?.(); cleanupChat = null; chatNode?.remove(); chatNode = null; chatRoomId = ''; }

    async function connect() {
      if (stopped || subscription || document.hidden || !id) return;
      try {
        subscription = await watchTournamentLobby(id, () => void refresh(true), () => {
          subscription?.unsubscribe(); subscription = null; connected = false; clearTimeout(retryTimer); retryTimer = setTimeout(() => void connect(), 15_000);
        }); connected = true;
      } catch { clearTimeout(retryTimer); retryTimer = setTimeout(() => void connect(), 15_000); }
    }

    function render(t, { invitations = [], invitationError = false } = {}) {
      if (!alive || !container.isConnected) return;
      cleanupDraw();
      if (t.roomClosed || roomIsClosed(t)) {
        closeChat(); container.replaceChildren(); const closed = node('section', '', 'tournament-panel room-closed');
        closed.append(node('h1', 'La sala está cerrada'), node('p', t.name || 'Torneo finalizado'), node('p', 'Pasaron los cinco minutos posteriores al resultado. La sala y el chat ya no están disponibles. Tu participación se conserva en el historial.'));
        const history = node('a', 'Ir a mi historial ↗', 'primary-button'); history.href = '/react/perfil'; closed.append(history); container.append(closed); setPhase('closed'); return;
      }
      const winnerJustRecorded = Boolean(t.winnerProfileId && currentTournament?.id === t.id && !currentTournament.winnerProfileId);
      currentTournament = t;
      if (chatRoomId !== t.id) { closeChat(); chatNode = node('section', '', 'react-tournament-chat'); chatNode.setAttribute('aria-label', 'Chat del torneo'); chatNode.id = 'reactTournamentChat'; cleanupChat = mountChat(chatNode, { roomType: 'TOURNAMENT', roomId: t.id }); chatRoomId = t.id; }
      container.replaceChildren();
      const format = formats.find((item) => item.id === t.format);
      const statuses = t.rosterStatuses || Array(t.participantIds.length + t.judgeIds.length + (t.treasurerId ? 1 : 0)).fill('ACCEPTED');
      const savedDraw = Boolean(t.draw && (usesCompetition(t) || t.status === 'READY' || t.status === 'COMPLETED'));
      const ready = Boolean(t.rosterStatuses?.length && t.rosterStatuses.every((value) => value === 'ACCEPTED') && allEntriesPaid(t) && t.creationPaymentStatus !== 'REVERSED');
      const bracketFocus = ready && (savedDraw || usesCompetition(t));
      const hero = node('header', '', 'tournament-cover react-tournament-cover'), copy = node('div', '', 'tournament-cover-content');
      copy.append(node('p', t.winnerProfileId ? 'TORNEO FINALIZADO' : savedDraw ? 'TODOS CONFIRMADOS · SORTEO GUARDADO' : 'SALA DE ESPERA', 'eyebrow'), node('h1', t.name), node('p', t.activity));
      if (t.overview) copy.append(node('p', t.overview, 'lobby-overview'));
      hero.append(copy);
      if (t.coverPath) void import('../../tournament-cover.js').then(({ tournamentCoverUrl }) => tournamentCoverUrl(t.id)).then((url) => { if (url && hero.isConnected) { const image = node('img'); image.alt = `Portada de ${t.name}`; image.src = url; hero.prepend(image); } }).catch(() => {});
      const lobby = realLobby.render(t, { bracketFocus, invitations, invitationError });
      const controls = attendancePanel(t, { sub: currentUser?.userId, profiles, onChanged: () => refresh(true) });
      if (bracketFocus) {
        const stage = node('section', '', 'tournament-bracket-stage react-bracket-stage'), heading = node('header', '', 'bracket-stage-heading');
        heading.append(node('h2', t.name), node('p', [t.activity, format?.name].filter(Boolean).join(' · '))); stage.append(heading);
        if (!savedDraw && controls) stage.append(controls);
        if (savedDraw) {
          let parsed; try { parsed = JSON.parse(t.draw); } catch {}
          if (parsed) { const board = drawBoard(parsed, { winnerId: t.winnerProfileId, playerButton: peopleButton, selfPlayer: (profileId) => owner(profiles.get(profileId)) === currentUser?.userId }); boardCleanup = board.cleanup; boardNode = board.section; stage.append(board.section); }
          container.append(stage);
          if (boardNode && winnerJustRecorded) animateWinner(boardNode, t.winnerProfileId);
          else if (boardNode && !previousWinner) void animateDraw(t, boardNode, currentUser?.userId);
          if (lobby.childElementCount) container.append(lobby);
          if (controls) container.append(controls);
          if (parsed && t.winnerProfileId) { /* winner animation is only played on the result transition above */ }
        } else {
          const preview = node('div', '', 'bracket-stage-preview'); preview.append(node('h3', 'Llave por sortear'));
          const model = node('div'); const dispose = renderTournamentPreview(model, { format: t.format, count: t.participantIds.length, awaitingDraw: true }); boardCleanup = dispose; preview.append(model); stage.append(preview); container.append(stage); if (lobby.childElementCount) container.append(lobby);
        }
      } else { container.append(lobby); if (controls) container.append(controls); }
      if (t.prizeTitle || t.prizeExpected === true) {
        const canEditPrize = t.arbitrationMode === 'ORGANIZER' ? currentUser?.userId === t.createdBySub : (t.judgeIds || []).some((judgeId, index) => ['ACCEPTED'].includes(statuses[t.participantIds.length + index]) && owner(profiles.get(judgeId)) === currentUser?.userId);
        container.append(prizePanel(t, { canEdit: canEditPrize, onSaved: () => void refresh(true) }));
      }
      const info = node('details', '', 'tournament-panel react-tournament-info'); info.append(node('summary', 'Reglas y formato'), node('h2', format?.name || t.format));
      if (format && !savedDraw) { const diagram = node('div', '', 'format-preview'); diagram.innerHTML = formatImage(format.id); diagram.append(node('p', format.description)); info.append(diagram); }
      const rules = node('p', t.description || 'El organizador todavía no agregó reglas.'); rules.style.whiteSpace = 'pre-wrap'; info.append(rules); container.append(info);
      if (savedDraw) {
        try { const audit = drawAudit(t); if (audit) container.append(audit); } catch {}
      }
      const decision = resultPanel(t, profiles, currentUser, () => void refresh(true)); if (decision) container.append(decision);
      if (t.status === 'COMPLETED') container.append(judgeComments(t.id));
      if (t.judgeIds?.length || currentUser?.userId === t.createdBySub) {
        const canEditRules = currentUser?.userId === t.createdBySub || t.judgeIds?.some((judgeId, index) => owner(profiles.get(judgeId)) === currentUser?.userId && statuses[t.participantIds.length + index] === 'ACCEPTED');
        const conditions = node('details', '', 'tournament-panel react-tournament-conditions'); conditions.append(node('summary', t.judgeIds?.length ? 'Jurado y condiciones' : 'Condiciones del torneo'), judgePanel(t, { canEditRules, onChanged: () => refresh(true) })); container.append(conditions);
      }
      if (accessRef.current?.isCreator || currentUser?.userId === t.createdBySub) {
        const remove = node('button', 'Eliminar torneo', 'danger-button'); remove.type = 'button'; remove.addEventListener('click', async () => { remove.disabled = true; try { if (await deleteTournament(t.id, { name: t.name })) navigateRef.current('/torneos', { replace: true }); else remove.disabled = false; } catch (cause) { setError(cause.message); remove.disabled = false; } }); container.append(remove);
      }
      if (chatRoomId === t.id && chatNode) container.append(chatNode);
      const scheduledDraw = container.querySelector('[data-draw-schedule]');
      if (scheduledDraw) scheduledDraw.disabled = Date.now() < Date.parse(t.startsAt);
      previousWinner = t.winnerProfileId || '';
      setPhase(t.winnerProfileId ? 'done' : t.draw ? 'ready' : 'waiting');
    }

    const accessRef = { current: null };
    async function refresh(force = false) {
      if (!alive || stopped || !id || document.hidden) return;
      if (refreshBusy) { refreshAgain = true; return; }
      refreshBusy = true;
      try {
        let t = await getClubTournament(id);
        if (!t) throw new Error('Este torneo fue eliminado o ya no está disponible.');
        if (!usesCompetition(t) && !t.draw && t.rosterStatuses?.length && t.rosterStatuses.every((state) => state === 'ACCEPTED') && currentUser?.userId === t.createdBySub) t = await ensureClubTournamentDraw(id) || t;
        const version = `${t.updatedAt || ''}:${t.draw || ''}:${t.winnerProfileId || ''}:${t.rosterStatuses?.join(',') || ''}`;
        const revealing = container.querySelector('#tournamentDraw[data-revealing]');
        if (revealing && version === lastVersion) return;
        if (version !== lastVersion) {
          let invitations = [], invitationError = false;
          if (!t.winnerProfileId && t.status !== 'COMPLETED' && t.rosterStatuses?.includes('PENDING')) try { invitations = await pendingRoomInvitations(t); } catch { invitationError = true; }
          if (!alive || stopped) return;
          render(t, { invitations, invitationError }); lastVersion = invitationError ? '' : version;
        }
        setError('');
      } catch (cause) { if (alive) setError(cause?.message || 'No pudimos cargar este torneo.'); }
      finally { refreshBusy = false; if (refreshAgain) { refreshAgain = false; setTimeout(() => void refresh(), 200); } }
    }

    async function initialize() {
      try {
        if (!id) throw new Error('El enlace no incluye un torneo.');
        if (!await configureAmplify()) throw new Error('No pudimos conectar con AWS. Recargá para intentar de nuevo.');
        currentUser = await getCurrentUser();
        accessRef.current = await initializeAccess();
        await Promise.all([loadBadges().catch(() => {}), registeredProfiles().then((items) => { profiles = new Map(items.map((profile) => [profile.id, profile])); }).catch(() => {})]);
        if (!alive) return;
        await refresh(true); if (!alive) return;
        await connect();
        pollTimer = setInterval(() => { if (!document.hidden) void refresh(); }, 30_000);
        clockTimer = setInterval(() => {
          realLobby.clock();
          const drawButton = container.querySelector('[data-draw-schedule]');
          if (drawButton && currentTournament) drawButton.disabled = Date.now() < Date.parse(currentTournament.startsAt);
        }, 1000);
      } catch (cause) { if (alive) { setError(cause?.name === 'UserUnAuthenticatedException' ? 'Ingresá con tu cuenta para abrir este torneo.' : cause?.message || 'No pudimos abrir el torneo.'); setPhase('error'); } }
    }
    const onVisible = () => { if (!document.hidden) { realLobby.clock(); void connect(); void refresh(true); } };
    const onInvitation = () => void refresh(true);
    document.addEventListener('visibilitychange', onVisible); window.addEventListener('proveit:invitation-updated', onInvitation);
    void initialize();
    return () => {
      alive = false; stopped = true; clearTimeout(retryTimer); clearInterval(pollTimer); clearInterval(clockTimer); subscription?.unsubscribe();
      document.removeEventListener('visibilitychange', onVisible); window.removeEventListener('proveit:invitation-updated', onInvitation);
      cleanupDraw(); closeChat(); realLobby.destroy(); container.replaceChildren();
      document.body.classList.remove('proveit-theme');
    };
  }, [id, authStatus, user?.userId]);

  useEffect(() => { document.title = title; }, [title]);

  if (authStatus !== 'signed-in' && authStatus !== 'checking') return <main className="react-tournament-page"><section className="react-tournament-notice"><h1>Ingresá para abrir el torneo</h1><p>La sala consulta confirmaciones y datos según los permisos de tu cuenta.</p><Link className="react-primary" to="/ingresar">Ingresar ↗</Link></section></main>;
  return <main className="react-tournament-page"><div className="react-tournament-heading"><Link to="/torneos">← Torneos</Link>{phase !== 'loading' && <span data-phase={phase}>{phase === 'done' ? 'Finalizado' : phase === 'ready' ? 'Cruces listos' : phase === 'waiting' ? 'Sala de espera' : 'Torneo'}</span>}</div>{error && <p className="react-tournament-error" role="alert">{error} {phase === 'error' && <button type="button" onClick={() => window.dispatchEvent(new Event('proveit:invitation-updated'))}>Reintentar</button>}</p>}{phase === 'loading' && <p role="status">Cargando torneo…</p>}<div ref={host} className="react-tournament-content" /></main>;
}
