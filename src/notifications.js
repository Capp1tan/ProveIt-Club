import { notificationSoundEnabled, watchNotificationSound } from './notification-preferences.js';
import {money} from './billing-api.js';
import { noJudgeConsent, scheduleLabel } from './tournament-schedule.js';
// Campana de invitaciones. Consulta cada 20 s con la página visible; no envía emails ni push.
import '../notifications.css';
import { Hub } from 'aws-amplify/utils';
import { configureAmplify, getCurrentUser } from './auth-client.js';
import { pendingInvitations, respondInvitation } from './tournaments-api.js';
const nav = document.querySelector('header nav');
if (nav) {
  const root = document.createElement('div'); root.className = 'club-notifications'; root.hidden = true;
  const bell = document.createElement('button'); bell.type = 'button'; bell.className = 'notification-bell';
  bell.setAttribute('aria-label','Notificaciones'); bell.setAttribute('aria-expanded','false');
  bell.setAttribute('aria-controls','clubNotificationsPanel');
  bell.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 17h14l-2-3V9a5 5 0 0 0-10 0v5zM10 20h4"/></svg>';
  const badge = document.createElement('span'); badge.className = 'notification-count'; badge.hidden = true; badge.setAttribute('aria-hidden','true'); bell.append(badge);
  const panel = document.createElement('section'); panel.id = 'clubNotificationsPanel'; panel.className = 'notification-panel';
  panel.hidden = true; panel.setAttribute('aria-label','Invitaciones a torneos');
  const title = document.createElement('h2'); title.textContent = 'Tus invitaciones';
  const description = document.createElement('p'); description.className = 'notification-help'; description.textContent = 'Entrá a la sala para responder.';
  const message = document.createElement('p'); message.className = 'notification-message'; message.setAttribute('role','status'); message.setAttribute('aria-live','polite');
  const list = document.createElement('div'); list.className = 'notification-list';
  const refresh = document.createElement('button'); refresh.type = 'button'; refresh.textContent = 'Actualizar'; refresh.className = 'notification-refresh';
  panel.append(title,description,message,list,refresh); root.append(bell,panel); nav.prepend(root);
  let userId = '', invitations = [], busy = false, answering = false, generation = 0;
  const consentChecks = new Set();
  let audio, queuedSound = false, soundEnabled = true;
  soundEnabled = notificationSoundEnabled();
  watchNotificationSound(()=>{soundEnabled=notificationSoundEnabled();if(!soundEnabled)queuedSound=false;});
  // Audio sintetizado: no requiere archivos externos. Se habilita mediante un gesto del usuario.
  function chime() {
    if (!soundEnabled) { queuedSound = false; return; }
    if (!audio || audio.state !== 'running') { queuedSound = true; return; }
    queuedSound = false;
    for (const [offset,frequency] of [[0,660],[0.16,880]]) {
      const oscillator = audio.createOscillator(), gain = audio.createGain();
      const start = audio.currentTime + offset;
      oscillator.frequency.value = frequency; gain.gain.setValueAtTime(0,start);
      gain.gain.linearRampToValueAtTime(0.09,start+0.015); gain.gain.exponentialRampToValueAtTime(0.001,start+0.2);
      oscillator.connect(gain); gain.connect(audio.destination); oscillator.start(start); oscillator.stop(start+0.22);
    }
  }
  async function unlockAudio() {
    if (!soundEnabled || !userId) return;
    try {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return;
      audio ||= new Audio();
      await audio.resume();
      if (queuedSound) chime();
    } catch { /* La campana funciona aunque el navegador bloquee el audio. */ }
  }
  document.addEventListener('pointerdown',unlockAudio);
  document.addEventListener('keydown',unlockAudio);
  function render() {
    badge.hidden = !invitations.length; badge.textContent = invitations.length > 99 ? '99+' : String(invitations.length);
    bell.setAttribute('aria-label', 'Notificaciones: ' + invitations.length + ' invitaciones pendientes');
    list.replaceChildren();
    if (!invitations.length) { const empty = document.createElement('p'); empty.textContent = 'No tenés invitaciones pendientes.'; list.append(empty); }
    const roles={PARTICIPANT:'Te invitaron a competir',JUDGE:'Te invitaron como juez',TREASURER:'Nueva invitación'};
    for(const invitation of invitations){
      const card=document.createElement('a');card.className='notification-invitation';card.href='/torneo.html?id='+encodeURIComponent(invitation.tournamentId);
      const icon=document.createElement('span');icon.className='notification-mini-icon';icon.textContent=invitation.role==='JUDGE'?'⚖':'↗';icon.setAttribute('aria-hidden','true');
      const copy=document.createElement('span'),name=document.createElement('strong'),role=document.createElement('small');name.textContent=invitation.tournamentName;role.textContent=roles[invitation.role] || 'Nueva invitación';copy.append(name,role);card.append(icon,copy);list.append(card);
    }
  }

  function rememberNew(items) {
    const key = 'proveit:seen-invitations:' + userId;
    let seen = [];
    try { const saved = JSON.parse(localStorage.getItem(key) || '[]'); if (Array.isArray(saved)) seen = saved.filter(id => typeof id === 'string'); } catch {}
    const added = items.filter(item => !seen.includes(item.id));
    try { localStorage.setItem(key,JSON.stringify([...new Set([...items.map(item => item.id),...seen])].slice(0,300))); } catch {}
    return added.length;
  }
  async function refreshInvitations() {
    if (!userId || busy || answering || document.hidden) return;
    busy = true; refresh.disabled = true;
    const activeGeneration = generation;
    try {
      const result = await pendingInvitations();
      if (activeGeneration !== generation) return;
      const added = rememberNew(result);
      invitations = result; render();
      if (added) { message.textContent = 'Tenés ' + added + ' invitaciones nuevas.'; chime(); }
    } catch { if (activeGeneration === generation) message.textContent = 'No pudimos actualizar. Tocá Actualizar para reintentar.'; }
    finally { busy = false; refresh.disabled = false; }
  }
  function close() { panel.hidden = true; bell.setAttribute('aria-expanded','false'); }
  bell.addEventListener('click',() => { panel.hidden = !panel.hidden; bell.setAttribute('aria-expanded',String(!panel.hidden)); if (!panel.hidden) void refreshInvitations(); });
  refresh.addEventListener('click',refreshInvitations);
  window.addEventListener('proveit:tournament-deleted',()=>void refreshInvitations());
  document.addEventListener('click',event => { if (!root.contains(event.target)) close(); });
  root.addEventListener('keydown',event => { if (event.key === 'Escape') { close(); bell.focus(); } });
  async function connect() {
    generation++; consentChecks.clear(); userId = ''; invitations = []; queuedSound = false; root.hidden = true; close(); render();
    const activeGeneration = generation;
    try {
      if (!await configureAmplify()) return;
      const user = await getCurrentUser();
      if (activeGeneration !== generation) return;
      userId = user.userId; root.hidden = false; await refreshInvitations();
    } catch { /* Sin sesión no se consultan invitaciones. */ }
  }
  Hub.listen('auth',({payload}) => { if (['signedIn','signedOut'].includes(payload.event)) void connect(); });
  document.addEventListener('visibilitychange',() => { if (!document.hidden) void refreshInvitations(); });
  setInterval(refreshInvitations,20000);
  void connect();
}
