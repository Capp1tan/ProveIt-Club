import { pendingInvitations, respondInvitation } from './tournaments-api.js';
import { noJudgeConsent, countdownLabel, scheduleLabel } from './tournament-schedule.js';
import { prizeIcon } from './prize-types.js';
import '../tournament-real-lobby.css';
const el = (tag,text='',cls='') => { const n=document.createElement(tag);n.textContent=text;n.className=cls;return n; };
// Sólo datos recibidos de AWS. La vista no confirma jugadores ni inventa estados.
export function createRealLobby({ profilePreview, getUser, onChanged }) {
  const root=el('section','','real-lobby'), ring=el('div','','rl-ring'), ringText=el('strong');
  const inner=el('div');inner.append(ringText,el('small','confirmados'));ring.append(inner);
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  let t, filter='all', shown=null,target=0,frame=0,context='',busy=false,consents=new Set(),actionId=0;
  const paint=v=>{shown=v;ring.style.setProperty('--progress',`${v*100}%`);};
  function animate(value,reset) {
    if(reset || shown===null || reduced.matches){cancelAnimationFrame(frame);frame=0;target=value;paint(value);return;}
    if(value===target)return;cancelAnimationFrame(frame);target=value;
    const from=shown,start=performance.now();
    const step=now=>{const p=Math.min(1,(now-start)/720),e=p<.5?4*p*p*p:1-Math.pow(-2*p+2,3)/2;paint(from+(value-from)*e);if(p<1)frame=requestAnimationFrame(step);else frame=0;};frame=requestAnimationFrame(step);
  }
  function clock() { const n=root.querySelector('[data-real-clock]');if(n)n.textContent=t.winnerProfileId?'Finalizado':t.startsAt?countdownLabel(t.startsAt):'Horario sin definir'; }
  async function answer(accept,message) {
    if(busy)return;
    if(!accept && !window.confirm('¿Rechazar tu invitación a «'+t.name+'»? El sorteo quedará detenido.'))return;
    busy=true;const generation=++actionId,id=t.id,version=t.termsVersion || 0;
    root.querySelectorAll('.rl-answer').forEach(n=>n.disabled=true);message.textContent='Comprobando tus invitaciones…';
    try {
      // Se vuelve a leer la invitación del usuario; nunca se responde por otro integrante.
      const invitations=(await pendingInvitations()).filter(i=>i.tournamentId===id && (i.termsVersion || 0)===version);
      if(!invitations.length)throw new Error('Tu invitación cambió o ya fue respondida. Actualizá la sala.');
      // Si se tienen dos cargos se aceptan explícitamente en una misma acción; cada uno se valida en AWS.
      for(const invite of invitations) await respondInvitation(invite.id,accept,accept && t.arbitrationMode==='ORGANIZER',accept,version);
      if(generation!==actionId)return;
      message.textContent=accept?'Respuesta guardada. Actualizando la sala…':'Invitación rechazada.';
      window.dispatchEvent(new Event('proveit:invitation-updated'));await onChanged();
    } catch(error) { message.textContent=error.message || 'No pudimos guardar tu respuesta.'; }
    finally { if(generation===actionId){busy=false;const check=root.querySelector('.rl-consent input');root.querySelectorAll('.rl-answer').forEach(n=>n.disabled=n.dataset.accept==='true' && !check?.checked);} }
  }
  function render(value) {
    t=value;root.replaceChildren();
    const statuses=t.rosterStatuses || Array(t.participantIds.length+t.judgeIds.length+(t.treasurerId?1:0)).fill('ACCEPTED');
    const people=t.participantIds.map((id,i)=>({id,name:t.participantNames[i],status:statuses[i] || 'PENDING'}));
    const accepted=people.filter(p=>p.status==='ACCEPTED').length,total=people.length;
    const top=el('div','','rl-overview');
    const timing=el('section','','rl-card');timing.append(el('small','INICIO PREVISTO'));const digits=el('strong');digits.dataset.realClock='';digits.setAttribute('role','timer');digits.setAttribute('aria-live','off');timing.append(digits,el('span',scheduleLabel(t.startsAt,t.timeZone)));top.append(timing);
    const prize=el('section','','rl-card rl-prize');prize.append(prizeIcon(t.prizeType));
    const prizeCopy=el('div');
    const announced=Boolean(t.prizeTitle),confirmed=announced && t.prizeFundingStatus==='CONFIRMED';
    prizeCopy.append(el('small',confirmed?'ESTO ESTÁ EN JUEGO':announced?'PREMIO PROPUESTO':t.prizeExpected?'PREMIO POR DEFINIR':'POR EL DESAFÍO'),el('strong',announced?t.prizeTitle:t.prizeExpected?'Pendiente de definición':'Sin premio anunciado'));
    prizeCopy.append(el('span',confirmed?'Confirmado por el responsable · gestión externa':announced?'Pendiente de confirmación · no disponible':'No hay un premio confirmado'));
    if(announced)prizeCopy.append(el('span','Aporta: '+(t.prizeFunder || 'Sin declarar')+' · Entrega: '+(t.prizeHolder || 'Sin declarar')));
    prize.append(prizeCopy);top.append(prize);
    const judge=el('section','','rl-card');judge.append(el('small',t.arbitrationMode==='ORGANIZER'?'ARBITRAJE':'JUECES Y RESPONSABLES DEL PREMIO'));
    if(t.arbitrationMode==='ORGANIZER')judge.append(el('strong','Decide el organizador'),el('span','Condición aceptada al confirmar'));
    else t.judgeIds.forEach((id,i)=>{const line=el('div','','rl-judge');line.append(profilePreview.button(id,t.judgeNames[i]),el('small',statuses[total+i]==='ACCEPTED'?'Cargo aceptado':statuses[total+i]==='REJECTED'?'Cargo rechazado':'Aceptación pendiente'));judge.append(line);});
    top.append(judge);root.append(top);
    const hero=el('section','','rl-card rl-hero'),copy=el('div');
    copy.append(el('p',t.winnerProfileId?'ENCUENTRO FINALIZADO':'FASE DE CONFIRMACIÓN','rl-kicker'),el('h2',t.winnerProfileId?'Desafío completado':'Sala de espera'),el('p',t.winnerProfileId?'Revisá el resultado y la participación.':'Confirmá tu asistencia para preparar el encuentro.'));
    const live=el('small','','lobby-live');live.id='lobbyConnection';copy.append(live);
    const scheduleNote=el('small','El horario no confirma personas ni inicia automáticamente el torneo.');copy.append(scheduleNote);hero.append(copy,ring);root.append(hero);
    ringText.textContent=accepted+' de '+total;ring.setAttribute('role','img');ring.setAttribute('aria-label',accepted+' de '+total+' participantes confirmados');
    animate(total?accepted/total:0,context!==t.id);context=t.id;
    const toolbar=el('div','','rl-toolbar');
    for(const [key,label] of [['all','Todos'],['ACCEPTED','Listos'],['PENDING','Pendientes'],['REJECTED','No asisten']]){
      const n=key==='all'?total:people.filter(p=>p.status===key).length;
      const b=el('button',`${label} (${n})`,'rl-filter');b.type='button';b.setAttribute('aria-pressed',String(filter===key));b.addEventListener('click',()=>{filter=key;render(t);});toolbar.append(b);
    }root.append(toolbar);
    const list=el('ul','','rl-roster');
    for(const p of people.filter(p=>filter==='all' || p.status===filter)){
      const row=el('li','','rl-person');row.append(profilePreview.button(p.id,p.name));
      const state=el('span',p.status==='ACCEPTED'?'✓ Confirmado':p.status==='REJECTED'?'No asiste':'Pendiente','rl-state');state.dataset.state=p.status;row.append(state);list.append(row);
    }if(!list.childElementCount)list.append(el('li','No hay participantes en este estado.','field-help'));root.append(list);
    const user=getUser(),mine=[];
    [...t.participantIds,...t.judgeIds,...(t.treasurerId?[t.treasurerId]:[])].forEach((id,index)=>{const profile=profilePreview.profiles.get(id);if(profile?.owner?.split('::')[0]===user?.userId)mine.push({index,status:statuses[index] || 'PENDING',judge:index>=total});});
    if(mine.some(role=>role.status==='PENDING') && !t.winnerProfileId){
      const form=el('section','','rl-card rl-response'),key=t.id+':'+(t.termsVersion || 0);
      form.append(el('h3',mine.some(r=>r.judge)?'Aceptar mi participación y cargo':'Confirmar mi asistencia'));
      const rules=el('details');rules.append(el('summary','Leer reglas y condiciones'),el('p',t.description || 'Sin reglas adicionales'));
      if(t.conflicts)rules.append(el('p','Conflictos declarados: '+t.conflicts));
      rules.append(el('p','Premio: '+(t.prizeTitle || 'Sin premio anunciado')+' · '+(confirmed?'Confirmado por el responsable':'No disponible / pendiente de confirmación')));
      if(t.prizeDescription)rules.append(el('p',t.prizeDescription));
      if(announced)rules.append(el('p','Entrega: '+(t.prizeHolder || 'Sin declarar')+' · Financia: '+(t.prizeFunder || 'Sin declarar')+' · Gestión externa a ProveIt.'));
      form.append(rules);
      const consent=el('label','','rl-consent'),check=el('input');check.type='checkbox';check.checked=consents.has(key);
      consent.append(check,document.createTextNode((t.arbitrationMode==='ORGANIZER'?noJudgeConsent+' ':'')+'Leí y acepto las reglas, los conflictos declarados y las condiciones del premio.'+(mine.some(r=>r.judge)?' Acepto el cargo de juez y la coordinación del premio según esas condiciones.':'')));form.append(consent);
      const actions=el('div','','rl-actions'),message=el('p','','field-help');message.setAttribute('role','status');
      const yes=el('button',mine.some(r=>r.judge)?'Aceptar mis cargos':'Confirmar mi asistencia','primary-button rl-answer');yes.type='button';yes.dataset.accept='true';yes.disabled=busy || !check.checked;
      const no=el('button','No podré asistir','format-choice rl-answer');no.type='button';no.disabled=busy;
      check.addEventListener('change',()=>{check.checked?consents.add(key):consents.delete(key);yes.disabled=busy || !check.checked;});
      yes.addEventListener('click',()=>void answer(true,message));no.addEventListener('click',()=>void answer(false,message));actions.append(yes,no);form.append(actions,message);root.append(form);
    }else if(mine.length)root.append(el('p',mine.every(r=>r.status==='ACCEPTED')?'Tu asistencia y tus cargos están confirmados.':'Ya respondiste a la invitación.','rl-own-state'));
    const next=el('section','','rl-card rl-next');
    const allAccepted=statuses.every(s=>s==='ACCEPTED');
    next.append(el('p',t.draw && allAccepted?'Las llaves ya están disponibles.':statuses.includes('REJECTED')?'Hay una invitación rechazada. El sorteo permanece detenido.':`Los cruces se sortean cuando todos los participantes y responsables aceptan (${statuses.filter(s=>s==='ACCEPTED').length}/${statuses.length} cargos).`));
    if(t.draw && allAccepted){const link=el('a','Ver llaves →','format-choice');link.href='#tournamentDraw';next.append(link);}root.append(next);clock();return root;
  }
  return {render,clock,destroy(){cancelAnimationFrame(frame);actionId++;root.replaceChildren();}};
}
