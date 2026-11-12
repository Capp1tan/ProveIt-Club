import { tournamentFee, money } from './billing-api.js';
import { noJudgeConsent, timeZones, zoneLabel, localToUtc, scheduleLabel } from './tournament-schedule.js';
import { loadBadges, badgeElements, decorateAvatar } from './badges.js';
import { Hub } from 'aws-amplify/utils';
import { avatarUrl, configureAmplify, getCurrentUser } from './auth-client.js';
import { formats, formatImage } from './tournament-formats.js';
import { registeredProfiles, createClubTournament, tournamentClient } from './tournaments-api.js';
import {editCover} from './cover-editor.js';
import { prepareCover, uploadTournamentCover } from './tournament-cover.js';
import { renderTournamentPreview } from './tournament-preview.js';

let requestedRival = new URLSearchParams(location.search).get('rival');

const $ = id => document.getElementById(id);
const form = $('tournamentForm'), fields = $('tournamentFields'), submit = $('createTournament');
const participants = new Set(), judges = new Set();
let profiles = [], currentSub = '', selectedFormat = 'DUEL', step = 1, tournamentId = crypto.randomUUID();
let loading = false, saving = false, coverWorking = false, pricingReady = false, creationIsFree = false, epoch = 0;
let coverBlob = null, coverObjectUrl = '', coverPath = '', pendingRequest = null;
let coverSource=null,coverFraming=null,coverEditorAbort=null;
let pricingMessage = 'Consultando tarifa…', draftTimer, modelTimer;
const noJudge = () => form.elements.arbitrationMode.value === 'ORGANIZER';
const capacity = () => Number(form.elements.participantLimit.value);
const owner = p => p.owner?.split('::')[0];
const draftKey = () => 'proveit:tournament-draft:v2:' + currentSub;
const show = (text = '', error = false) => { $('tournamentNotice').textContent = text; $('tournamentNotice').dataset.error = String(error); };

async function withDeadline(operation, message, milliseconds = 20000) {
  let timer;
  try { return await Promise.race([operation, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(message)), milliseconds); })]); }
  finally { clearTimeout(timer); }
}
const detectedZone=Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
$('timeZone').value=detectedZone;
$('detectedTimezone').textContent='Horario local: '+detectedZone.replaceAll('_',' ')+' · detectado automáticamente, sin ubicación GPS.';

// Borrador por cuenta: conserva elecciones e ID para reintentos, sin teléfonos ni emails.
function saveDraft() {
  if (!currentSub || saving) return;
  try {
    sessionStorage.setItem(draftKey(), JSON.stringify({
      name: form.elements.name.value, activity: form.elements.activity.value, overview: form.elements.overview.value,
      description: form.elements.description.value, conflicts: form.elements.conflicts.value,
      participantLimit: capacity(), arbitrationMode: form.elements.arbitrationMode.value,
      prizeType:form.elements.prizeType.value,prizeTitle:form.elements.prizeTitle.value,prizeDescription:form.elements.prizeDescription.value,prizeHolder:form.elements.prizeHolder.value,prizeFunder:form.elements.prizeFunder.value,
      prizeExpected: form.elements.prizeExpected.value, startsLocal: $('startsLocal').value, timeZone: $('timeZone').value,
      participants: [...participants], judges: [...judges], format: selectedFormat, step, tournamentId, coverPath, pendingRequest,
    }));
  } catch { /* Guardar es opcional y no muestra etiquetas en la interfaz. */ }
}
function restoreDraft() {
  form.reset(); participants.clear(); judges.clear(); clearCover(); pendingRequest = null;
  saving = false; coverWorking = false;
  selectedFormat = 'DUEL'; tournamentId = crypto.randomUUID(); step = 1;
  $('timeZone').value=detectedZone;
  try {
    const d = JSON.parse(sessionStorage.getItem(draftKey()) || 'null');
    if (!d) return;
    for (const key of ['name', 'activity', 'overview', 'description', 'conflicts', 'startsLocal','prizeType','prizeTitle','prizeDescription','prizeHolder','prizeFunder']) if (typeof d[key] === 'string') form.elements[key].value = d[key];
    if (Number.isInteger(d.participantLimit) && d.participantLimit >= 2 && d.participantLimit <= 64) form.elements.participantLimit.value = d.participantLimit;
    if (['JUDGES', 'ORGANIZER'].includes(d.arbitrationMode)) form.elements.arbitrationMode.value = d.arbitrationMode;
    if (['yes', 'no'].includes(d.prizeExpected)) form.elements.prizeExpected.value = d.prizeExpected;
    $('timeZone').value=detectedZone;
    if (formats.some(f => f.id === d.format)) selectedFormat = d.format;
    if (/^[a-f0-9-]{36}$/i.test(d.tournamentId)) tournamentId = d.tournamentId;
    for (const id of Array.isArray(d.participants) ? d.participants : []) if (typeof id === 'string') participants.add(id);
    for (const id of Array.isArray(d.judges) ? d.judges : []) if (typeof id === 'string') judges.add(id);
    if (typeof d.coverPath === 'string' && d.coverPath.startsWith(`tournament-covers/${currentSub}/${tournamentId}/`)) coverPath = d.coverPath;
    if (d.pendingRequest?.tournamentId === tournamentId) pendingRequest = d.pendingRequest;
    step = d.step === 2 ? 2 : 1;
    if (coverPath) $('coverStatus').textContent = 'La portada ya se subió y se conservará al publicar.';
  } catch { /* Un borrador dañado nunca impide empezar otro. */ }
}

function syncPoster() {
  $('posterName').textContent = form.elements.name.value.trim() || 'El nombre\nlo ponés vos.';
  $('posterActivity').textContent = form.elements.activity.value.trim() || 'TU PRÓXIMO DESAFÍO';
  $('reviewName').textContent = form.elements.name.value.trim() || 'Tu torneo';
  $('arbitrationWarning').hidden = !noJudge(); $('prizeHint').hidden = form.elements.prizeExpected.value !== 'yes';
  const withPrize=form.elements.prizeExpected.value==='yes';$('creationPrizeSection').hidden=!withPrize;
  $('creationPrizeTitleLabel').textContent=form.elements.prizeType.value==='MONEY'?'Importe y moneda (por ejemplo, 50.000 ARS)':'Nombre del premio';
  for(const id of ['creationPrizeTitle','creationPrizeHolder'])$(id).required=withPrize;
}
function syncArbitration() {
  if (noJudge()) judges.clear();
  $('judgesSection').hidden = noJudge(); $('organizerConsentLabel').hidden = !noJudge();
  $('judgeModeHelp').textContent = noJudge() ? 'Sin juez: el organizador decide el resultado y coordina el dinero. Todos deben aceptarlo.' : 'El juez también coordina el dinero del torneo.';
  $('organizerConsent').required = noJudge(); syncPoster();
}
function updateSchedule() {
  try {
    const utc = localToUtc($('startsLocal').value, $('timeZone').value), text = scheduleLabel(utc, $('timeZone').value);
    $('schedulePreview').textContent = text; $('scheduleSummary').textContent = text;
  } catch { $('schedulePreview').textContent = 'Elegí una fecha y hora futuras.'; $('scheduleSummary').textContent = 'Horario pendiente'; }
}
function updateSummary() {
  const format = formats.find(f => f.id === selectedFormat);
  $('participantCount').textContent = `${participants.size} / ${capacity()}`;
  $('judgeCount').textContent = noJudge() ? 'Sin juez' : `${judges.size} elegidos`;
  $('tournamentSummary').textContent = `${format.name} · ${capacity()} participantes · ${noJudge() ? 'decide el organizador' : judges.size + ' jueces invitados'}`;
  $('creationFee').textContent = pricingMessage;
  submit.textContent = pendingRequest ? 'Retomar publicación ↗' : creationIsFree ? 'Crear y enviar invitaciones ↗' : 'Continuar al pago ↗';
  $('preparedRequestActions').hidden = !pendingRequest;
  $('originalRequestLink').href = '/pago.html?id=' + encodeURIComponent(tournamentId);
}
function lockPreparedRequest() {
  // Una solicitud de pago preparada es inmutable: el reintento no puede cobrar otra configuración.
  for (const control of form.querySelectorAll('input,textarea,select,button')) {
    if (![submit, $('previousCreationStep'), $('nextCreationStep'), $('newLocalTournament')].includes(control)) control.disabled = Boolean(pendingRequest);
  }
  // Volver es navegación; nunca cambia ni duplica una solicitud de pago.
  $('previousCreationStep').disabled = false;
  if (!pendingRequest) renderPeople();
}
function updateModel() {
  clearTimeout(modelTimer); modelTimer = setTimeout(() => {
    const names = [...participants].map(id => profiles.find(p => p.id === id)?.nickname).filter(Boolean);
    renderTournamentPreview($('bracketPreview'), { format: selectedFormat, count: Math.max(2, Math.min(64, capacity() || 2)), names });
  }, 100);
}
function selectFormat(id) {
  selectedFormat = id;
  $('formatOptions').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.id === id)));
  const description = document.createElement('p'); description.textContent = formats.find(f => f.id === id).description;
  $('formatPreview').replaceChildren(description); updateSummary(); updateModel();
}
for (const format of formats) {
  const b = document.createElement('button'); b.type = 'button'; b.className = 'format-choice'; b.dataset.id = format.id; const image=document.createElement('span');image.className='format-thumbnail';image.innerHTML=formatImage(format.id);const label=document.createElement('span');label.textContent=format.name;b.append(image,label);
  b.addEventListener('click', () => { selectFormat(format.id); saveDraft(); }); $('formatOptions').append(b);
}

function personAvatar(profile) {
  const node = document.createElement('span'); node.className = 'person-avatar'; node.setAttribute('aria-hidden', 'true');
  const initial = Array.from(profile.nickname)[0]?.toUpperCase() || '?'; node.textContent = initial; decorateAvatar(node, owner(profile));
  if (profile.avatarPath) void avatarUrl(profile.avatarPath, { profileId: profile.id }).then(url => {
    if (!node.isConnected) return;
    const img = document.createElement('img'); img.alt = ''; img.width = 30; img.height = 30; img.decoding = 'async'; img.src = url;
    img.addEventListener('error', () => { node.textContent = initial; }, { once: true }); node.replaceChildren(img);
  }).catch(() => {});
  return node;
}
function renderPeople() {
  const query = $('peopleSearch').value.trim().toLocaleLowerCase('es');
  const filtered = profiles.filter(p => p.nickname.toLocaleLowerCase('es').includes(query));
  $('selectedParticipants').replaceChildren();
  for (const id of participants) {
    const p = profiles.find(p => p.id === id); if (!p) continue;
    const b = document.createElement('button'); b.type = 'button'; b.setAttribute('aria-label', 'Quitar a ' + p.nickname);
    b.disabled = Boolean(pendingRequest);
    b.append(personAvatar(p), document.createTextNode(p.nickname + ' ×')); b.addEventListener('click', () => { participants.delete(id); selectionChanged(); });
    $('selectedParticipants').append(b);
  }
  for (const [role, target, chosen] of [['participant', 'participantsList', participants], ['judge', 'judgesList', judges]]) {
    const list = $(target); list.replaceChildren();
    for (const profile of filtered) {
      const label = document.createElement('label'); label.className = 'person-choice';
      const check = document.createElement('input'); check.type = 'checkbox'; check.checked = chosen.has(profile.id);
      check.disabled = pendingRequest !== null || (!check.checked && chosen.size >= (role === 'participant' ? capacity() : 16)) || profiles.some(other => other.id !== profile.id && chosen.has(other.id) && owner(other) === owner(profile));
      check.addEventListener('change', () => { check.checked ? chosen.add(profile.id) : chosen.delete(profile.id); selectionChanged(); });
      const name = document.createElement('span'); name.textContent = profile.nickname;
      const state = document.createElement('span'); state.className = 'person-selection'; state.textContent = check.checked ? '✓ Seleccionado' : 'Elegir'; state.setAttribute('aria-hidden', 'true');
      label.append(check, personAvatar(profile), name, badgeElements(owner(profile)), state); list.append(label);
    }
    if (!list.childElementCount) { const p = document.createElement('p'); p.className = 'editorial-help'; p.textContent = role === 'judge' ? 'No hay jueces disponibles con ese nick.' : 'No hay perfiles disponibles con ese nick.'; list.append(p); }
  }
  updateSummary(); updateModel();
}
function selectionChanged() { renderPeople(); saveDraft(); }
async function refreshPeople() {
  if (loading || !currentSub) return;
  const activeEpoch = epoch; loading = true; $('reloadPeople').disabled = true;
  $('peopleStatus').textContent = 'Cargando cuentas del club…';
  try {
    const found = await withDeadline(registeredProfiles(), 'La lista tardó demasiado. Usá «Actualizar lista» para reintentar.');
    if (activeEpoch !== epoch) return;
    profiles = found.filter(p => p.accountComplete);
    for (const chosen of [participants, judges]) for (const id of chosen) if (!profiles.some(p => p.id === id)) chosen.delete(id);
    let challengeHint = '';
    if (requestedRival && !pendingRequest) {
      const rival = profiles.find(p => p.id === requestedRival && owner(p) !== currentSub);
      if (rival) {
        if (!participants.size && capacity() === 2) {
          const self = profiles.find(p => owner(p) === currentSub);
          if (self) participants.add(self.id);
          participants.add(rival.id); selectFormat('DUEL');
        } else if (participants.size < capacity()) participants.add(rival.id);
        challengeHint = participants.has(rival.id) ? ` ${rival.nickname} está seleccionado. La invitación se enviará al publicar.` : ` El borrador conserva sus participantes; podés seleccionar a ${rival.nickname} manualmente.`;
        saveDraft();
      }
      requestedRival = null;
      const url = new URL(location.href); url.searchParams.delete('rival'); history.replaceState(null, '', url);
    }
    renderPeople(); $('peopleStatus').textContent = `${profiles.length} cuentas disponibles. Cada invitado debe tener su perfil completo.${challengeHint}`;
    void loadBadges().then(() => { if (activeEpoch === epoch) renderPeople(); }).catch(() => {});
  } catch (e) { $('peopleStatus').textContent = e.message; }
  finally { if (activeEpoch === epoch) { loading = false; $('reloadPeople').disabled = false; } }
}

// Las etapas ocultas no participan de la validación hasta que corresponde.
function validateStepOne() {
  for (const id of ['tournamentName', 'tournamentActivity', 'tournamentOverview', 'tournamentDescription', 'participantLimit']) {
    if (!$(id).reportValidity()) return false;
  }
  if (form.elements.name.value.trim().length < 3 || form.elements.activity.value.trim().length < 2 || form.elements.description.value.trim().length < 10) {
    show('Agregá un nombre, una actividad y reglas de al menos 10 caracteres.', true); return false;
  }
  if (coverWorking) { show('Esperá a que termine de prepararse la imagen.', true); return false; }
  return true;
}
function setStep(value, focus = true) {
  step = value; $('creationStep1').hidden = value !== 1; $('creationStep2').hidden = value !== 2;
  document.querySelectorAll('[data-step-indicator]').forEach(n => {
    const num = Number(n.dataset.stepIndicator); n.dataset.complete = String(num < value);
    if (num === value) n.setAttribute('aria-current', 'step'); else n.removeAttribute('aria-current');
  });
  if (focus) { (value === 2 ? $('stepTwoTitle') : $('tournamentName')).focus(); $('creationTitle').scrollIntoView({ block: 'start', behavior: 'instant' }); }
  if (value === 2 && !profiles.length) void refreshPeople();
  saveDraft();
}
$('nextCreationStep').addEventListener('click', () => { show(); if (validateStepOne()) setStep(2); });
$('previousCreationStep').addEventListener('click', () => { show(); setStep(1); });
$('newLocalTournament').addEventListener('click', () => {
  if (saving) return;
  // Cambiar el ID conserva intactos los registros y cobros de la solicitud anterior.
  pendingRequest = null; tournamentId = crypto.randomUUID();
  if (coverPath) { coverPath = ''; if (!coverBlob) $('coverStatus').textContent = 'Volvé a elegir la imagen para esta nueva creación.'; }
  lockPreparedRequest(); updateSummary(); setStep(1); saveDraft();
  show('Podés editar los datos para crear otro torneo. La solicitud anterior no fue cancelada ni reembolsada.');
});
$('peopleSearch').addEventListener('input', renderPeople); $('reloadPeople').addEventListener('click', refreshPeople);
form.elements.participantLimit.addEventListener('change', () => {
  if (capacity() !== 2 && selectedFormat === 'DUEL') selectFormat('ROUND_ROBIN');
  // Nunca quitar participantes silenciosamente: el usuario decide a quién deseleccionar.
  renderPeople(); if (participants.size > capacity()) show('Hay más invitados que cupos. Quitá las selecciones sobrantes en la siguiente etapa.', true);
});
form.addEventListener('input', e => {
  if (e.target.name === 'arbitrationMode') { $('organizerConsent').checked = false; syncArbitration(); renderPeople(); }
  syncPoster(); updateSchedule(); updateSummary(); clearTimeout(draftTimer); draftTimer = setTimeout(saveDraft, 250);
});

function clearCover() {
  coverEditorAbort?.abort();coverEditorAbort=null;coverSource=null;coverFraming=null;$('editCover').hidden=true;
  if (coverObjectUrl) URL.revokeObjectURL(coverObjectUrl);
  coverObjectUrl = ''; coverBlob = null; coverPath = ''; $('coverPreview').removeAttribute('src'); $('coverPreview').hidden = true;
  $('posterEmpty').hidden = false; $('removeCover').hidden = true; $('coverInput').value = ''; $('chooseCover').querySelector('span').textContent = 'Agregar imagen';
  $('coverStatus').textContent = 'JPG, PNG o WebP · hasta 5 MB. Podés mover y ajustar la imagen antes de usarla.';
}
const poster=$('creationPoster');
const coverInput=$('coverInput');
const canChooseCover=()=>!coverInput.matches(':disabled') && !coverWorking && !saving;
function openCoverPicker(){
 if(canChooseCover())coverInput.click();
}
$('chooseCover').addEventListener('click',openCoverPicker);
$('posterPicker').addEventListener('click',openCoverPicker);
let fileDragDepth=0;
poster.addEventListener('dragenter',event=>{
 if(!event.dataTransfer?.types.includes('Files'))return;
 event.preventDefault();
 fileDragDepth++;
 poster.classList.toggle('is-file-over',canChooseCover());
});
poster.addEventListener('dragover',event=>{
 if(!event.dataTransfer?.types.includes('Files'))return;
 event.preventDefault();
 event.dataTransfer.dropEffect=canChooseCover()?'copy':'none';
});
poster.addEventListener('dragleave',()=>{
 fileDragDepth=Math.max(0,fileDragDepth-1);
 if(!fileDragDepth)poster.classList.remove('is-file-over');
});
poster.addEventListener('drop',event=>{
 if(!event.dataTransfer?.files.length)return;
 event.preventDefault();
 fileDragDepth=0;
 poster.classList.remove('is-file-over');
 if(!canChooseCover())return;
 if(event.dataTransfer.files.length!==1){
  $('coverStatus').textContent='Elegí una sola imagen para la portada.';
  return;
 }
 void adjustCover(event.dataTransfer.files[0]);
});
$('removeCover').addEventListener('click', () => { clearCover(); saveDraft(); });
async function adjustCover(file,framing=null){
  if(coverWorking || saving)return;const activeEpoch=epoch;coverWorking=true;coverEditorAbort=new AbortController();$('coverStatus').textContent='Ajustá el encuadre de la imagen…';
  try{
    const edited=await editCover(file,framing || {},coverEditorAbort.signal);if(activeEpoch!==epoch)return;
    if(!edited){$('coverStatus').textContent=coverBlob || coverPath?'Se conserva la portada anterior.':'No se seleccionó una portada.';return;}
    clearCover();coverBlob=edited.blob;coverSource=file;coverFraming=edited.framing;coverObjectUrl=URL.createObjectURL(coverBlob);$('coverPreview').src=coverObjectUrl;
    $('coverPreview').hidden=false;$('posterEmpty').hidden=true;$('removeCover').hidden=false;$('editCover').hidden=false;
    $('chooseCover').querySelector('span').textContent='Cambiar imagen';$('coverStatus').textContent='Portada 9:16 lista. Se subirá cuando publiques el torneo.';saveDraft();
  }catch(error){if(activeEpoch===epoch)$('coverStatus').textContent=error.message;}
  finally{if(activeEpoch===epoch){coverWorking=false;coverEditorAbort=null;$('coverInput').value='';}}
}
$('coverInput').addEventListener('change',()=>{const file=$('coverInput').files[0];if(file)void adjustCover(file);});
$('editCover').addEventListener('click',()=>{if(coverSource)void adjustCover(coverSource,coverFraming);});


async function connectAccount() {
  const activeEpoch = ++epoch; pricingReady = false; fields.disabled = true; $('accountGate').hidden = false;
  $('accountGateText').textContent = 'Conectando tu cuenta…'; $('retryConnection').hidden = true; $('tournamentLogin').hidden = true;
  try {
    if (!await withDeadline(configureAmplify(), 'No pudimos conectar con AWS. Reintentá.')) throw new Error('No pudimos conectar con AWS.');
    const user = await withDeadline(getCurrentUser(), 'No pudimos comprobar tu sesión. Reintentá.');
    if (activeEpoch !== epoch) return;
    if (currentSub !== user.userId) { currentSub = user.userId; profiles = []; loading = false; restoreDraft(); }
    const pricing = await withDeadline(tournamentFee(), 'No pudimos consultar la tarifa. Todavía no se realizó ningún cobro.');
    if (activeEpoch !== epoch) return;
    pricingReady = Boolean(pricing.enabled); creationIsFree = true;
    pricingMessage = pricing.participantAmountCents===0?'Crear y participar en este torneo es gratis para todos.':`Crear el torneo es gratis. Cada participante paga ${money(pricing.participantAmountCents ?? 50000)} al aceptar su invitación. Los jueces no pagan salvo que también compitan.`;
    if (!pricingReady) throw new Error(pricing.enabled ? 'La creación no está habilitada para esta cuenta en este momento.' : 'La creación de torneos está pausada temporalmente.');
    fields.disabled = false; $('accountGate').hidden = true; submit.disabled = false;
    syncArbitration(); syncPoster(); updateSchedule(); selectFormat(selectedFormat); setStep(pendingRequest ? 2 : step, false); lockPreparedRequest();
    if (pendingRequest) show('Hay una publicación iniciada. Al continuar retomaremos esa solicitud con sus datos originales.');
  } catch (e) {
    if (activeEpoch !== epoch) return;
    $('accountGateText').textContent = e.name === 'UserUnAuthenticatedException' ? 'Ingresá con tu cuenta para preparar el torneo.' : e.message;
    $('tournamentLogin').hidden = e.name !== 'UserUnAuthenticatedException'; $('retryConnection').hidden = e.name === 'UserUnAuthenticatedException';
  }
}
$('retryConnection').addEventListener('click', () => void connectAccount());
$('tournamentLogin').addEventListener('click', () => { saveDraft(); try { sessionStorage.setItem('proveit:tournament-resume', '1'); } catch {} });

form.addEventListener('submit', async event => {
  event.preventDefault(); if (saving || loading) return;
  if (step === 1) { if (validateStepOne()) setStep(2); return; }
  if (!pricingReady) return show('Reintentá la conexión antes de publicar.', true);
  if (!pendingRequest && !validateStepOne()) { setStep(1); return; }
  let startsAt = pendingRequest?.startsAt;
  if (!pendingRequest) {
  if (participants.size !== capacity()) { $('participantsList').closest('details').open = true; return show(`Elegí exactamente ${capacity()} participantes. Por ahora seleccionaste ${participants.size}.`, true); }
  if (selectedFormat === 'DUEL' && capacity() !== 2) return show('El Duelo 1v1 necesita exactamente dos participantes. Elegí otro formato o cambiá el cupo.', true);
  if (!noJudge() && !judges.size) { $('judgesSection').closest('details').open = true; return show('Elegí al menos un juez o volvé a la primera etapa para elegir «Sin jurado».', true); }
  if (noJudge() && !$('organizerConsent').checked) { $('organizerConsent').closest('details').open = true; return show(noJudgeConsent, true); }
  try { startsAt = localToUtc($('startsLocal').value, $('timeZone').value); if (Date.parse(startsAt) <= Date.now()) throw new Error('Elegí una fecha y hora futuras.'); }
  catch (e) { return show(e.message, true); }
  }
  if(!pendingRequest && form.elements.prizeExpected.value==='yes'){for(const id of ['creationPrizeTitle','creationPrizeHolder'])if(!$(id).reportValidity())return;}
  const activeEpoch = epoch, activeSub = currentSub, activeDraftKey = draftKey();
  saving = true; fields.disabled = true; show(coverBlob && !coverPath ? 'Subiendo la portada…' : 'Preparando publicación…');
  try {
    if (!pendingRequest) {
      if (coverBlob && !coverPath) coverPath = await withDeadline(uploadTournamentCover(tournamentId, coverBlob), 'La subida tardó demasiado. Reintentá; no se inició ningún cobro.', 60000);
      if (activeEpoch !== epoch) return;
      let prizeImagePath=null;
      const prizeFile=$('creationPrizeImage').files?.[0];
      if(prizeFile && form.elements.prizeExpected.value==='yes'){const blob=await prepareCover(prizeFile);prizeImagePath=await uploadTournamentCover(tournamentId,blob);}
      pendingRequest = { prizeImagePath,tournamentId, name: form.elements.name.value.trim(), activity: form.elements.activity.value.trim(), overview: form.elements.overview.value.trim(),
        description: form.elements.description.value.trim(), conflicts: form.elements.conflicts.value.trim(), format: selectedFormat,
        participantIds: [...participants], judgeIds: [...judges], participantLimit: capacity(), arbitrationMode: form.elements.arbitrationMode.value,
        startsAt, timeZone: $('timeZone').value, acceptOrganizerDecision: noJudge() && $('organizerConsent').checked,
        ...(form.elements.prizeExpected.value==='yes'?{prizeType:form.elements.prizeType.value,prizeTitle:form.elements.prizeTitle.value.trim(),prizeDescription:form.elements.prizeDescription.value.trim(),prizeHolder:form.elements.prizeHolder.value.trim(),prizeFunder:form.elements.prizeFunder.value.trim()}:{}),
        prizeExpected: form.elements.prizeExpected.value === 'yes', coverPath: coverPath || null, treasurerId: null };
      saving = false; saveDraft(); saving = true;
    }
    show(creationIsFree ? 'Creando torneo y enviando invitaciones…' : 'Preparando el checkout. Todavía no se realizó ningún cobro.');
    const result = await withDeadline(createClubTournament(pendingRequest), 'La solicitud tardó demasiado. Conservamos su identificador para poder retomarla sin duplicarla.', 45000);
    if (activeEpoch !== epoch || activeSub !== currentSub) return;
    try { sessionStorage.removeItem(activeDraftKey); } catch {}
    location.href = `${result.status === 'EXEMPT' ? '/torneo.html' : '/pago.html'}?id=${encodeURIComponent(result.id)}`;
  } catch (e) {
    if (activeEpoch !== epoch) return;
    // Releer antes de permitir cambios: puede haberse guardado una solicitud aunque se perdiera la respuesta.
    let known = false;
    try { const client = await tournamentClient(); const r = await withDeadline(client.models.TournamentPayment.get({ id: tournamentId }), 'Sin respuesta', 10000); known = Boolean(r.data?.id); } catch { known = true; }
    if (!known) pendingRequest = null;
    show(e.message + (pendingRequest ? ' Al reintentar se conservarán los datos de esa publicación.' : ''), true);
  } finally {
    if (activeEpoch === epoch) { saving = false; fields.disabled = false; submit.disabled = !pricingReady; updateSummary(); lockPreparedRequest(); saveDraft(); }
  }
});
Hub.listen('auth', ({ payload }) => {
  if (payload.event === 'signedOut') {
    saveDraft(); ++epoch; fields.disabled = true; currentSub = ''; profiles = []; participants.clear(); judges.clear(); clearCover();
    form.reset(); pendingRequest = null; step = 1; syncArbitration(); renderPeople(); setStep(1, false);
  }
  if (['signedIn', 'signedOut'].includes(payload.event)) void connectAccount();
});
syncPoster(); updateSchedule(); selectFormat(selectedFormat);
void connectAccount().finally(() => window.proveitLoadingDone?.('page'));
