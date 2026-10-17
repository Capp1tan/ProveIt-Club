import { tournamentFee, money } from './billing-api.js';
import { noJudgeConsent, timeZones, zoneLabel, localToUtc, scheduleLabel } from './tournament-schedule.js';
import { loadBadges, badgeElements, decorateAvatar } from './badges.js';
import { Hub } from 'aws-amplify/utils';
import { avatarUrl, configureAmplify, getCurrentUser } from './auth-client.js';
import { formats, formatImage } from './tournament-formats.js';
import { registeredProfiles, createClubTournament } from './tournaments-api.js';

const form = document.getElementById('tournamentForm');
const fields = document.getElementById('tournamentFields');
const notice = document.getElementById('tournamentNotice');
const options = document.getElementById('formatOptions');
const preview = document.getElementById('formatPreview');
const search = document.getElementById('peopleSearch');
const treasurer = document.getElementById('treasurer');
const submit = document.getElementById('createTournament');
const participants = new Set();
const judges = new Set();
let profiles = [];
let pricingReady=false;
let connectionAttempt = 0;
let pricingMessage = 'Todavía estamos consultando si podés crear torneos.';
// Una consulta lenta debe terminar con una explicación y permitir reintentar.
async function withDeadline(operation, message, milliseconds = 20000) {
  let timer;
  try { return await Promise.race([operation, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(message)), milliseconds); })]); }
  finally { clearTimeout(timer); }
}
let selectedFormat = formats[0].id;
const mode = document.getElementById('arbitrationMode');
const startsLocal = document.getElementById('startsLocal');
const zone = document.getElementById('timeZone');
const consent = document.getElementById('organizerConsent');
for (const value of timeZones) { const option=document.createElement('option'); option.value=value; option.textContent=zoneLabel(value); zone.append(option); }
zone.value='America/Argentina/Buenos_Aires';
const noJudge = () => mode.value === 'ORGANIZER';
function updateSchedule() {
  try { const utc=localToUtc(startsLocal.value,zone.value); const label=scheduleLabel(utc,zone.value); document.getElementById('schedulePreview').textContent=label; document.getElementById('scheduleSummary').textContent=label; }
  catch(error) { document.getElementById('schedulePreview').textContent=error.message; document.getElementById('scheduleSummary').textContent='Fecha pendiente'; }
}
function updateArbitration() {
  if(noJudge()) judges.clear();
  document.getElementById('judgesSection').hidden=noJudge();
  document.getElementById('arbitrationWarning').hidden=!noJudge();
  document.getElementById('organizerConsentLabel').hidden=!noJudge();
  consent.required=noJudge(); consent.checked=false;
  form.elements.description.required=noJudge(); form.elements.description.minLength=noJudge()?10:0;
  renderPeople();
}
mode.addEventListener('change',()=>{updateArbitration();saveDraft();});
startsLocal.addEventListener('input',updateSchedule); zone.addEventListener('change',updateSchedule);
let loading = false;
let saving = false;
let tournamentId = crypto.randomUUID();
const draftKey = 'proveit:tournament-draft';
const resumeKey = 'proveit:tournament-resume';
const show = (text, error = false) => { notice.textContent = text; notice.dataset.error = String(error); };
function saveDraft() {
  try { sessionStorage.setItem(draftKey, JSON.stringify({ format: selectedFormat, name: form.elements.name.value, activity: form.elements.activity.value, description: form.elements.description.value, arbitrationMode: mode.value, startsLocal: startsLocal.value, timeZone: zone.value })); } catch { /* El formulario funciona sin almacenamiento local. */ }
}
try {
  const draft = JSON.parse(sessionStorage.getItem(draftKey) || 'null');
  if (draft) {
    if (formats.some(format => format.id === draft.format)) selectedFormat = draft.format;
    if (['JUDGES','ORGANIZER'].includes(draft.arbitrationMode)) mode.value=draft.arbitrationMode;
    if (timeZones.includes(draft.timeZone)) zone.value=draft.timeZone;
    if (typeof draft.startsLocal==='string') startsLocal.value=draft.startsLocal;
    for (const key of ['name','activity','description']) if (typeof draft[key] === 'string') form.elements[key].value = draft[key];
  }
} catch { /* Un borrador inválido no impide crear. */ }
function updateSummary() {
  document.getElementById('participantCount').textContent = `${participants.size} / ${selectedFormat === 'DUEL' ? 'exactamente 2' : 'mínimo 2'}`;
  document.getElementById('judgeCount').textContent = `${judges.size} / ${noJudge() ? 'sin juez' : 'mínimo 1'}`;
  const format = formats.find(item => item.id === selectedFormat);
  document.getElementById('tournamentSummary').textContent = `${format.name} · ${participants.size} participantes · ${noJudge() ? 'sin juez · decide el organizador' : judges.size+' jueces'}`;
}
function selectFormat(id) {
  selectedFormat = id;
  options.querySelectorAll('button').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.id === id)));
  const format = formats.find(item => item.id === id);
  preview.innerHTML = `${formatImage(id)}<div><p class="eyebrow">${format.tag}</p><h2>${format.name}</h2><p>${format.description}</p><p class="format-example">${format.example}</p><p>${format.detail}</p></div>`;
  // Conservamos las selecciones al cambiar de formato; si sobran rivales, se pueden quitar.
  renderPeople();
}
formats.forEach(format => {
  const button = document.createElement('button');
  button.className = 'format-choice'; button.type = 'button'; button.textContent = format.name; button.dataset.id = format.id;
  button.addEventListener('click', () => { selectFormat(format.id); saveDraft(); });
  options.append(button);
});
const owner = profile => profile.owner.split('::')[0];
function usedByOtherRole(profile, role) {
  const otherIds = [...(role !== 'participant' ? participants : []), ...(role !== 'judge' ? judges : []), ...(role !== 'treasurer' && treasurer.value ? [treasurer.value] : [])];
  return profiles.some(other => otherIds.includes(other.id) && owner(other) === owner(profile));
}
// Las fotos se cargan una vez por ruta. Sin foto (o si falla) usamos la inicial.
const avatarRequests = new Map();
function personAvatar(profile) {
  const avatar = document.createElement('span');
  avatar.className = 'person-avatar'; avatar.setAttribute('aria-hidden', 'true');
  decorateAvatar(avatar, owner(profile));
  const initial = Array.from(profile.nickname.trim())[0]?.toLocaleUpperCase('es') || '?';
  avatar.textContent = initial;
  if (profile.avatarPath?.startsWith('profile-pictures/')) {
    if (!avatarRequests.has(profile.avatarPath)) {
      avatarRequests.set(profile.avatarPath, avatarUrl(profile.avatarPath).catch(() => ''));
    }
    void avatarRequests.get(profile.avatarPath).then(url => {
      if (!url) return;
      const image = document.createElement('img');
      image.alt = ''; image.loading = 'lazy'; image.decoding = 'async';
      image.addEventListener('error', () => { avatar.textContent = initial; }, { once: true });
      image.src = url; avatar.replaceChildren(image);
    });
  }
  return avatar;
}
function selectionState(selected) {
  const state = document.createElement('span');
  state.className = 'person-selection'; state.setAttribute('aria-hidden', 'true');
  state.textContent = selected ? '✓ Seleccionado' : 'Elegir';
  return state;
}
function renderPeople() {
  const query = search.value.trim().toLocaleLowerCase('es');
  const filtered = profiles.filter(profile => profile.nickname.toLocaleLowerCase('es').includes(query));
  for (const [role, target, selected] of [['participant','participantsList',participants],['judge','judgesList',judges]]) {
    const list = document.getElementById(target); list.replaceChildren();
    for (const profile of filtered) {
      const label = document.createElement('label'); label.className = 'person-choice';
      const input = document.createElement('input'); input.type = 'checkbox'; input.value = profile.id; input.checked = selected.has(profile.id);
      input.disabled = (role === 'participant' && selectedFormat === 'DUEL' && !input.checked && selected.size >= 2) || usedByOtherRole(profile, role) || profiles.some(other => other.id !== profile.id && selected.has(other.id) && owner(other) === owner(profile));
      input.addEventListener('change', () => {
        if (input.checked && selected.size >= (role === 'participant' ? (selectedFormat === 'DUEL' ? 2 : 64) : 16)) { input.checked = false; return show('Llegaste al máximo de personas para ese rol.', true); }
        input.checked ? selected.add(profile.id) : selected.delete(profile.id);
        renderPeople();
      });
      const name = document.createElement('span'); name.textContent = profile.nickname;
      label.append(input,personAvatar(profile),name,badgeElements(owner(profile)),selectionState(input.checked)); list.append(label);
    }
    if (!filtered.length) { const empty = document.createElement('p'); empty.textContent = profiles.length ? 'No hay perfiles con ese nick.' : 'Todavía no hay perfiles para seleccionar.'; list.append(empty); }
  }
  updateSummary();
}
async function refreshPeople() {
  if (loading) return;
  loading = true; submit.disabled = true;
  const status = document.getElementById('peopleStatus'); status.textContent = 'Cargando cuentas del club…';
  try {
    void loadBadges().then(renderPeople).catch(() => {});
    profiles = (await withDeadline(registeredProfiles(), 'La lista de cuentas tardó demasiado. Usá «Actualizar lista» para reintentar.')).filter(profile => profile.accountComplete);
    for (const selected of [participants,judges]) for (const id of selected) if (!profiles.some(profile => profile.id === id)) selected.delete(id);
    if (treasurer.value && !profiles.some(profile => profile.id === treasurer.value)) treasurer.value = '';
    renderPeople(); status.textContent = `${profiles.length} perfiles disponibles. Para aparecer aquí, cada persona debe ingresar y guardar su nick y teléfono en Mi perfil.`;
  } catch (error) { status.textContent = 'No pudimos cargar la lista. Usá «Actualizar lista» para reintentar.'; show(error.message, true); }
  finally { loading = false; submit.disabled = !pricingReady; }
}
async function connectAccount() {
  const attempt = ++connectionAttempt;
  const gate = document.getElementById('accountGate');
  pricingReady = false; submit.disabled = true;
  fields.disabled = true; gate.hidden = false;
  document.getElementById('accountGateText').textContent = 'Conectando tu cuenta…';
  document.getElementById('tournamentLogin').hidden = true;
  document.getElementById('retryConnection').hidden = true;
  try {
    if (!await withDeadline(configureAmplify(), 'AWS tardó demasiado en responder. Reintentá la conexión.')) throw new Error('No pudimos conectar con AWS. Reintentá la conexión.');
    try { await withDeadline(getCurrentUser(), 'No pudimos comprobar tu sesión a tiempo. Reintentá la conexión.'); }
    catch (error) {
      if (error.name !== 'UserUnAuthenticatedException') throw error;
      if (attempt !== connectionAttempt) return;
      document.getElementById('accountGateText').textContent = 'Ingresá con tu cuenta para crear un torneo.';
      document.getElementById('tournamentLogin').hidden = false;
      return;
    }
    if (attempt !== connectionAttempt) return;
    try { sessionStorage.removeItem(resumeKey); } catch {}
    const pricing=await withDeadline(tournamentFee(), 'No pudimos consultar la tarifa a tiempo. Reintentá la conexión; no se realizó ningún cobro.');
    if (attempt !== connectionAttempt) return;
    pricingReady=pricing.enabled && pricing.canPay;
    document.getElementById('creationFee').textContent=pricing.mode==='TEST' ? 'Modo de prueba: '+money(pricing.amountCents)+' ficticios. Sólo el Creador puede probar el pago.' : 'Tarifa por crear este torneo: '+money(pricing.amountCents)+'. Se paga una sola vez; las invitaciones se envían después de acreditarse.';
    if(!pricing.enabled)document.getElementById('creationFee').textContent='La creación de torneos está pausada temporalmente.';
    if(pricing.mode==='TEST' && !pricing.canPay)document.getElementById('creationFee').textContent='Los pagos siguen en modo de prueba y sólo están habilitados para la cuenta del Creador. Podés recibir invitaciones, pero todavía no crear un torneo desde esta cuenta. No se realizó ningún cobro.';
    pricingMessage=document.getElementById('creationFee').textContent;
    if (!pricingReady) {
      document.getElementById('accountGateText').textContent=pricingMessage;
      document.getElementById('peopleStatus').textContent='La creación de torneos no está habilitada para esta cuenta en este momento.';
      show(pricingMessage); return;
    }
    fields.disabled = false; gate.hidden = true;
    submit.textContent=pricing.mode==='TEST'?'Preparar pago de prueba ↗':'Pagar y crear torneo ↗';
    await refreshPeople();
  } catch (error) {
    if (attempt !== connectionAttempt) return;
    fields.disabled = true; gate.hidden = false;
    document.getElementById('accountGateText').textContent = error.message || 'No pudimos conectar con el servidor. Reintentá la conexión.';
    document.getElementById('retryConnection').hidden = false;
  }
}

document.getElementById('retryConnection').addEventListener('click', () => void connectAccount());
document.getElementById('tournamentLogin').addEventListener('click', () => { saveDraft(); try { sessionStorage.setItem(resumeKey, '1'); } catch {} });
document.getElementById('reloadPeople').addEventListener('click', refreshPeople);
search.addEventListener('input', renderPeople);
treasurer.addEventListener('change', renderPeople);
form.addEventListener('input', saveDraft);
form.addEventListener('submit', async event => {
  event.preventDefault(); if (saving || loading) return;
  if (!pricingReady) return show(pricingMessage, true);
  if (participants.size < 2) return show('Seleccioná al menos dos participantes con cuenta en ProveIt.', true);
  if (selectedFormat === 'DUEL' && participants.size !== 2) return show('El Duelo 1v1 requiere exactamente dos participantes. Quitá las personas sobrantes.', true);
  if (!noJudge() && !judges.size) return show('Seleccioná al menos un juez o elegí el modo sin juez.', true);
  if (noJudge() && !consent.checked) return show(noJudgeConsent, true);
  let startsAt;
  try { startsAt=localToUtc(startsLocal.value,zone.value); if(Date.parse(startsAt)<=Date.now()) throw new Error('Elegí una fecha y hora futuras.'); }
  catch(error) { return show(error.message,true); }
  saving = true; submit.disabled = true; show('Preparando el pago del torneo…');
  try {
    // El mismo identificador permite reintentar si AWS respondió después del límite de espera.
    const result = await withDeadline(createClubTournament({ tournamentId, arbitrationMode: mode.value, startsAt, timeZone: zone.value, acceptOrganizerDecision: noJudge() && consent.checked, name: form.elements.name.value.trim(), activity: form.elements.activity.value.trim(), description: form.elements.description.value.trim(), format: selectedFormat, participantIds: [...participants], judgeIds: [...judges], treasurerId: treasurer.value || null }), 'La preparación del pago tardó demasiado. Podés reintentar desde este formulario; conservamos el identificador para no duplicar la solicitud.', 45000);
    try { sessionStorage.removeItem(draftKey); } catch {}
    location.href = `/pago.html?id=${encodeURIComponent(result.id)}`;
  } catch (error) { show(error.message || 'No se pudo guardar. Podés reintentar.', true); }
  finally { saving = false; submit.disabled = !pricingReady; }
});
Hub.listen('auth', ({payload}) => { if (['signedIn','signedOut'].includes(payload.event)) void connectAccount(); });
selectFormat(selectedFormat);
updateArbitration(); updateSchedule();
void connectAccount().finally(() => window.proveitLoadingDone?.('page'));

