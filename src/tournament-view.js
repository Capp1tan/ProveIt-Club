import { loadBadges, badgeElements } from './badges.js';
// Sala de espera y cuadro: las confirmaciones y el sorteo provienen de AWS.
import { formats, formatImage } from './tournament-formats.js';
import { avatarUrl, getCurrentUser } from './auth-client.js';
import { listClubTournaments, getClubTournament, registeredProfiles, ensureClubTournamentDraw } from './tournaments-api.js';
const notice=document.getElementById('tournamentsNotice'),detail=document.getElementById('tournamentDetail'),list=document.getElementById('tournamentsList');
const element=(tag,text,className)=>{const node=document.createElement(tag);node.textContent=text;if(className)node.className=className;return node;};
const stateNames={PENDING:'Esperando confirmación',ACCEPTED:'Confirmado',REJECTED:'Invitación rechazada'};
let profiles=new Map(),lastVersion='',refreshing=false;
const photoRequests=new Map();
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
    row.append(avatar(ids[i],name),element('strong',name),badgeElements(profiles.get(ids[i])?.owner?.split('::')[0]),element('span',stateNames[state] || 'Pendiente','waiting-state'));rows.append(row);
  });
  if(!names.length) rows.append(element('li','Sin tesorero'));
  section.append(rows);return section;
}
function drawBoard(t) {
  const section=element('section','','tournament-panel');
  section.append(element('h2','Cruces sorteados'));
  let draw;
  try {draw=JSON.parse(t.draw);} catch {section.append(element('p','No pudimos leer el sorteo guardado. Actualizá para reintentar.'));return section;}
  const players=new Map(draw.order.map(player=>[player.id,player]));
  const board=element('div','','draw-board');
  const slotNode=slot=>{
    const row=element('div','','draw-player');
    if(!slot) {row.append(element('span','Descanso / pase libre'));return row;}
    const player=slot.playerId?players.get(slot.playerId):slot.name?slot:null;
    if(player) row.append(avatar(player.id,player.name),element('span',player.name),badgeElements(profiles.get(player.id)?.owner?.split('::')[0]));
    else row.append(element('span',(slot.outcome==='loser'?'Perdedor de ':'Ganador de ')+slot.source));
    return row;
  };
  draw.rounds.forEach(round=>{
    const column=element('section','','draw-round');
    column.append(element('p',round.group,'eyebrow'),element('h3',round.name));
    round.matches.forEach(match=>{
      const card=element('article','','draw-match');
      card.append(element('small',match.id));
      if(match.entrants) match.entrants.forEach(player=>card.append(slotNode(player)));
      else {card.append(slotNode(match.left),element('span','VS','draw-versus'),slotNode(match.right));}
      column.append(card);
    });board.append(column);
  });
  section.append(element('p','Sorteo aleatorio guardado: recargar no cambia los cruces.'),board);
  if(t.format==='SWISS')section.append(element('p','Se sorteó la primera ronda. Las siguientes requieren resultados y emparejamientos por puntaje, que todavía no están implementados.','tournament-notice'));
  if(t.format==='DOUBLE_ELIMINATION')section.append(element('p','Los casilleros de ganadores y perdedores se completarán al registrar resultados. El reinicio de la gran final depende de las reglas acordadas.'));
  return section;
}
function renderTournament(t) {
  detail.replaceChildren();
  const status=states(t),format=formats.find(f=>f.id===t.format);
  const label=t.draw?'TODOS CONFIRMADOS · SORTEO GUARDADO':status.includes('REJECTED')?'INVITACIÓN RECHAZADA · SORTEO DETENIDO':t.rosterStatuses?'SALA DE ESPERA':'TORNEO ANTERIOR · EN PREPARACIÓN';
  detail.append(element('p',label,'eyebrow'),element('h1',t.name),element('p',t.activity));
  const info=element('section','','tournament-panel');info.append(element('h2',format?.name || t.format));
  if(format && !t.draw){const image=element('div','','format-preview');image.innerHTML=formatImage(format.id);image.append(element('p',format.description));info.append(image);}
  const rules=element('p',t.description || 'El organizador todavía no agregó reglas.');rules.style.whiteSpace='pre-wrap';info.append(rules);detail.append(info);
  if(t.draw) detail.append(drawBoard(t));
  else if(t.rosterStatuses) detail.append(element('p',status.includes('REJECTED')?'Una persona rechazó. El torneo no se sortea: por ahora es necesario crear otro con los integrantes que acepten.':'Esperando que todos los participantes, jueces y tesorero elegido confirmen. Los cruces se sortearán automáticamente después de la última aceptación.','tournament-notice'));
  else detail.append(element('p','Este torneo se creó antes del sistema de invitaciones; conserva sus integrantes históricos. El sorteo automático se aplica a los nuevos torneos.','tournament-notice'));
  const p=t.participantIds.length,j=p+t.judgeIds.length;
  detail.append(roster('Participantes',t.participantIds,t.participantNames,status.slice(0,p)),roster('Jueces',t.judgeIds,t.judgeNames,status.slice(p,j)),roster('Tesorero',t.treasurerId?[t.treasurerId]:[],t.treasurerName?[t.treasurerName]:[],status.slice(j)));
  const refresh=element('button','Actualizar confirmaciones','format-choice');refresh.type='button';refresh.addEventListener('click',()=>void refreshTournament(true));
  const copy=element('button','Copiar enlace','primary-button');copy.type='button';copy.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(location.href);copy.textContent='Enlace copiado';}catch{notice.textContent='Copiá la dirección desde la barra del navegador.';notice.hidden=false;}});
  detail.append(refresh,copy,element('p','La carga de resultados y la gestión del dinero todavía no están disponibles.','field-help'));
}
async function refreshTournament(force=false) {
  if(refreshing || document.hidden)return;refreshing=true;
  try {
    const id=new URLSearchParams(location.search).get('id');if(!id)throw new Error('El enlace no incluye un torneo.');
    let t=await getClubTournament(id);if(!t)throw new Error('No encontramos ese torneo.');
    if (!t.draw && t.rosterStatuses?.length && t.rosterStatuses.every(state=>state==='ACCEPTED') && (await getCurrentUser()).userId===t.createdBySub) t=await ensureClubTournamentDraw(id) || t;
    const version=t.updatedAt+String(t.draw);
    if(force || version!==lastVersion){renderTournament(t);lastVersion=version;}
    notice.hidden=true;
  }catch(error){notice.hidden=false;notice.textContent=error.message;notice.dataset.error='true';}
  finally{refreshing=false;}
}
try {
  if(detail) {
    try {await loadBadges();profiles=new Map((await registeredProfiles()).map(profile=>[profile.id,profile]));}catch{}
    await refreshTournament();
    setInterval(()=>void refreshTournament(),15000);
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)void refreshTournament();});
    window.addEventListener('proveit:invitation-updated',()=>void refreshTournament(true));
  } else {
    const tournaments=await listClubTournaments();
    if(!tournaments.length)list.append(element('p','Todavía no hay torneos. Creá el primer desafío.','tournament-empty'));
    tournaments.forEach(t=>{
      const card=element('a','','tournament-panel tournament-card');card.href='/torneo.html?id='+encodeURIComponent(t.id);
      card.append(element('small',(formats.find(f=>f.id===t.format)?.name || t.format)+' · '+(t.draw?'CRUCES LISTOS':'EN PREPARACIÓN')),element('h2',t.name),element('p',t.activity+' · '+states(t).slice(0,t.participantIds.length).filter(s=>s==='ACCEPTED').length+' participantes confirmados'));list.append(card);
    });notice.hidden=true;
  }
}catch(error){notice.hidden=false;notice.dataset.error='true';notice.textContent=error.name==='UserUnAuthenticatedException'?'Ingresá con tu cuenta para consultar los torneos.':error.message;}
