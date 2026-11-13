import {renderTournamentPreview} from './tournament-preview.js';
import {usesCompetition,competitionStart} from '../shared/competition.ts';
import {attendancePanel,drawAudit,animateDraw,updateDrawCountdown} from './tournament-competition.js';
import {tournamentIsLive} from '../shared/tournament-room.ts';
import {roomDeadline,roomIsClosed,validatePodium,allEntriesPaid} from '../shared/tournament-room.ts';
import { createRealLobby } from './tournament-real-lobby.js';
import {judgePanel,judgeComments} from './judge-ui.js';
import { tournamentCoverUrl } from './tournament-cover.js';
import { mountChat } from './chat-ui.js';
import { prizePanel } from './tournament-prize.js';
import { myPendingPayments, money } from './billing-api.js';
import { loadBadges, badgeElements, decorateAvatar, initializeAccess } from './badges.js';
import { deleteTournament } from './maintenance-api.js';
import { ProfilePreview } from './profile-preview.js';
import { connectBracket } from './bracket-lines.js';
import { Hub } from 'aws-amplify/utils';
import { scheduleLabel } from './tournament-schedule.js';
// Sala de espera y cuadro: las confirmaciones y el sorteo provienen de AWS.
import { formats, formatImage } from './tournament-formats.js';
import { avatarUrl, getCurrentUser, configureAmplify } from './auth-client.js';
import { listClubTournaments, getClubTournament, registeredProfiles, ensureClubTournamentDraw, recordClubDuelResult, watchTournamentLobby } from './tournaments-api.js';
const notice=document.getElementById('tournamentsNotice'),detail=document.getElementById('tournamentDetail'),list=document.getElementById('tournamentsList');
const element=(tag,text,className)=>{const node=document.createElement(tag);node.textContent=text;if(className)node.className=className;return node;};
let profiles=new Map(),lastVersion='',refreshing=false,currentUser=null,currentTournament=null;
let drawCleanup;let serverOffset=0;
const roomNow=()=>Date.now()+serverOffset;
let lobbySubscription,lobbyRetry,refreshQueued=false,lobbyConnected=false,lobbyStopped=false;
const coverRequests=new Map();
function updateLobbyConnection(){const label=document.getElementById('lobbyConnection');if(label){label.textContent=lobbyConnected?'Confirmaciones en vivo':'Actualización automática · reconectando';label.classList.toggle('lobby-reconnect',!lobbyConnected);}}
async function connectLobby(){
 if(lobbyStopped || lobbySubscription || document.hidden || !detail)return;
 try{lobbySubscription=await watchTournamentLobby(new URLSearchParams(location.search).get('id'),()=>void refreshTournament(true),()=>{
  lobbySubscription?.unsubscribe();lobbySubscription=null;lobbyConnected=false;updateLobbyConnection();clearTimeout(lobbyRetry);lobbyRetry=setTimeout(()=>void connectLobby(),15000);
 });}catch{clearTimeout(lobbyRetry);lobbyRetry=setTimeout(()=>void connectLobby(),15000);}
}
Hub.listen('api',({payload})=>{if(payload.event==='ConnectionStateChange'){lobbyConnected=payload.data?.connectionState==='Connected';updateLobbyConnection();if(lobbyConnected && detail)void refreshTournament();}});
let chatCleanup, chatId;
function closeTournamentChat(){chatCleanup?.();chatCleanup=null;chatId=null;const root=document.getElementById('tournamentChat');if(root){root.replaceChildren();root.hidden=true;}}
let isClubAdmin=false;
const photoRequests=new Map();
const profilePreview=detail ? new ProfilePreview({avatar,badges:badgeElements}) : null;
const realLobby=detail ? createRealLobby({profilePreview,getUser:()=>currentUser,getConnection:()=>lobbyConnected,getNow:roomNow,onChanged:()=>refreshTournament(true)}) : null;
Hub.listen('auth',({payload})=>{if(payload.event==='signedOut'){profilePreview?.lock();closeTournamentChat();lobbyStopped=true;clearTimeout(lobbyRetry);lobbySubscription?.unsubscribe();lobbySubscription=null;realLobby?.destroy();}});
function avatar(id,name) {
  const node=element('span',Array.from(name.trim())[0]?.toUpperCase() || '?','person-avatar');
  node.setAttribute('aria-hidden','true');
  decorateAvatar(node, profiles.get(id)?.owner?.split('::')[0]);
  const path=profiles.get(id)?.avatarPath;
  if(/^(profile-pictures|profile-private)\//.test(path || '')) {
    if(!photoRequests.has(path)) photoRequests.set(path,avatarUrl(path,{profileId:id}).catch(()=>''));
    void photoRequests.get(path).then(url=>{if(!url)return;const img=document.createElement('img');img.alt='';img.loading='lazy';img.src=url;img.addEventListener('error',()=>{node.textContent=Array.from(name)[0] || '?';},{once:true});node.replaceChildren(img);});
  }
  return node;
}
function states(t) {return t.rosterStatuses || Array(t.participantIds.length+t.judgeIds.length+(t.treasurerId?1:0)).fill('ACCEPTED');}
function drawBoard(t) {
  const section=element('section','','tournament-panel'); section.id='tournamentDraw';
  section.append(element('h2','Cruces sorteados'));
  const selection=element('p','Seleccioná un encuentro para ver sus cruces.','draw-selection');
  selection.setAttribute('role','status');
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
    if(!slot) {row.dataset.playerLabel='Pase libre';row.append(element('span','Descanso / pase libre'));return row;}
    const player=slot.playerId?players.get(slot.playerId):slot.name?slot:null;
    if(player) {
      row.dataset.playerLabel=player.name;
      row.append(profilePreview.button(player.id,player.name));
      if(profiles.get(player.id)?.owner?.split('::')[0]===currentUser?.userId)row.append(element('small','Vos','draw-self'));
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
      const inspect=element('button','Ver encuentro '+match.id,'draw-inspect');
      inspect.type='button';
      inspect.setAttribute('aria-pressed','false');
      inspect.addEventListener('click',()=>{
        canvas.querySelector('[aria-pressed="true"]')?.setAttribute('aria-pressed','false');
        inspect.setAttribute('aria-pressed','true');
        const names=[...card.querySelectorAll('.draw-player')].map(row=>row.dataset.playerLabel || row.textContent.trim()).filter(Boolean);
        selection.textContent=round.name+' · '+names.join(' vs ');
      });
      card.append(inspect);
      if(match.entrants) match.entrants.forEach((player,index)=>card.append(slotNode(player,match.id,index)));
      else {card.append(slotNode(match.left,match.id,0),element('span','VS','draw-versus'),slotNode(match.right,match.id,1));}
      matches.append(card);
    });canvas.append(column);
  });
  section.append(board,selection);
  drawCleanup=connectBracket(canvas,links);
  if(t.format==='SWISS')section.append(element('p','Se sorteó la primera ronda. Las siguientes requieren resultados y emparejamientos por puntaje, que todavía no están implementados.','tournament-notice'));
  if(t.format==='DOUBLE_ELIMINATION')section.append(element('p','Los casilleros de ganadores y perdedores se completarán al registrar resultados. El reinicio de la gran final depende de las reglas acordadas.'));
  return section;
}
// Sólo pinta el reloj. La autorización y la hora para decidir se comprueban en AWS.
function showClosedRoom(t){
 lobbyStopped=true;clearTimeout(lobbyRetry);lobbySubscription?.unsubscribe();lobbySubscription=null;closeTournamentChat();profilePreview?.lock();drawCleanup?.();drawCleanup=null;realLobby?.destroy();currentTournament=null;
 const card=element('section','','tournament-panel room-closed');card.append(element('h1','La sala está cerrada'),element('p',t.name || 'Torneo finalizado'),element('p','Pasaron los cinco minutos posteriores al resultado. La sala y el chat ya no están disponibles. Tu participación se conserva en el historial.'));
 const link=element('a','Ir a mi historial','primary-button');link.href='/perfil.html';card.append(link);detail.replaceChildren(card,judgeComments(t.id));notice.hidden=true;
}
function updateClock() {
  if(lobbyStopped)return;
  if(currentTournament && roomIsClosed(currentTournament,roomNow())){showClosedRoom(currentTournament);return;}
  realLobby?.clock();
  if(currentTournament)updateDrawCountdown(currentTournament,{sub:currentUser?.userId,profiles,onChanged:()=>refreshTournament(true),now:roomNow()});
  if(currentTournament){const action=detail.querySelector('[data-draw-schedule]');if(action && !action.closest('[data-competition-busy]'))action.disabled=tournamentIsLive(currentTournament,roomNow()) || roomNow()<Date.parse(currentTournament.startsAt);if(tournamentIsLive(currentTournament,roomNow()))detail.querySelectorAll('.competition-actions button,.competition-actions input,.competition-actions select').forEach(n=>n.disabled=true);}
  if(currentTournament && !currentTournament.winnerProfileId && !detail.querySelector('.tournament-decision') && tournamentIsLive(currentTournament,roomNow())){const decision=resultPanel(currentTournament);if(decision)detail.append(decision);}
  const button=document.getElementById('recordDuelWinner');
  if(button && !button.dataset.saving) button.disabled=!tournamentIsLive(currentTournament,roomNow());
}
function resultPanel(t) {
  const section=element('section','','tournament-panel');
  if(t.winnerProfileId) {
    section.append(element('h2','Resultado del torneo'));
    section.append(element('p','🏆 '+t.winnerName,'duel-winner'),element('p','Decidido por '+(t.decidedByLabel || 'el árbitro acordado')+' · '+scheduleLabel(t.decidedAt,t.timeZone)),element('p','Resultado definitivo. No se puede cambiar desde esta pantalla.','field-help'));
    for(const [id,label] of [[t.runnerUpProfileId,'2.º puesto'],[t.thirdPlaceProfileId,'3.º puesto']])if(id){const index=t.participantIds.indexOf(id);if(index>=0)section.append(element('p',label+' · '+t.participantNames[index]));}
    return section;
  }
  const noJudge=t.arbitrationMode==='ORGANIZER';
  const isJudge=(t.judgeIds || []).some(id=>{const owner=profiles.get(id)?.owner;return owner && (owner===currentUser?.username || owner===currentUser?.userId || owner.startsWith(currentUser?.userId+'::'));});
  const canDecide=noJudge ? currentUser?.userId===t.createdBySub : isJudge;
  if(!allEntriesPaid(t) || !canDecide || !t.draw || !tournamentIsLive(t,roomNow()))return null;
  const decision=element('details','','tournament-panel tournament-decision');decision.append(element('summary','Registrar decisión'));
  const form=element('form','','duel-result-form'),label=element('label','Quién ganó');
  const select=element('select');select.required=true;select.id='duelWinner';label.htmlFor=select.id;
  const empty=element('option','Elegí al ganador');empty.value='';select.append(empty);
  t.participantIds.forEach((id,index)=>{const option=element('option',t.participantNames[index]);option.value=id;select.append(option);});
  const podiumFields=element('div','','duel-podium-fields'),second=element('select'),third=element('select');
  if(t.participantIds.length>2){
    for(const [field,text] of [[second,'Segundo puesto (opcional)'],[third,'Tercer puesto (opcional)']]){const fieldLabel=element('label',text),none=element('option','Sin definir');none.value='';field.append(none);t.participantIds.forEach((id,i)=>{const o=element('option',t.participantNames[i]);o.value=id;field.append(o);});fieldLabel.append(field);podiumFields.append(fieldLabel);}
  }
  const button=element('button','Confirmar resultado','primary-button');button.id='recordDuelWinner';button.type='submit';
  const message=element('p','','field-help');message.setAttribute('role','status');
  const kind=element('select'),reason=element('textarea'),kindLabel=element('label','Tipo de decisión'),reasonLabel=element('label','Motivo de la decisión');
  for(const [v,n] of [['NORMAL','Resultado normal'],['DISPUTED','Resultado discutido'],['SANCTION','Sanción']]){const o=element('option',n);o.value=v;kind.append(o);}reason.maxLength=500;reason.rows=3;reason.placeholder='Obligatorio si hubo discusión o sanción';kind.addEventListener('change',()=>{reason.required=kind.value!=='NORMAL';reason.minLength=kind.value!=='NORMAL'?10:0;});kindLabel.append(kind);reasonLabel.append(reason);
  form.append(kindLabel,reasonLabel,label,select,podiumFields,element('p','Podrás confirmar después del horario de inicio. La decisión será definitiva.','field-help'),button,message);
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(button.disabled || !select.value)return;
    const name=t.participantNames[t.participantIds.indexOf(select.value)];
    try{validatePodium(t.participantIds,select.value,second.value,third.value);}catch(error){message.textContent=error.message;return;}
    const podiumCopy=[[second.value,'2.º'],[third.value,'3.º']].filter(([id])=>id).map(([id,label])=>label+': '+t.participantNames[t.participantIds.indexOf(id)]).join(' · ');
    if(!window.confirm('¿Confirmar a '+name+' como ganador? '+(podiumCopy?podiumCopy+'. ':'')+'Esta decisión quedará registrada y no se podrá cambiar desde el sitio.'))return;
    button.disabled=true;button.dataset.saving='true';message.textContent='Guardando resultado…';
    try {const saved=await recordClubDuelResult(t.id,select.value,reason.value,kind.value,second.value || null,third.value || null);if(!saved?.winnerProfileId)throw new Error('AWS no confirmó el resultado. Actualizá para revisar su estado.');currentTournament=saved;renderTournament(saved);lastVersion=saved.updatedAt+String(saved.draw);}
    catch(error) {message.textContent=error.message;delete button.dataset.saving;updateClock();}
  });decision.append(form);return decision;
}
function renderTournament(t) {
  profilePreview?.dismiss();drawCleanup?.();drawCleanup=null;
  if(t.roomClosed || roomIsClosed(t,roomNow())){showClosedRoom(t);return;}
  currentTournament=t;
  const chatRoot=document.getElementById('tournamentChat');
  if(chatRoot && chatId!==t.id){closeTournamentChat();chatRoot.hidden=false;chatId=t.id;chatCleanup=mountChat(chatRoot,{roomType:'TOURNAMENT',roomId:t.id});}
  detail.replaceChildren();
  const status=states(t),format=formats.find(f=>f.id===t.format);
  const label=t.winnerProfileId?'TORNEO FINALIZADO':t.draw && t.status==='READY'?'TODOS CONFIRMADOS · SORTEO GUARDADO':status.includes('REJECTED')?'INVITACIÓN RECHAZADA · SORTEO DETENIDO':t.rosterStatuses?'SALA DE ESPERA':'TORNEO ANTERIOR · EN PREPARACIÓN';
  const hero=element('header','','tournament-cover'),heroContent=element('div','','tournament-cover-content');
  heroContent.append(element('p',label,'eyebrow'),element('h1',t.name),element('p',t.activity));hero.append(heroContent);
  if(t.coverPath){
   if(!coverRequests.has(t.coverPath) || coverRequests.get(t.coverPath).expires<Date.now())coverRequests.set(t.coverPath,{expires:Date.now()+90000,promise:tournamentCoverUrl(t.id).catch(()=>{coverRequests.delete(t.coverPath);return '';})});
   void coverRequests.get(t.coverPath).promise.then(url=>{if(!url || !hero.isConnected)return;const image=document.createElement('img');image.alt='Portada de '+t.name;image.src=url;hero.prepend(image);});
  }
  const savedDraw=Boolean(t.draw && (usesCompetition(t) || t.status==='READY' || t.status==='COMPLETED'));
  const ready=Boolean(t.rosterStatuses?.length && t.rosterStatuses.every(value=>value==='ACCEPTED') &&
    allEntriesPaid(t) && t.creationPaymentStatus!=='REVERSED');
  const bracketFocus=ready && (savedDraw || usesCompetition(t));
  const lobby=realLobby.render(t,{bracketFocus});
  const controls=attendancePanel(t,{sub:currentUser?.userId,profiles,onChanged:()=>refreshTournament(true),now:roomNow()});
  if(bracketFocus){
    const stage=element('section','','tournament-bracket-stage');
    const heading=element('header','','bracket-stage-heading');
    heading.append(element('h1',t.name),element('p',[t.activity,format?.name].filter(Boolean).join(' · ')));
    stage.append(heading);
    if(!savedDraw && controls)stage.append(controls);
    if(savedDraw){
      const board=drawBoard(t);
      stage.append(board);
      detail.append(stage);
      animateDraw(t,board);
    }else{
      const preview=element('div','','bracket-stage-preview');
      preview.append(element('h2','Llave por sortear'));
      if(format && t.participantIds.length>=2){
        const model=element('div');
        renderTournamentPreview(model,{format:t.format,count:t.participantIds.length,awaitingDraw:true});
        preview.append(model);
      }
      stage.append(preview);
      detail.append(stage);
    }
    if(lobby.childElementCount)detail.append(lobby);
    if(savedDraw && controls)detail.append(controls);
  }else{
    detail.append(lobby);
    if(controls)detail.append(controls);
  }
  updateLobbyConnection();
  if(t.paymentMode==='TEST')detail.append(element('p','TORNEO DE PRUEBA · no corresponde a un cobro real','tournament-notice'));
  if(t.creationPaymentStatus==='REVERSED')detail.append(element('p','El pago de creación fue revertido. Contactá al administrador.','tournament-notice'));
  const canEditPrize=t.arbitrationMode==='ORGANIZER' ? currentUser?.userId===t.createdBySub : (t.judgeIds || []).some((id,index)=>Boolean(profiles.get(id)?.owner && (profiles.get(id).owner===currentUser?.username || profiles.get(id).owner===currentUser?.userId || profiles.get(id).owner.startsWith(currentUser?.userId+'::'))) && (!t.rosterStatuses || t.rosterStatuses[t.participantIds.length+index]==='ACCEPTED'));
  if(t.overview)heroContent.append(element('p',t.overview,'lobby-overview'));
  if(t.prizeTitle || t.prizeExpected===true)detail.append(prizePanel(t,{canEdit:canEditPrize,onSaved:saved=>{renderTournament(saved);lastVersion=saved.updatedAt+String(saved.draw);}}));
  const info=element('details','','tournament-panel');info.append(element('summary','Reglas, formato y condiciones'),element('h2',format?.name || t.format));
  if(format && !t.draw){const image=element('div','','format-preview');image.innerHTML=formatImage(format.id);image.append(element('p',format.description));info.append(image);}
  const rules=element('p',t.description || 'El organizador todavía no agregó reglas.');rules.style.whiteSpace='pre-wrap';info.append(rules);if(t.overview)info.append(element('p',t.overview));if(t.coverPath)info.append(hero);detail.append(info);
  if(savedDraw){
    if(!bracketFocus){const board=drawBoard(t);detail.append(board);animateDraw(t,board);}
    const audit=drawAudit(t);if(audit)detail.append(audit);
  }else if(!bracketFocus && status.includes('REJECTED')){
    detail.append(element('p','Una persona rechazó la invitación. El sorteo quedó detenido.','tournament-notice'));
  }
  const outcome=resultPanel(t);if(outcome)detail.append(outcome);
  if(t.judgeIds?.length || currentUser?.userId===t.createdBySub){
    if(t.status==='COMPLETED')detail.append(judgeComments(t.id));
    const conditions=element('details','','tournament-panel');conditions.append(element('summary',t.judgeIds?.length?'Condiciones y jueces':'Administrar condiciones'),judgePanel(t,{canEditRules:currentUser?.userId===t.createdBySub || (t.judgeIds || []).some((id,index)=>profiles.get(id)?.owner?.split('::')[0]===currentUser?.userId && t.rosterStatuses?.[t.participantIds.length+index]==='ACCEPTED'),onChanged:()=>refreshTournament(true)}));detail.append(conditions);
  }
  if(isClubAdmin || currentUser?.userId===t.createdBySub) {
    const remove=element('button','Eliminar torneo','danger-button');remove.type='button';
    remove.addEventListener('click',async()=>{
      remove.disabled=true;
      try{if(await deleteTournament(t.id,{name:t.name}))location.href='/torneos.html';else remove.disabled=false;}
      catch(error){remove.disabled=false;notice.hidden=false;notice.textContent=error.message;}
    });detail.append(remove);
  }
  updateClock();
}
async function refreshTournament(force=false) {
  if(!detail || document.hidden || lobbyStopped)return;if(refreshing){refreshQueued=true;return;}refreshing=true;
  try {
    const id=new URLSearchParams(location.search).get('id');if(!id)throw new Error('El enlace no incluye un torneo.');
    let t=await getClubTournament(id);if(!t){closeTournamentChat();profilePreview?.lock();drawCleanup?.();detail.replaceChildren();currentTournament=null;throw new Error('Este torneo fue eliminado o ya no está disponible.');}
    if(Number.isFinite(t.serverNow))serverOffset=t.serverNow-Date.now();
    if(t.roomClosed || roomIsClosed(t,roomNow())){showClosedRoom(t);return;}
    if (!usesCompetition(t) && !t.draw && t.rosterStatuses?.length && t.rosterStatuses.every(state=>state==='ACCEPTED') && (await getCurrentUser()).userId===t.createdBySub) t=await ensureClubTournamentDraw(id) || t;
    const version=t.updatedAt+String(t.draw);
    if((force || version!==lastVersion) && (t.winnerProfileId || (!detail.querySelector('[data-prize-editing="true"]') && !detail.querySelector('.community-form:focus-within,.duel-result-form:focus-within')))){renderTournament(t);lastVersion=version;}
    notice.hidden=true;
  }catch(error){notice.hidden=false;notice.textContent=error.message;notice.dataset.error='true';}
  finally{refreshing=false;if(refreshQueued){refreshQueued=false;setTimeout(()=>void refreshTournament(),200);}}
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
    if(!lobbyStopped)void connectLobby();
    setInterval(updateClock,1000);
    // Señal WebSocket inmediata; relectura de respaldo para cambios desde clientes anteriores.
    setInterval(()=>void refreshTournament(),30000);
    document.addEventListener('visibilitychange',()=>{if(!document.hidden){updateClock();if(!lobbyStopped){void connectLobby();void refreshTournament();}}});
    window.addEventListener('proveit:invitation-updated',()=>void refreshTournament(true));
  } else {
    const tournaments=await listClubTournaments();
    try {for(const payment of await myPendingPayments()) {
      const card=element('a','','tournament-panel tournament-card');card.href='/pago.html?id='+encodeURIComponent(payment.id);
      card.append(element('small','TU INSCRIPCIÓN · PENDIENTE DE PAGO'),element('h2',payment.tournamentName),element('p',money(payment.amountCents)+(payment.paymentMode==='TEST'?' · prueba':'')));list.append(card);
    }} catch { /* Los torneos publicados siguen visibles si falla la lista privada. */ }
    if(!tournaments.length)list.append(element('p','Todavía no hay torneos. Creá el primer desafío.','tournament-empty'));
    tournaments.forEach(t=>{
      const card=element('a','','tournament-panel tournament-card');card.href='/torneo.html?id='+encodeURIComponent(t.id);
      card.append(element('small',(formats.find(f=>f.id===t.format)?.name || t.format)+' · '+(t.winnerProfileId?'FINALIZADO':t.draw?'CRUCES LISTOS':'EN PREPARACIÓN')),element('h2',t.name),element('p',t.activity+' · '+states(t).slice(0,t.participantIds.length).filter(s=>s==='ACCEPTED').length+' participantes confirmados'),element('p',scheduleLabel(t.startsAt,t.timeZone),'field-help'),element('small',t.arbitrationMode==='ORGANIZER'?'Sin juez · decide el organizador':'Con juez'));list.append(card);
    });notice.hidden=true;
  }
}catch(error){notice.hidden=false;notice.dataset.error='true';notice.textContent=error.name==='UserUnAuthenticatedException'?'Ingresá con tu cuenta para consultar los torneos.':error.message;}

finally { window.proveitLoadingDone?.('page'); }
