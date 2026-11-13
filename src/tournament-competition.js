import {competitionState,usesCompetition,competitionStart,pendingDrawApprovals,attendanceReady,scheduledDraw} from '../shared/competition.ts';
import {allEntriesPaid} from '../shared/tournament-room.ts';
import {tournamentCompetition} from './tournaments-api.js';
const el=(tag,text='',cls='')=>{const n=document.createElement(tag);n.textContent=text;n.className=cls;return n;};
export function attendancePanel(t,{sub,profiles,onChanged,now=Date.now()}){
 if(!usesCompetition(t) || t.winnerProfileId)return null;
 const renderedAt=Date.now();
 const s=competitionState(t),root=el('section','','competition-actions rl-card'),mine=t.participantIds.find(id=>profiles.get(id)?.owner?.split('::')[0]===sub),start=competitionStart(t);
 if(Number.isFinite(start) && now>=start)return null;
 const accepted=allEntriesPaid(t) && t.rosterStatuses?.every(v=>v==='ACCEPTED');
 if(!accepted){root.append(el('p','Primero se completan las invitaciones y los pagos. Luego cada jugador confirma que está presente.'));return root;}
 const message=el('p','','field-help');message.setAttribute('role','status');
 async function act(action,values){root.dataset.competitionBusy='true';root.querySelectorAll('button').forEach(b=>b.disabled=true);message.textContent='Guardando…';try{await tournamentCompetition(t.id,action,values);document.activeElement?.blur();await onChanged();}catch(e){delete root.dataset.competitionBusy;message.textContent=e.message;root.querySelectorAll('button').forEach(b=>b.disabled=false);}}
 if(mine){
  if(s.attendance?.[mine]?.ready)root.append(el('p','✓ Asistencia confirmada'));
  else{
   const button=el('button','Estoy listo para jugar','primary-button');
   button.type='button';
   button.dataset.attendanceAction='';
   button.dataset.scheduledAt=t.startsAt;
   button.disabled=now<Date.parse(t.startsAt);
   button.addEventListener('click',()=>void act('ATTENDANCE',{ready:true}));
   root.append(button);
   if(button.disabled)root.append(el('p','La confirmación de asistencia se habilita a la hora programada.','field-help'));
  }
 }
 if(!t.draw){
  const ready=attendanceReady(t),due=scheduledDraw(t);
  if(Number.isFinite(due)){const seconds=Math.max(0,Math.ceil((due-now)/1000)),countdown=el('p','Se sortean en '+Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0'),'draw-countdown');countdown.dataset.drawCountdown='';countdown.setAttribute('role','timer');countdown.setAttribute('aria-live','off');root.append(el('h2','El sorteo está por comenzar'),countdown,el('p','Todos verán la misma llave.','field-help'));
   if((window.AudioContext || window.webkitAudioContext) && drumAudio?.state!=='running'){
    const enableVoice=el('button','Activar sonido del sorteo','format-choice');
    enableVoice.type='button';
    enableVoice.addEventListener('click',()=>{
     void unlockDrawAudio().then(()=>{if(drumAudio?.state==='running')enableVoice.remove();});
     if(due-(Date.now()+now-renderedAt)>10000)speakDraw('Aviso de voz activado.');
     else announcedDraw='';
    },{once:true});
    root.append(enableVoice);
   }
  }
  else if(ready){root.append(el('p','Todos listos. El organizador puede iniciar el sorteo público de los cruces.'));if(sub===t.createdBySub){const draw=el('button','Sortear participantes','primary-button');draw.type='button';draw.addEventListener('click',()=>void act('DRAW_SCHEDULE',{}));root.append(draw,el('p','Al pulsarlo comenzará una cuenta regresiva de un minuto para todos.','field-help'));}}
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
let drumAudio;
let lastDrumSecond='';
async function unlockDrawAudio(){
 const AudioContext=window.AudioContext || window.webkitAudioContext;
 if(!AudioContext)return;
 try{
  drumAudio ||= new AudioContext();
  if(drumAudio.state!=='running')await drumAudio.resume();
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
 if(document.hidden || !window.speechSynthesis || !window.SpeechSynthesisUtterance)return;
 const key='proveit:draw-voice:'+tournamentId+':'+due;
 if(announcedDraw===key)return;
 try{if(sessionStorage.getItem(key))return;}catch{}
 announcedDraw=key;
 speakDraw('Los sorteos comenzarán en 10 segundos',()=>{try{sessionStorage.setItem(key,'1');}catch{}});
}
function speakDraw(text,onStart){
 try{
  const announcement=new SpeechSynthesisUtterance(text);
  announcement.lang='es-AR';
  if(onStart)announcement.onstart=onStart;
  speechSynthesis.speak(announcement);
 }catch{}
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
export function animateDraw(t,section){
 const s=competitionState(t);if(!usesCompetition(t) || !s.drawnAt || Date.now()-Date.parse(s.drawnAt)>20000 || matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 const key='proveit:draw-seen:'+t.id+':'+s.drawnAt;try{if(sessionStorage.getItem(key))return;sessionStorage.setItem(key,'1');}catch{return;}
 const announcement=el('p','Sorteo completado · revelando los cruces…','draw-reveal');announcement.setAttribute('role','status');section.prepend(announcement);
 const slots=[...section.querySelectorAll('.draw-player')];
 slots.forEach((slot,i)=>{const delay=Math.min(i,24)*55;slot.animate([{opacity:0,transform:'translateY(12px) scale(.97)'},{opacity:1,transform:'none'}],{duration:420,delay,fill:'backwards',easing:'cubic-bezier(.22,1,.36,1)'});});
 if(section.isConnected)section.scrollIntoView({behavior:'smooth',block:'start'});
}
