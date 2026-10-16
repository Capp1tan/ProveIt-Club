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
  const sound = document.createElement('button'); sound.type = 'button'; sound.className = 'notification-sound';
  const description = document.createElement('p'); description.className = 'notification-help'; description.textContent = 'Aceptá o rechazá el rol propuesto. Se actualiza mientras estás en el sitio.';
  const message = document.createElement('p'); message.className = 'notification-message'; message.setAttribute('role','status'); message.setAttribute('aria-live','polite');
  const list = document.createElement('div'); list.className = 'notification-list';
  const refresh = document.createElement('button'); refresh.type = 'button'; refresh.textContent = 'Actualizar'; refresh.className = 'notification-refresh';
  panel.append(title,sound,description,message,list,refresh); root.append(bell,panel); nav.prepend(root);
  let userId = '', invitations = [], busy = false, answering = false, generation = 0;
  const consentChecks = new Set();
  let audio, queuedSound = false, soundEnabled = true;
  try { soundEnabled = localStorage.getItem('proveit:notification-sound') !== 'off'; } catch {}
  const soundLabel = () => { sound.textContent = soundEnabled ? 'Sonido activado · silenciar' : 'Sonido desactivado · activar'; sound.setAttribute('aria-pressed',String(soundEnabled)); };
  soundLabel();
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
  sound.addEventListener('click',async () => {
    soundEnabled = !soundEnabled; soundLabel();
    try { localStorage.setItem('proveit:notification-sound',soundEnabled ? 'on' : 'off'); } catch {}
    if (soundEnabled) { await unlockAudio(); chime(); } else queuedSound = false;
  });
  function render() {
    badge.hidden = !invitations.length; badge.textContent = invitations.length > 99 ? '99+' : String(invitations.length);
    bell.setAttribute('aria-label', 'Notificaciones: ' + invitations.length + ' invitaciones pendientes');
    list.replaceChildren();
    if (!invitations.length) { const empty = document.createElement('p'); empty.textContent = 'No tenés invitaciones pendientes.'; list.append(empty); }
    const roles = { PARTICIPANT:'participante', JUDGE:'juez', TREASURER:'tesorero' };
    for (const invitation of invitations) {
      const card = document.createElement('article'); card.className = 'notification-card';
      const link = document.createElement('a'); link.href = '/torneo.html?id=' + encodeURIComponent(invitation.tournamentId); link.textContent = invitation.tournamentName;
      const role = document.createElement('p'); role.textContent = 'Te invitaron como ' + (roles[invitation.role] || 'integrante') + '.';
      const noJudge=invitation.arbitrationMode==='ORGANIZER';
      const schedule=document.createElement('p'); schedule.className='notification-help'; schedule.textContent=scheduleLabel(invitation.startsAt,invitation.timeZone);
      card.append(link,role,schedule);
      if(invitation.rulesSnapshot) { const rules=document.createElement('p'); rules.className='invitation-rules'; rules.textContent='Reglas: '+invitation.rulesSnapshot; card.append(rules); }
      let agreement;
      if(noJudge) {
        const warning=document.createElement('p'); warning.className='arbitration-warning'; warning.textContent='Sin juez · decide el organizador, incluso si participa.';
        const label=document.createElement('label'); label.className='invitation-consent'; agreement=document.createElement('input'); agreement.type='checkbox'; agreement.checked=consentChecks.has(invitation.id);
        const text=document.createElement('span'); text.textContent=noJudgeConsent; label.append(agreement,text); card.append(warning,label);
      }
      const actions = document.createElement('div'); actions.className = 'notification-actions';
      for (const accept of [true,false]) {
        const button = document.createElement('button'); button.type = 'button'; button.textContent = accept ? 'Aceptar' : 'Rechazar';
        if(accept && noJudge) {
          button.disabled=!agreement.checked;
          agreement.addEventListener('change',()=>{agreement.checked ? consentChecks.add(invitation.id) : consentChecks.delete(invitation.id);button.disabled=!agreement.checked;});
        }
        button.className = accept ? 'notification-accept' : 'notification-reject';
        button.addEventListener('click',async () => {
          if (answering) return;
          answering = true; const activeGeneration = generation;
          panel.querySelectorAll('.notification-actions button').forEach(control => { control.disabled = true; });
          message.textContent = 'Guardando respuesta…';
          try {
            await respondInvitation(invitation.id,accept,noJudge && agreement.checked);
            consentChecks.delete(invitation.id);
            if (activeGeneration !== generation) return;
            invitations = invitations.filter(item => item.id !== invitation.id); render();
            message.textContent = accept ? 'Aceptaste la invitación.' : 'Rechazaste la invitación.';
            window.dispatchEvent(new Event('proveit:invitation-updated'));
          } catch (error) { if (activeGeneration === generation) { render(); message.textContent = error.message || 'No se pudo guardar. Volvé a intentar.'; } }
          finally { answering = false; }
        }); actions.append(button);
      }
      card.append(actions); list.append(card);
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
