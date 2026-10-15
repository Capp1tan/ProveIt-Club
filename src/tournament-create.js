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
let selectedFormat = formats[0].id;
let loading = false;
let saving = false;
let tournamentId = crypto.randomUUID();
const draftKey = 'proveit:tournament-draft';
const resumeKey = 'proveit:tournament-resume';
const show = (text, error = false) => { notice.textContent = text; notice.dataset.error = String(error); };
function saveDraft() {
  try { sessionStorage.setItem(draftKey, JSON.stringify({ format: selectedFormat, name: form.elements.name.value, activity: form.elements.activity.value, description: form.elements.description.value })); } catch { /* El formulario funciona sin almacenamiento local. */ }
}
try {
  const draft = JSON.parse(sessionStorage.getItem(draftKey) || 'null');
  if (draft) {
    if (formats.some(format => format.id === draft.format)) selectedFormat = draft.format;
    for (const key of ['name','activity','description']) if (typeof draft[key] === 'string') form.elements[key].value = draft[key];
  }
} catch { /* Un borrador inválido no impide crear. */ }
function updateSummary() {
  document.getElementById('participantCount').textContent = `${participants.size} / ${selectedFormat === 'DUEL' ? 'exactamente 2' : 'mínimo 2'}`;
  document.getElementById('judgeCount').textContent = `${judges.size} / mínimo 1`;
  const format = formats.find(item => item.id === selectedFormat);
  document.getElementById('tournamentSummary').textContent = `${format.name} · ${participants.size} participantes · ${judges.size} jueces · ${treasurer.value ? 'con tesorero' : 'sin tesorero'}`;
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
      label.append(input,personAvatar(profile),name,selectionState(input.checked)); list.append(label);
    }
    if (!filtered.length) { const empty = document.createElement('p'); empty.textContent = profiles.length ? 'No hay perfiles con ese nick.' : 'Todavía no hay perfiles para seleccionar.'; list.append(empty); }
  }
  // El tesorero usa tarjetas con radio: permite elegir una sola cuenta o ninguna.
  const treasuryList = document.getElementById('treasurerList');
  treasuryList.replaceChildren();
  for (const profile of [null, ...filtered]) {
    const id = profile?.id || '';
    const label = document.createElement('label'); label.className = 'person-choice';
    const input = document.createElement('input'); input.type = 'radio';
    input.name = 'treasurerChoice'; input.value = id; input.checked = treasurer.value === id;
    input.disabled = Boolean(profile && usedByOtherRole(profile, 'treasurer'));
    input.addEventListener('change', () => { treasurer.value = id; renderPeople(); });
    const name = document.createElement('span'); name.textContent = profile?.nickname || 'Sin tesorero';
    const avatar = profile ? personAvatar(profile) : document.createElement('span');
    if (!profile) { avatar.className = 'person-avatar'; avatar.textContent = '—'; avatar.setAttribute('aria-hidden','true'); }
    label.append(input,avatar,name,selectionState(input.checked)); treasuryList.append(label);
  }
  updateSummary();
}
async function refreshPeople() {
  if (loading) return;
  loading = true; submit.disabled = true;
  const status = document.getElementById('peopleStatus'); status.textContent = 'Cargando cuentas del club…';
  try {
    profiles = await registeredProfiles();
    for (const selected of [participants,judges]) for (const id of selected) if (!profiles.some(profile => profile.id === id)) selected.delete(id);
    if (treasurer.value && !profiles.some(profile => profile.id === treasurer.value)) treasurer.value = '';
    renderPeople(); status.textContent = `${profiles.length} perfiles disponibles. Para aparecer aquí, cada persona debe ingresar y guardar su nick en Mi perfil.`;
  } catch (error) { status.textContent = 'No pudimos cargar la lista. Usá «Actualizar lista» para reintentar.'; show(error.message, true); }
  finally { loading = false; submit.disabled = false; }
}
async function connectAccount() {
  const gate = document.getElementById('accountGate');
  try {
    if (!await configureAmplify()) throw new Error('No pudimos conectar con AWS. Recargá para intentar de nuevo.');
    await getCurrentUser(); fields.disabled = false; gate.hidden = true;
    try { sessionStorage.removeItem(resumeKey); } catch {}
    await refreshPeople();
  } catch {
    fields.disabled = true; gate.hidden = false;
    document.getElementById('accountGateText').textContent = 'Ingresá con tu cuenta para elegir integrantes y guardar el torneo.';
    document.getElementById('tournamentLogin').hidden = false;
  }
}
document.getElementById('tournamentLogin').addEventListener('click', () => { saveDraft(); try { sessionStorage.setItem(resumeKey, '1'); } catch {} });
document.getElementById('reloadPeople').addEventListener('click', refreshPeople);
search.addEventListener('input', renderPeople);
treasurer.addEventListener('change', renderPeople);
form.addEventListener('input', saveDraft);
form.addEventListener('submit', async event => {
  event.preventDefault(); if (saving || loading) return;
  if (participants.size < 2) return show('Seleccioná al menos dos participantes con cuenta en ProveIt.', true);
  if (selectedFormat === 'DUEL' && participants.size !== 2) return show('El Duelo 1v1 requiere exactamente dos participantes. Quitá las personas sobrantes.', true);
  if (!judges.size) return show('Seleccioná al menos un juez.', true);
  saving = true; submit.disabled = true; show('Guardando tu torneo…');
  try {
    const result = await createClubTournament({ tournamentId, name: form.elements.name.value.trim(), activity: form.elements.activity.value.trim(), description: form.elements.description.value.trim(), format: selectedFormat, participantIds: [...participants], judgeIds: [...judges], treasurerId: treasurer.value || null });
    try { sessionStorage.removeItem(draftKey); } catch {}
    location.href = `/torneo.html?id=${encodeURIComponent(result.id)}`;
  } catch (error) { show(error.message || 'No se pudo guardar. Podés reintentar.', true); }
  finally { saving = false; submit.disabled = false; }
});
Hub.listen('auth', ({payload}) => { if (['signedIn','signedOut'].includes(payload.event)) void connectAccount(); });
selectFormat(selectedFormat);
void connectAccount();

