import {competitionState,usesCompetition,competitionStart,pendingDrawApprovals,attendanceReady} from '../shared/competition.ts';
import {allEntriesPaid} from '../shared/tournament-room.ts';
import {tournamentCompetition} from './tournaments-api.js';
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
  if(attendanceReady(t) && sub===t.createdBySub){
   const draw=el('button','Sortear participantes','primary-button');
   draw.type='button';draw.dataset.drawSchedule='';
   draw.disabled=now<Date.parse(t.startsAt);
   draw.addEventListener('click',()=>void act('DRAW_SCHEDULE',{}));
   root.append(draw,el('p','El sorteo se habilita a la hora programada.','field-help'));
  }else root.append(el('p','El organizador sorteará los cruces.'));

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
const seenDraws=new Set();
async function finishVisibleAnimations(animations){
 const sync=()=>animations.forEach(animation=>document.hidden?animation.pause():animation.play());
 document.addEventListener('visibilitychange',sync);
 try{
  if(document.hidden)sync();
  await Promise.allSettled(animations.map(animation=>animation.finished));
 }finally{document.removeEventListener('visibilitychange',sync);}
}

export async function animateDraw(t,section,accountId){
 const state=competitionState(t);
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 if(!accountId || !state.drawnAt || t.winnerProfileId || t.status==='COMPLETED' ||
    reduced.matches || document.hidden || section.dataset.revealing)return;
 const key='proveit:draw-viewed:'+accountId+':'+t.id+':'+state.drawnAt;
 if(seenDraws.has(key))return;
 try{if(localStorage.getItem(key))return;}catch{}
 const status=section.querySelector('.bracket-reveal-status');
 const board=section.querySelector('.draw-board');
 if(!status || !board)return;
 const slots=[...board.querySelectorAll('[data-player-label] .participant-name')];
 const ease='cubic-bezier(.23,1,.32,1)';
 section.dataset.revealing='true';
 board.inert=true;
 status.textContent='Sorteando cruces';
 const movingSlots=slots;
 const originalNames=movingSlots.map(slot=>slot.textContent);
 const size=movingSlots.length;
 let offset=size>1?1:0;
 movingSlots.forEach((slot,index)=>{slot.textContent=originalNames[(index+offset)%size];});
 try{
  for(let round=0;round<4 && size>1;round++){
   if(!section.isConnected || reduced.matches)break;
   const positions=movingSlots.map(slot=>slot.getBoundingClientRect());
   const nextOffset=(offset+1)%size;
   movingSlots.forEach((slot,index)=>{
    slot.textContent=originalNames[(index+nextOffset)%size];
   });
   const animations=movingSlots.map((slot,index)=>{
    const previous=positions[(index+1)%size];
    const current=slot.getBoundingClientRect();
    const x=previous.left-current.left,y=previous.top-current.top;
    return slot.animate([
     {transform:`translate(${x}px,${y}px)`},
     {transform:`translate(${-x*.06}px,${-y*.06}px)`,offset:.76},
     {transform:'translate(0,0)'}
    ],{duration:360,easing:ease});
   });
   await finishVisibleAnimations(animations);
   offset=nextOffset;
  }
 }finally{
  const shuffledPositions=new Map(movingSlots.map((slot,index)=>[slot,movingSlots[(index-offset+size)%size].getBoundingClientRect()]));
  movingSlots.forEach((slot,index)=>{slot.textContent=originalNames[index];});

  status.textContent='Cruces sorteados';
  try{
  if(!section.isConnected || reduced.matches)return;
  const reveal=[];
  const previousSlots=new Map();
  slots.forEach((slot,i)=>{
   const id=slot.closest('[data-player-id]')?.dataset.playerId;
   const round=slot.closest('.draw-round');
   const rect=slot.getBoundingClientRect();
   const previous=previousSlots.get(id);
   const shuffled=shuffledPositions.get(slot);
   const from=previous && previous.round!==round
    ? `translate(${previous.rect.left-rect.left}px,${previous.rect.top-rect.top}px)`
    : shuffled ? `translate(${shuffled.left-rect.left}px,${shuffled.top-rect.top}px)` : 'translateX(6px)';
   if(id)previousSlots.set(id,{round,rect});
   reveal.push(slot.animate([{opacity:0,transform:from},{opacity:1,transform:'none'}],{duration:500,delay:previous && previous.round!==round?700:Math.min(i,12)*45,easing:ease,fill:'backwards'}));
  });
  section.dataset.revealing='finishing';
  board.querySelectorAll('.bracket-connections path').forEach((path,i)=>{
   if(path.dataset.outcome==='loser'){
    reveal.push(path.animate([{opacity:0},{opacity:1}],{duration:700,delay:350,easing:ease,fill:'backwards'}));
    return;
   }
   reveal.push(path.animate([{strokeDasharray:'1',strokeDashoffset:1},{strokeDasharray:'1',strokeDashoffset:0}],{duration:700,delay:Math.min(i,8)*85,easing:ease,fill:'backwards'}));
  });
  await finishVisibleAnimations(reveal);
  if(section.isConnected && !document.hidden && !reduced.matches){
   seenDraws.add(key);
   try{localStorage.setItem(key,'1');}catch{}
  }
  }finally{
   delete section.dataset.revealing;
   board.inert=false;
  }
 }
}

function celebrateWinner(target){
 const rect=target.getBoundingClientRect();
 if(rect.bottom<0 || rect.top>innerHeight || rect.right<0 || rect.left>innerWidth)return;
 const burst=el('div','','winner-confetti');
 burst.setAttribute('aria-hidden','true');
 burst.style.left=rect.left+rect.width/2+'px';
 burst.style.top=rect.top+rect.height/2+'px';
 const palette=['#ff547d','#ffd44d','#58d4ff','#a887ff','#69e597','#ff8752'];
 const animations=[];
 document.body.append(burst);
 for(let i=0;i<42;i++){
  const piece=el('span');
  piece.style.backgroundColor=palette[i%palette.length];
  piece.style.width=4+Math.random()*4+'px';
  piece.style.height=5+Math.random()*7+'px';
  if(i%5===0)piece.style.borderRadius='50%';
  const x=(Math.random()-.5)*330, lift=55+Math.random()*105;
  const spin=(Math.random()-.5)*850;
  burst.append(piece);
  animations.push(piece.animate([
   {transform:'translate(0,0) rotate(0)',opacity:1},
   {transform:`translate(${x*.7}px,${-lift}px) rotate(${spin*.45}deg)`,opacity:1,offset:.42},
   {transform:`translate(${x}px,${40+Math.random()*115}px) rotate(${spin}deg)`,opacity:0}
  ],{duration:750+Math.random()*450,fill:'both',easing:'ease-out'}).finished);
 }
 void Promise.allSettled(animations).then(()=>burst.remove());
}

export function animateWinner(section,winnerId){
 if(document.hidden || matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 const target=section.querySelector('.bracket-champion');
 if(!target)return;
 const source=[...section.querySelectorAll('.draw-player[data-player-id]')]
  .findLast(slot=>slot!==target && slot.dataset.playerId===winnerId);
 const end=target.getBoundingClientRect();
 const start=source?.getBoundingClientRect();
 const x=start?start.left-end.left:0;
 const y=start?start.top-end.top:8;
 const movement=target.animate([
  {opacity:0,transform:`translate(${x}px,${y}px)`},
  {opacity:1,transform:'none'}
 ],{duration:500,easing:'cubic-bezier(.23,1,.32,1)'});
 void movement.finished.then(()=>{
  if(target.isConnected && !document.hidden && !matchMedia('(prefers-reduced-motion: reduce)').matches)celebrateWinner(target);
 },()=>{});

}
