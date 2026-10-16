import { prizePanel } from './tournament-prize.js';
import { sharePanel } from './tournament-share.js';
import { myPendingPayments, money } from './billing-api.js';
import { loadBadges, badgeElements, initializeAccess } from './badges.js';
import { deleteTournament } from './maintenance-api.js';
import { ProfilePreview } from './profile-preview.js';
import { connectBracket } from './bracket-lines.js';
import { Hub } from 'aws-amplify/utils';
import { scheduleLabel, countdownLabel, noJudgeConsent } from './tournament-schedule.js';
// Sala de espera y cuadro: las confirmaciones y el sorteo provienen de AWS.
import { formats, formatImage } from './tournament-formats.js';
import { avatarUrl, getCurrentUser, configureAmplify } from './auth-client.js';
import { listClubTournaments, getClubTournament, registeredProfiles, ensureClubTournamentDraw, recordClubDuelResult } from './tournaments-api.js';
const notice=document.getElementById('tournamentsNotice'),detail=document.getElementById('tournamentDetail'),list=document.getElementById('tournamentsList');
const element=(tag,text,className)=>{const node=document.createElement(tag);node.textContent=text;if(className)node.className=className;return node;};
const stateNames={PENDING:'Esperando confirmación',ACCEPTED:'Confirmado',REJECTED:'Invitación rechazada'};
let profiles=new Map(),lastVersion='',refreshing=false,currentUser=null,currentTournament=null;
let drawCleanup;
let isClubAdmin=false;
const photoRequests=new Map();
const profilePreview=detail ? new ProfilePreview({avatar,badges:badgeElements}) : null;
Hub.listen('auth',({payload})=>{if(payload.event==='signedOut')profilePreview?.lock();});
function avatar(id,name) {
  const node=element('span',Array.from(name.trim())[0]?.toUpperCase() || '?','person-avatar');
  node.setAttribute('aria-hidden','true');
  const path=profiles.get(id)?.avatarPath;
  if(path?.startsWith('profile-pictures/')) {
    if(!photoRequests.has(path)) photoRequests.set(path,avatarUrl(path).catch(()=>''));
    void photoRequests.get(path).then(url=>{if(!url)return;const img=document.createElement('img');img.alt='';img.loading='lazy';img.src=url;img.addEventListener('error',()=>{node.textContent=Array.from(name)[0] || '?';},{once:true});node.replaceChildren(img);});
  }
  return node;
}
function states(t) {return t.rosterStatuses || Array(t.participantIds.length+t.judgeIds.length+(t.treasurerId?1:0)).fill('ACCEPTED');}
function roster(title,ids,names,statuses) {
  const section=element('section','','tournament-panel');
  section.append(element('h2',title+' · '+statuses.filter(s=>s==='ACCEPTED').length+' confirmados'));
  const rows=element('ul','','waiting-roster');
  names.forEach((name,i)=>{
    const state=statuses[i] || 'PENDING';
    const row=element('li','','waiting-person');row.dataset.state=state;
    const stateLabel=state==='ACCEPTED' && currentTournament?.arbitrationMode==='ORGANIZER' ? 'Confirmado · aceptó sin juez' : stateNames[state] || 'Pendiente';
    row.append(profilePreview.button(ids[i],name),element('span',stateLabel,'waiting-state'));rows.append(row);
  });
  if(!names.length) rows.append(element('li',title==='Jueces' ? 'Sin juez · decide el organizador' : 'Sin tesorero'));
  section.append(rows);return section;
}
function drawBoard(t) {
  const section=element('section','','tournament-panel');
  section.append(element('h2','Cruces sorteados'));
  let draw;
  try {draw=JSON.parse(t.draw);} catch {section.append(element('p','No pudimos leer el sorteo guardado. Actualizá para reintentar.'));return section;}
  const players=new Map(draw.order.map(player=>[player.id,player]));
  const board=element('div','','draw-board');
  board.setAttribute('role','region');board.setAttribute('aria-label','Llave del torneo. Los nombres abren una vista previa de perfil.');board.tabIndex=0;
  const canvas=element('div','','draw-canvas');board.append(canvas);
  const links=[];
  const slotNode=(slot,matchId,index)=>{
    const row=element('div','','draw-player');
    row.dataset.slot=String(index);
    if(!slot) {row.append(element('span','Descanso / pase libre'));return row;}
    const player=slot.playerId?players.get(slot.playerId):slot.name?slot:null;
    if(player) {
      row.append(profilePreview.button(player.id,player.name));
      if(t.winnerProfileId===player.id) { row.dataset.winner='true'; row.append(element('strong','Ganador','winner-tag')); }
    }
    else {row.append(element('span',(slot.outcome==='loser'?'Perdedor de ':'Ganador de ')+slot.source,'draw-placeholder'));links.push({source:slot.source,target:matchId,slot:index,outcome:slot.outcome});}
    return row;
  };
  draw.rounds.forEach(round=>{
    const column=element('section','','draw-round');
    column.append(element('p',round.group,'eyebrow'),element('h3',round.name));
    const matches=element('div','','round-matches');column.append(matches);
    round.matches.forEach(match=>{
      const card=element('article','','draw-match');
      card.dataset.matchId=match.id;card.setAttribute('aria-label','Encuentro '+match.id);
      card.append(element('small',match.id));
      if(match.entrants) match.entrants.forEach((player,index)=>card.append(slotNode(player,match.id,index)));
      else {card.append(slotNode(match.left,match.id,0),element('span','VS','draw-versus'),slotNode(match.right,match.id,1));}
      matches.append(card);
    });canvas.append(column);
  });
  section.append(element('p','Sorteo aleatorio guardado. Mantené el cursor sobre un nombre para ver su perfil, o tocá el nombre.'),board);
  drawCleanup=connectBracket(canvas,links);
  if(t.format==='SWISS')section.append(element('p','Se sorteó la primera ronda. Las siguientes requieren resultados y emparejamientos por puntaje, que todavía no están implementados.','tournament-notice'));
  if(t.format==='DOUBLE_ELIMINATION')section.append(element('p','Los casilleros de ganadores y perdedores se completarán al registrar resultados. El reinicio de la gran final depende de las reglas acordadas.'));
  return section;
}
// Sólo pinta el reloj. La autorización y la hora para decidir se comprueban en AWS.
function updateClock() {
  const timer=document.getElementById('tournamentCountdown');
  if(timer && currentTournament?.startsAt) timer.textContent=currentTournament.winnerProfileId ? 'Duelo finalizado' : countdownLabel(currentTournament.startsAt);
  const button=document.getElementById('recordDuelWinner');
  if(button && !button.dataset.saving) button.disabled=Date.now()<Date.parse(currentTournament.startsAt);
}
function schedulePanel(t) {
  const section=element('section','','tournament-panel tournament-schedule');
  section.append(element('h2','Cuándo se juega'),element('p',scheduleLabel(t.startsAt,t.timeZone)));
  if(t.startsAt) {
    const timer=element('p','','tournament-countdown');timer.id='tournamentCountdown';timer.setAttribute('role','timer');timer.setAttribute('aria-live','off');section.append(timer);
    const localZone=Intl.DateTimeFormat().resolvedOptions().timeZone;
    if(localZone && localZone!==t.timeZone) section.append(element('p','En tu zona: '+scheduleLabel(t.startsAt,localZone),'field-help'));
    section.append(element('small','El reloj usa la hora de tu dispositivo. Llegar al horario no inicia la partida ni confirma personas.','field-help'));
  }
  return section;
}
function resultPanel(t) {
  const section=element('section','','tournament-panel');section.append(element('h2','Resultado del duelo'));
  if(t.winnerProfileId) {
    section.append(element('p','🏆 '+t.winnerName,'duel-winner'),element('p','Decidido por '+(t.decidedByLabel || 'el árbitro acordado')+' · '+scheduleLabel(t.decidedAt,t.timeZone)),element('p','Resultado definitivo. No se puede cambiar desde esta pantalla.','field-help'));
    return section;
  }
  const noJudge=t.arbitrationMode==='ORGANIZER';
  const isJudge=(t.judgeIds || []).some(id=>{const owner=profiles.get(id)?.owner;return owner && (owner===currentUser?.username || owner===currentUser?.userId || owner.startsWith(currentUser?.userId+'::'));});
  const canDecide=noJudge ? currentUser?.userId===t.createdBySub : isJudge;
  section.append(element('p',noJudge ? 'El organizador registrará al ganador, incluso si también juega.' : 'Un juez designado registrará al ganador.'));
  if(!t.startsAt) {section.append(element('p','El registro de ganador se habilita en los nuevos duelos con fecha programada.','field-help'));return section;}
  if(t.status!=='READY' || !t.draw) {section.append(element('p','Primero deben confirmar todos los integrantes y generarse el cruce.','field-help'));return section;}
  if(!canDecide) return section;
  const form=element('form','','duel-result-form'),label=element('label','Quién ganó');
  const select=element('select');select.required=true;select.id='duelWinner';label.htmlFor=select.id;
  const empty=element('option','Elegí al ganador');empty.value='';select.append(empty);
  t.participantIds.forEach((id,index)=>{const option=element('option',t.participantNames[index]);option.value=id;select.append(option);});
  const button=element('button','Confirmar ganador','primary-button');button.id='recordDuelWinner';button.type='submit';
  const message=element('p','','field-help');message.setAttribute('role','status');
  form.append(label,select,element('p','Podrás confirmar después del horario de inicio. La decisión será definitiva.','field-help'),button,message);
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(button.disabled || !select.value)return;
    const name=t.participantNames[t.participantIds.indexOf(select.value)];
    if(!window.confirm('¿Confirmar a '+name+' como ganador? Esta decisión quedará registrada y no se podrá cambiar desde el sitio.'))return;
    button.disabled=true;button.dataset.saving='true';message.textContent='Guardando resultado…';
    try {const saved=await recordClubDuelResult(t.id,select.value);if(!saved?.winnerProfileId)throw new Error('AWS no confirmó el resultado. Actualizá para revisar su estado.');currentTournament=saved;renderTournament(saved);lastVersion=saved.updatedAt+String(saved.draw);}
    catch(error) {message.textContent=error.message;delete button.dataset.saving;updateClock();}
  });section.append(form);return section;
}
function renderTournament(t) {
  profilePreview?.dismiss();drawCleanup?.();drawCleanup=null;
  currentTournament=t;
  detail.replaceChildren();
  const status=states(t),format=formats.find(f=>f.id===t.format);
  const label=t.winnerProfileId?'DUELO FINALIZADO':t.draw?'TODOS CONFIRMADOS · SORTEO GUARDADO':status.includes('REJECTED')?'INVITACIÓN RECHAZADA · SORTEO DETENIDO':t.rosterStatuses?'SALA DE ESPERA':'TORNEO ANTERIOR · EN PREPARACIÓN';
  detail.append(element('p',label,'eyebrow'),element('h1',t.name),element('p',t.activity));
  if(t.paymentMode==='TEST')detail.append(element('p','TORNEO DE PRUEBA · no corresponde a un cobro real','tournament-notice'));
  if(t.creationPaymentStatus==='REVERSED')detail.append(element('p','El pago de creación fue revertido. Contactá al administrador.','tournament-notice'));
  const arbitration=element('section','','tournament-notice arbitration-warning');
  arbitration.append(element('strong',t.arbitrationMode==='ORGANIZER' ? 'Sin juez · Decide el organizador' : 'Con juez · Decide un juez designado'));
  if(t.arbitrationMode==='ORGANIZER')arbitration.append(element('p','El organizador decide el resultado final, incluso si también participa.'),element('p','La condición se acepta explícitamente al unirse.'));
  const canEditPrize=t.arbitrationMode==='ORGANIZER' ? currentUser?.userId===t.createdBySub : (t.judgeIds || []).some((id,index)=>profiles.get(id)?.owner?.split('::')[0]===currentUser?.userId && (!t.rosterStatuses || t.rosterStatuses[t.participantIds.length+index]==='ACCEPTED'));
  detail.append(prizePanel(t,{canEdit:canEditPrize,onSaved:saved=>{renderTournament(saved);lastVersion=saved.updatedAt+String(saved.draw);}}),arbitration,schedulePanel(t));
  const info=element('section','','tournament-panel');info.append(element('h2',format?.name || t.format));
  if(format && !t.draw){const image=element('div','','format-preview');image.innerHTML=formatImage(format.id);image.append(element('p',format.description));info.append(image);}
  const rules=element('p',t.description || 'El organizador todavía no agregó reglas.');rules.style.whiteSpace='pre-wrap';info.append(rules);detail.append(info);
  if(t.draw) detail.append(drawBoard(t));
  else if(t.rosterStatuses) detail.append(element('p',status.includes('REJECTED')?'Una persona rechazó. El torneo no se sortea: por ahora es necesario crear otro con los integrantes que acepten.':'Esperando que todos los participantes, jueces y tesorero elegido confirmen. Los cruces se sortearán automáticamente después de la última aceptación.','tournament-notice'));
  else detail.append(element('p','Este torneo se creó antes del sistema de invitaciones; conserva sus integrantes históricos. El sorteo automático se aplica a los nuevos torneos.','tournament-notice'));
  const p=t.participantIds.length,j=p+t.judgeIds.length;
  detail.append(roster('Participantes',t.participantIds,t.participantNames,status.slice(0,p)),roster('Jueces',t.judgeIds,t.judgeNames,status.slice(p,j)),roster('Tesorero',t.treasurerId?[t.treasurerId]:[],t.treasurerName?[t.treasurerName]:[],status.slice(j)));
  const refresh=element('button','Actualizar confirmaciones','format-choice');refresh.type='button';refresh.addEventListener('click',()=>void refreshTournament(true));

  if(t.format==='DUEL')detail.append(resultPanel(t));
  detail.append(sharePanel(t),refresh,element('p','El registro de ganador está disponible en Duelo 1v1. La gestión del dinero y los resultados de otros formatos siguen pendientes.','field-help'));
  if(isClubAdmin || currentUser?.userId===t.createdBySub) {
    const remove=element('button','Eliminar torneo','danger-button');remove.type='button';
    remove.addEventListener('click',async()=>{
      if(!window.confirm('¿Eliminar «'+t.name+'»? Se ocultará y quedará bloqueado para todos. No se devuelve el pago de creación.'))return;
      remove.disabled=true;
      try{await deleteTournament(t.id);location.href='/torneos.html';}
      catch(error){remove.disabled=false;notice.hidden=false;notice.textContent=error.message;}
    });detail.append(remove);
  }
  updateClock();
}
async function refreshTournament(force=false) {
  if(refreshing || document.hidden)return;refreshing=true;
  try {
    const id=new URLSearchParams(location.search).get('id');if(!id)throw new Error('El enlace no incluye un torneo.');
    let t=await getClubTournament(id);if(!t){profilePreview?.lock();drawCleanup?.();detail.replaceChildren();currentTournament=null;throw new Error('Este torneo fue eliminado o ya no está disponible.');}
    if (!t.draw && t.rosterStatuses?.length && t.rosterStatuses.every(state=>state==='ACCEPTED') && (await getCurrentUser()).userId===t.createdBySub) t=await ensureClubTournamentDraw(id) || t;
    const version=t.updatedAt+String(t.draw);
    if((force || version!==lastVersion) && !detail.querySelector('[data-prize-editing="true"]')){renderTournament(t);lastVersion=version;}
    notice.hidden=true;
  }catch(error){notice.hidden=false;notice.textContent=error.message;notice.dataset.error='true';}
  finally{refreshing=false;}
}
try {
  if(detail) {
    if(!await configureAmplify())throw new Error('No pudimos conectar con AWS. Recargá para intentar de nuevo.');
    currentUser=await getCurrentUser();
    isClubAdmin=Boolean((await initializeAccess()).isCreator);
    // Las dos lecturas son independientes: se preparan en paralelo.
    await Promise.all([loadBadges().catch(()=>{}),registeredProfiles({includeBio:true}).then(items=>{profiles=new Map(items.map(profile=>[profile.id,profile]));}).catch(()=>{})]);
    profilePreview.setProfiles(profiles);
    await refreshTournament();
    setInterval(updateClock,1000);
    setInterval(()=>void refreshTournament(),15000);
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)void refreshTournament();});
    window.addEventListener('proveit:invitation-updated',()=>void refreshTournament(true));
  } else {
    const tournaments=await listClubTournaments();
    try {for(const payment of await myPendingPayments()) {
      const card=element('a','','tournament-panel tournament-card');card.href='/pago.html?id='+encodeURIComponent(payment.id);
      card.append(element('small','TU SOLICITUD · PENDIENTE DE PAGO'),element('h2',payment.tournamentName),element('p',money(payment.amountCents)+(payment.paymentMode==='TEST'?' · prueba':'')));list.append(card);
    }} catch { /* Los torneos publicados siguen visibles si falla la lista privada. */ }
    if(!tournaments.length)list.append(element('p','Todavía no hay torneos. Creá el primer desafío.','tournament-empty'));
    tournaments.forEach(t=>{
      const card=element('a','','tournament-panel tournament-card');card.href='/torneo.html?id='+encodeURIComponent(t.id);
      card.append(element('small',(formats.find(f=>f.id===t.format)?.name || t.format)+' · '+(t.winnerProfileId?'FINALIZADO':t.draw?'CRUCES LISTOS':'EN PREPARACIÓN')),element('h2',t.name),element('p',t.activity+' · '+states(t).slice(0,t.participantIds.length).filter(s=>s==='ACCEPTED').length+' participantes confirmados'),element('p',scheduleLabel(t.startsAt,t.timeZone),'field-help'),element('small',t.arbitrationMode==='ORGANIZER'?'Sin juez · decide el organizador':'Con juez'));list.append(card);
    });notice.hidden=true;
  }
}catch(error){notice.hidden=false;notice.dataset.error='true';notice.textContent=error.name==='UserUnAuthenticatedException'?'Ingresá con tu cuenta para consultar los torneos.':error.message;}

finally { window.proveitLoadingDone?.('page'); }
