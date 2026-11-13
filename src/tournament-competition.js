import {competitionState,usesCompetition,competitionStart,pendingDrawApprovals,attendanceReady,scheduledDraw} from '../shared/competition.ts';
import {allEntriesPaid} from '../shared/tournament-room.ts';
import {tournamentCompetition} from './tournaments-api.js';
const drawAnnouncement = import.meta.glob('./audio/draw-announcement.mp3', {
 eager:true, import:'default', query:'?url'
})['./audio/draw-announcement.mp3'];
const el=(tag,text='',cls='')=>{const n=document.createElement(tag);n.textContent=text;n.className=cls;return n;};
export function attendancePanel(t,{sub,profiles,onChanged,now=Date.now()}){
 if(!usesCompetition(t) || t.winnerProfileId)return null;
 const s=competitionState(t),root=el('section','','competition-actions rl-card'),mine=t.participantIds.find(id=>profiles.get(id)?.owner?.split('::')[0]===sub),start=competitionStart(t);
 if(Number.isFinite(start) && now>=start)return null;
 const accepted=allEntriesPaid(t) && t.rosterStatuses?.every(v=>v==='ACCEPTED');
 if(!accepted){root.append(el('p','Esperando las confirmaciones y las inscripciones pendientes.'));return root;}
 const message=el('p','','field-help');message.setAttribute('role','status');
 async function act(action,values){root.dataset.competitionBusy='true';root.querySelectorAll('button').forEach(b=>b.disabled=true);message.textContent='Guardando…';try{await tournamentCompetition(t.id,action,values);document.activeElement?.blur();await onChanged();}catch(e){delete root.dataset.competitionBusy;message.textContent=e.message;root.querySelectorAll('button').forEach(b=>b.disabled=false);}}
 if(!t.draw){
  const ready=attendanceReady(t),due=scheduledDraw(t);
  if(Number.isFinite(due)){const seconds=Math.max(0,Math.ceil((due-now)/1000)),countdown=el('p','Se sortean en '+Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0'),'draw-countdown');countdown.dataset.drawCountdown='';countdown.setAttribute('role','timer');countdown.setAttribute('aria-live','off');root.append(el('h2','El sorteo está por comenzar'),countdown,el('p','Todos verán la misma llave.','field-help'));
   if((window.AudioContext || window.webkitAudioContext) && drumAudio?.state!=='running'){
    const enableVoice=el('button','Activar sonido del sorteo','format-choice');
    enableVoice.type='button';
    enableVoice.addEventListener('click',()=>{
     void unlockDrawAudio().then(()=>{if(drumAudio?.state==='running')enableVoice.remove();});
    });
    root.append(enableVoice);
   }
  }
  else if(ready){root.append(el('p','Todos listos. El organizador puede iniciar el sorteo público de los cruces.'));if(sub===t.createdBySub){const draw=el('button','Sortear participantes','primary-button');draw.type='button';draw.dataset.drawSchedule='';draw.disabled=now<Date.parse(t.startsAt);draw.addEventListener('click',()=>void act('DRAW_SCHEDULE',{}));root.append(draw,el('p','El sorteo se habilita a la hora programada y dura 30 segundos.','field-help'));}}
  else root.append(el('p','Cuando todos estén listos, el organizador podrá iniciar el sorteo de participantes.'));
 }

 const pending=pendingDrawApprovals(t,s);
 if(pending.length){root.append(el('p','La llave fue modificada. Inicio detenido hasta que los afectados acepten su nueva posición.','tournament-notice'));if(mine && pending.includes(mine)){const accept=el('button','Acepto la llave modificada','primary-button');accept.type='button';accept.addEventListener('click',()=>void act('ACCEPT_DRAW',{drawRevision:s.revision}));root.append(accept);}}
 if(t.draw && sub===t.createdBySub){
 const details=el('details'),summary=el('summary','Cambiar posiciones antes del inicio'),form=el('form','','community-form'),from=el('select'),to=el('select'),reason=el('input');
 for(const field of [from,to]){const none=el('option','Elegí un participante');none.value='';field.append(none);t.participantIds.forEach((id,i)=>{const o=el('option',t.participantNames[i]);o.value=id;field.append(o);});field.required=true;}
 for(const [label,field] of [['Primera posición',from],['Intercambiar con',to],['Motivo visible para todos',reason]]){const l=el('label',label);l.append(field);form.append(l);}reason.required=true;reason.minLength=5;reason.maxLength=250;
 const submit=el('button','Registrar intercambio','format-choice');submit.type='submit';form.append(submit);form.addEventListener('submit',e=>{e.preventDefault();if(from.value===to.value){message.textContent='Elegí dos personas distintas.';return;}if(!confirm('Este cambio quedará visible y detendrá el inicio hasta que los afectados acepten. ¿Continuar?'))return;void act('SWAP',{fromProfileId:from.value,toProfileId:to.value,reason:reason.value,drawRevision:s.revision});});details.append(summary,form);root.append(details);
 }
 root.append(message);return root;
}
export function drawAudit(t){
 if(!usesCompetition(t))return null;const s=competitionState(t);if(!s.originalDraw)return null;
 const root=el('details','','tournament-panel draw-audit');root.append(el('summary','Sorteo original y cambios de posiciones'));
 const names=Object.fromEntries(t.participantIds.map((id,i)=>[id,t.participantNames[i]]));
 const original=JSON.parse(s.originalDraw),list=el('ol');original.order.forEach(p=>list.append(el('li',p.name)));root.append(el('h3','Orden original del sorteo'),list);
 // Los encuentros originales muestran contra quién había tocado jugar.
 for(const round of original.rounds){for(const m of round.matches){const a=m.left?.playerId,b=m.right?.playerId;if(a || b)root.append(el('p',round.name+': '+(names[a] || 'Pase libre')+' vs '+(names[b] || 'Pase libre')));}}
 if(!s.changes?.length)root.append(el('p','El organizador no cambió ninguna posición.'));
 for(const change of s.changes || []){const card=el('article','','draw-change');card.append(el('strong',(names[change.from] || 'Participante')+' ↔ '+(names[change.to] || 'Participante')),el('p',change.reason),el('small',new Date(change.at).toLocaleString()+' · registrado por el organizador'));
 for(const id of Object.keys(change.before || {})){if(JSON.stringify(change.before[id])!==JSON.stringify(change.after?.[id])){const rivals=items=>(items || []).map(m=>names[m.rival] || (m.rivals || []).map(v=>names[v]).join(', ') || 'Pase libre').join(' / ');card.append(el('p',names[id]+': '+rivals(change.before[id])+' → '+rivals(change.after?.[id])));}}root.append(card);}
 return root;
}
let finishing=false,nextAttempt=0,attemptTournament='';
let drumAudio, announcementBuffer, announcementLoading;
let lastDrumSecond='';
async function unlockDrawAudio(){
 const AudioContext=window.AudioContext || window.webkitAudioContext;
 if(!AudioContext)return;
 try{
  drumAudio ||= new AudioContext();
  const resume=drumAudio.state==='running'?Promise.resolve():drumAudio.resume();
  if(drawAnnouncement)announcementLoading ||= fetch(drawAnnouncement)
   .then(response=>{
    if(!response.ok)throw new Error('Audio no disponible');
    return response.arrayBuffer();
   })
   .then(bytes=>drumAudio.decodeAudioData(bytes))
   .then(buffer=>{announcementBuffer=buffer;})
   .catch(()=>{announcementLoading=null;});
  await resume;
 }catch{}
}

function playDrawDrum(drawId,seconds){
 if(seconds<1 || seconds>10 || document.hidden || drumAudio?.state!=='running')return;
 const beat=drawId+':'+seconds;
 if(beat===lastDrumSecond)return;
 lastDrumSecond=beat;

 const now=drumAudio.currentTime;
 const pitch=drumAudio.createOscillator();
 const envelope=drumAudio.createGain();
 pitch.type='sine';
 pitch.frequency.setValueAtTime(122,now);
 pitch.frequency.exponentialRampToValueAtTime(47,now+.17);
 envelope.gain.setValueAtTime(.001,now);
 envelope.gain.exponentialRampToValueAtTime(seconds<=3?.42:.32,now+.008);
 envelope.gain.exponentialRampToValueAtTime(.001,now+.26);
 pitch.connect(envelope).connect(drumAudio.destination);
 pitch.start(now);
 pitch.stop(now+.27);
 pitch.onended=()=>{pitch.disconnect();envelope.disconnect();};
}

if(typeof window!=='undefined'){
 const prime=event=>{
  if(!event.isTrusted)return;
  void unlockDrawAudio().then(()=>{
   if(drumAudio?.state!=='running')return;
   window.removeEventListener('click',prime,true);
   window.removeEventListener('keydown',prime,true);
  });
 };
 window.addEventListener('click',prime,true);
 window.addEventListener('keydown',prime,true);
}

let announcedDraw='';
function announceDraw(tournamentId,due){
 if(document.hidden || !announcementBuffer || drumAudio?.state!=='running')return;
 const key='proveit:draw-recording:'+tournamentId+':'+due;
 if(announcedDraw===key)return;
 try{if(sessionStorage.getItem(key))return;}catch{}
 const voice=drumAudio.createBufferSource();
 voice.buffer=announcementBuffer;
 voice.connect(drumAudio.destination);
 voice.onended=()=>voice.disconnect();
 voice.start();
 announcedDraw=key;
 try{sessionStorage.setItem(key,'1');}catch{}
}
export function updateDrawCountdown(t,{sub,profiles,onChanged,now=Date.now()}){
 const due=scheduledDraw(t);if(!Number.isFinite(due))return;
 const seconds=Math.max(0,Math.ceil((due-now)/1000));
 document.querySelectorAll('[data-draw-countdown]').forEach(n=>{n.textContent=seconds?'Se sortean en '+Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0'):'Preparando la llave…';});
 playDrawDrum(t.id+':'+due,seconds);
 if(seconds>=9 && seconds<=10)announceDraw(t.id,due);
 const mine=t.participantIds.some(id=>profiles.get(id)?.owner?.split('::')[0]===sub);
 if(attemptTournament!==t.id){attemptTournament=t.id;nextAttempt=0;}
 if(seconds || finishing || now<nextAttempt || (sub!==t.createdBySub && !mine) || document.hidden)return;
 finishing=true;nextAttempt=now+5000;
 void tournamentCompetition(t.id,'DRAW_FINISH').then(()=>onChanged()).catch(()=>{const n=document.querySelector('[data-draw-countdown]');if(n)n.textContent='Sincronizando sorteo… Se reintentará automáticamente.';}).finally(()=>{finishing=false;});
}
export function animateDraw(t,section,{replay=false}={}){
 const state=competitionState(t);
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 if(reduced.matches || section.dataset.revealing==='true')return;
 if(!replay && !t.winnerProfileId && (!state.drawnAt || Date.now()-Date.parse(state.drawnAt)>20000))return;
 const key='proveit:bracket-reveal:'+t.id+':'+(t.winnerProfileId || state.drawnAt);
 try{
  if(!replay && sessionStorage.getItem(key))return;
  sessionStorage.setItem(key,'1');
 }catch{}
 const status=section.querySelector('.bracket-reveal-status');
 const board=section.querySelector('.draw-board');
 if(!status || !board)return;
 const slots=[...board.querySelectorAll('[data-player-label] .participant-name')];
 const names=[...new Set(t.participantNames || [])];
 const originals=slots.map(slot=>slot.textContent);
 const champion=section.querySelector('.bracket-champion');
 const button=section.querySelector('.bracket-replay');
 const ease='cubic-bezier(.23,1,.32,1)';
 section.dataset.revealing='true';
 board.inert=true;
 if(button)button.disabled=true;
 status.textContent='Sorteando cruces';
 let tick=0;
 const shuffle=setInterval(()=>{
  if(!section.isConnected || reduced.matches){clearInterval(shuffle);return;}
  if(!document.hidden && names.length){
   slots.forEach((slot,i)=>{slot.textContent=names[(i*3+tick*(i+1))%names.length];});
   tick++;
  }
 },85);
 setTimeout(()=>{
  clearInterval(shuffle);
  slots.forEach((slot,i)=>{slot.textContent=originals[i];});
  delete section.dataset.revealing;
  board.inert=false;
  if(button)button.disabled=false;
  status.textContent=champion?'Torneo finalizado':'Cruces sorteados';
  if(!section.isConnected || reduced.matches || document.hidden)return;
  const previousSlots=new Map();
  slots.forEach((slot,i)=>{
   const id=slot.closest('[data-player-id]')?.dataset.playerId;
   const round=slot.closest('.draw-round');
   const rect=slot.getBoundingClientRect();
   const previous=previousSlots.get(id);
   const from=previous && previous.round!==round
    ? `translate(${previous.rect.left-rect.left}px,${previous.rect.top-rect.top}px)`
    : 'translateX(6px)';
   if(id)previousSlots.set(id,{round,rect});
   slot.animate([{opacity:0,transform:from},{opacity:1,transform:'none'}],{duration:500,delay:previous && previous.round!==round?700:Math.min(i,12)*45,easing:ease,fill:'backwards'});
  });
  board.querySelectorAll('.bracket-connections path').forEach((path,i)=>{
   if(path.dataset.outcome==='loser'){
    path.animate([{opacity:0},{opacity:1}],{duration:700,delay:350,easing:ease,fill:'backwards'});
    return;
   }
   path.animate([{strokeDasharray:'1',strokeDashoffset:1},{strokeDasharray:'1',strokeDashoffset:0}],{duration:700,delay:Math.min(i,8)*85,easing:ease,fill:'backwards'});
  });
  if(champion){
   champion.animate([{opacity:0,transform:'translateY(8px) scale(.96)'},{opacity:1,transform:'none'}],{duration:500,delay:750,easing:ease,fill:'backwards'});
   setTimeout(()=>{
    if(!champion.isConnected || document.hidden || reduced.matches)return;
    const trophy=champion.firstElementChild;
    if(!trophy)return;
    for(let i=0;i<45;i++){
     const piece=el('i','','bracket-confetti');
     piece.setAttribute('aria-hidden','true');
     trophy.append(piece);
     const angle=i*2.39996,radius=30+(i%9)*8;
     piece.animate([{opacity:1,transform:'translate(0,0) rotate(0)'},{opacity:0,transform:`translate(${Math.cos(angle)*radius}px,${Math.sin(angle)*radius-16}px) rotate(${i*41}deg)`}],{duration:620+(i%7)*40,easing:ease}).finished.then(()=>piece.remove(),()=>piece.remove());
    }
   },900);
  }
 },1500);
}
