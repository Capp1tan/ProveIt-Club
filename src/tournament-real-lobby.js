import {usesCompetition,competitionState,competitionStart} from '../shared/competition.ts';
import {roomDeadline,tournamentIsLive,allEntriesPaid} from '../shared/tournament-room.ts';
import { pendingInvitations, respondInvitation } from './tournaments-api.js';
import { noJudgeConsent, countdownLabel, scheduleLabel } from './tournament-schedule.js';
import {money} from './billing-api.js';
import { prizeIcon } from './prize-types.js';
import '../tournament-real-lobby.css';
const el = (tag,text='',cls='') => { const n=document.createElement(tag);n.textContent=text;n.className=cls;return n; };
// Sólo datos recibidos de AWS. La vista no confirma jugadores ni inventa estados.
export function createRealLobby({ profilePreview, getUser, getConnection, getNow=()=>Date.now(), onChanged }) {
  const root=el('section','','real-lobby'), ring=el('div','','rl-ring'), ringText=el('strong');
  const inner=el('div');inner.append(el('small','PARTICIPANTES CONFIRMADOS'),ringText);const track=el('span','','rl-progress-track');track.append(el('span'));ring.append(inner,track);
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  let headerStats;const previousStatuses=new Map();
  let t, filter='all', shown=null,target=0,frame=0,context='',busy=false,consents=new Set(),actionId=0;
  const paint=v=>{shown=v;ring.style.setProperty('--progress',`${v*100}%`);};
  function animate(value,reset) {
    if(reset || shown===null || reduced.matches){cancelAnimationFrame(frame);frame=0;target=value;paint(value);return;}
    if(value===target)return;cancelAnimationFrame(frame);target=value;
    const from=shown,start=performance.now();
    const step=now=>{const p=Math.min(1,(now-start)/720),e=p<.5?4*p*p*p:1-Math.pow(-2*p+2,3)/2;paint(from+(value-from)*e);if(p<1)frame=requestAnimationFrame(step);else frame=0;};frame=requestAnimationFrame(step);
  }
  function clock() {
    if(!t)return;const n=headerStats?.querySelector('[data-real-clock]'),live=tournamentIsLive(t,getNow()),deadline=roomDeadline(t),done=Boolean(t.winnerProfileId || t.status==='COMPLETED');
    if(n){n.classList.toggle('rl-live-badge',live);n.setAttribute('role',live?'status':'timer');n.textContent=live?'PARTIDA EN CURSO':done?'Finalizado':usesCompetition(t)?(Number.isFinite(competitionStart(t))?countdownLabel(new Date(competitionStart(t)).toISOString(),getNow()):'Esperando asistencia'):t.startsAt?(getNow()>=Date.parse(t.startsAt)?'Esperando confirmaciones':countdownLabel(t.startsAt,getNow())):'Horario sin definir';}
    const caption=headerStats?.querySelector('[data-clock-caption]');if(caption)caption.textContent=live?'EN VIVO':done?'TORNEO FINALIZADO':usesCompetition(t)?'INICIO DEL ENCUENTRO':'INICIO PREVISTO';
    const phase=root.querySelector('.rl-kicker');if(phase)phase.textContent=(done?'ENCUENTRO FINALIZADO':live?'EN CURSO':'FASE DE CONFIRMACIÓN')+' · '+t.name+' · '+t.activity;
    const heading=root.querySelector('.rl-hero h1');if(heading)heading.textContent=done?'Desafío completado':live?'El torneo está en curso':'Sala de espera y confirmación de asistencia';
    const intro=root.querySelector('[data-lobby-intro]');if(intro)intro.textContent=done?'Revisá el resultado y la participación.':live?'La competencia ya comenzó.':'Confirmá tu asistencia para preparar el encuentro.';
    const remaining=root.querySelector('[data-room-closing]');if(remaining && deadline!==null){const seconds=Math.max(0,Math.ceil((deadline-getNow())/1000));remaining.textContent=Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');}
  }
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
      for(const invite of invitations){const response=await respondInvitation(invite.id,accept,accept && t.arbitrationMode==='ORGANIZER',accept,version);if(response.paymentRequired){message.textContent='Abriendo el pago de tu inscripción…';return;}}
      if(generation!==actionId)return;
      message.textContent=accept?'Respuesta guardada. Actualizando la sala…':'Invitación rechazada.';
      window.dispatchEvent(new Event('proveit:invitation-updated'));await onChanged();
    } catch(error) { message.textContent=error.message || 'No pudimos guardar tu respuesta.'; }
    finally { if(generation===actionId){busy=false;const check=root.querySelector('.rl-consent input');root.querySelectorAll('.rl-answer').forEach(n=>n.disabled=n.dataset.accept==='true' && !check?.checked);} }
  }
  function render(value) {
    t=value;root.replaceChildren();headerStats?.remove();
    const statuses=t.rosterStatuses || Array(t.participantIds.length+t.judgeIds.length+(t.treasurerId?1:0)).fill('ACCEPTED');
    const cs=competitionState(t);
    const people=t.participantIds.map((id,i)=>({id,name:t.participantNames[i],paymentReversed:t.entryPaymentStatuses?.[i]==='REVERSED',invitation:statuses[i] || 'PENDING',status:t.entryPaymentStatuses?.[i]==='REVERSED'?'PENDING':usesCompetition(t)?(statuses[i]==='REJECTED'?'REJECTED':cs.attendance?.[id]?.ready?'ACCEPTED':'PENDING'):statuses[i] || 'PENDING'}));
    const accepted=people.filter(p=>p.status==='ACCEPTED').length,total=people.length;
    const top=el('div','','rl-overview');
    const timing=el('section','','rl-card');const caption=el('small','INICIO PREVISTO');caption.dataset.clockCaption='';timing.append(caption);const digits=el('strong');digits.dataset.realClock='';digits.setAttribute('role','timer');digits.setAttribute('aria-live','off');timing.append(digits,el('span',scheduleLabel(t.startsAt,t.timeZone)));top.append(timing);
    const prize=el('section','','rl-card rl-prize');prize.append(prizeIcon(t.prizeType));
    const prizeCopy=el('div');
    const announced=Boolean(t.prizeTitle),confirmed=announced && t.prizeFundingStatus==='CONFIRMED';
    prizeCopy.append(el('small',confirmed?'ESTO ESTÁ EN JUEGO':announced?'PREMIO PROPUESTO':t.prizeExpected?'PREMIO POR DEFINIR':'POR EL DESAFÍO'),el('strong',announced?t.prizeTitle:t.prizeExpected?'Pendiente de definición':'Sin premio anunciado'));
    prizeCopy.append(el('span',confirmed?'Confirmado por el responsable · gestión externa':announced?'Pendiente de confirmación · no disponible':'No hay un premio confirmado'));
    if(announced)prizeCopy.append(el('span','Entrega: '+(t.prizeHolder || 'Sin declarar')));
    prize.classList.toggle('prize-confirmed',confirmed);prize.append(prizeCopy);if(announced || t.prizeExpected===true)top.append(prize);
    top.classList.toggle('rl-overview-single',top.childElementCount===1);
    const judge=el('section','','rl-card');judge.append(el('small',t.arbitrationMode==='ORGANIZER'?'ARBITRAJE':'JUECES Y RESPONSABLES DEL PREMIO'));
    if(t.arbitrationMode==='ORGANIZER')judge.append(el('strong','Decide el organizador'),el('span','Condición aceptada al confirmar'));
    else t.judgeIds.forEach((id,i)=>{const line=el('div','','rl-judge');line.append(profilePreview.button(id,t.judgeNames[i]),el('small',statuses[total+i]==='ACCEPTED'?'Cargo aceptado':statuses[total+i]==='REJECTED'?'Cargo rechazado':'Aceptación pendiente'));judge.append(line);});
    headerStats=top;const nav=document.querySelector('header.topbar .top-actions');if(nav)nav.before(top);else root.append(top);
    const hero=el('section','','rl-card rl-hero'),copy=el('div');
    copy.append(el('p',(t.winnerProfileId?'ENCUENTRO FINALIZADO':'FASE DE CONFIRMACIÓN')+' · '+t.name+' · '+t.activity,'rl-kicker'),el('h1',t.winnerProfileId?'Desafío completado':'Sala de espera y confirmación de asistencia'),el('p',t.winnerProfileId?'Revisá el resultado y la participación.':'Confirmá tu asistencia para preparar el encuentro.'));
    copy.querySelector('p:last-child').dataset.lobbyIntro='';
    const deadline=roomDeadline(t);if(deadline!==null){const closing=el('aside','','rl-closing-notice');closing.setAttribute('role','status');const time=el('strong');time.dataset.roomClosing='';closing.append(el('span','Esta sala se cerrará automáticamente en '),time,el('p','El resultado ya está guardado. Podés salir de la sala sin problemas; tu participación seguirá en el historial.'));root.append(closing);}
    const connected=Boolean(getConnection?.());const live=el('small',connected?'Confirmaciones en vivo':'Actualización automática · reconectando','lobby-live');live.id='lobbyConnection';live.classList.toggle('lobby-reconnect',!connected);copy.append(live);
    const scheduleNote=el('small','El horario no confirma personas ni inicia automáticamente el torneo.');copy.append(scheduleNote);hero.append(copy,ring);root.append(hero);
    ringText.textContent=accepted+' / '+total;ring.setAttribute('role','img');ring.setAttribute('aria-label',accepted+' de '+total+' participantes confirmados');
    if(context!==t.id)previousStatuses.clear();
    animate(total?accepted/total:0,context!==t.id);context=t.id;
    if(t.entryFeeCents>0){const price=el('p',`Inscripción individual: ${money(t.entryFeeCents)}. Crear es gratis; tu lugar se confirma con el pago aprobado. Los jueces no pagan salvo que también compitan. Si hay una cancelación, contactá al administrador para revisar tu pago.`,'rl-entry-fee');root.append(price);if(t.entryPaymentStatuses?.includes('REVERSED'))root.append(el('p','Hay un pago de inscripción en revisión. El torneo no puede avanzar hasta resolverlo.','tournament-notice'));}
    const toolbar=el('div','','rl-toolbar');
    for(const [key,label] of [['all','Todos'],['ACCEPTED','Listos'],['PENDING','Pendientes'],['REJECTED','No asisten']]){
      const n=key==='all'?total:people.filter(p=>p.status===key).length;
      const b=el('button',`${label} (${n})`,'rl-filter');b.type='button';b.setAttribute('aria-pressed',String(filter===key));b.addEventListener('click',()=>{filter=key;render(t);});toolbar.append(b);
    }root.append(toolbar);
    const list=el('ul','','rl-roster');
    for(const p of people.filter(p=>filter==='all' || p.status===filter)){
      const row=el('li','','rl-person');row.dataset.state=p.status;
      if(context===t.id && previousStatuses.has(p.id) && previousStatuses.get(p.id)!==p.status)row.classList.add('rl-state-changed');
      row.append(profilePreview.button(p.id,p.name));
      const state=el('span',p.status==='ACCEPTED'?'✓ Confirmado':p.status==='REJECTED'?'No asiste':p.paymentReversed?'Pago en revisión':usesCompetition(t) && p.invitation==='ACCEPTED'?'Inscripto · sin asistencia':'Invitación pendiente','rl-state');state.dataset.state=p.status;row.append(state);list.append(row);
    }if(!list.childElementCount)list.append(el('li','No hay participantes en este estado.','field-help'));root.append(list);
    const user=getUser(),mine=[];
    [...t.participantIds,...t.judgeIds,...(t.treasurerId?[t.treasurerId]:[])].forEach((id,index)=>{const profile=profilePreview.profiles.get(id);if(profile?.owner?.split('::')[0]===user?.userId)mine.push({index,status:statuses[index] || 'PENDING',judge:index>=total});});
    const primary=el('button',mine.some(role=>role.status==='PENDING')?'Responder mi invitación':mine.length?'Invitación respondida':'Sólo participantes','primary-button rl-toolbar-action');primary.type='button';primary.disabled=!mine.some(role=>role.status==='PENDING') || Boolean(t.winnerProfileId);toolbar.append(primary);
    if(mine.some(role=>role.status==='PENDING') && !t.winnerProfileId){
      const form=el('section','','rl-card rl-response'),key=t.id+':'+(t.termsVersion || 0);
      form.id='myTournamentResponse';form.hidden=true;primary.setAttribute('aria-expanded','false');primary.setAttribute('aria-controls',form.id);primary.addEventListener('click',()=>{form.hidden=!form.hidden;primary.setAttribute('aria-expanded',String(!form.hidden));if(!form.hidden){form.scrollIntoView({behavior:reduced.matches?'instant':'smooth',block:'nearest'});check.focus({preventScroll:true});}});
      form.append(el('h3',mine.some(r=>r.judge)?'Aceptar mi participación y cargo':'Confirmar mi asistencia'));
      const rules=el('details');rules.append(el('summary','Leer reglas y condiciones'),el('p',t.description || 'Sin reglas adicionales'));
      if(t.conflicts)rules.append(el('p','Conflictos declarados: '+t.conflicts));
      if(announced || t.prizeExpected===true)rules.append(el('p','Premio: '+(t.prizeTitle || 'Por definir')+' · '+(confirmed?'Confirmado por el responsable':'No disponible / pendiente de confirmación')));
      if(t.prizeDescription)rules.append(el('p',t.prizeDescription));
      if(announced)rules.append(el('p','Entrega: '+(t.prizeHolder || 'Sin declarar')+' · Gestión externa a ProveIt.'));
      form.append(rules);
      const consent=el('label','','rl-consent'),check=el('input');check.type='checkbox';check.checked=consents.has(key);
      consent.append(check,document.createTextNode((t.arbitrationMode==='ORGANIZER'?noJudgeConsent+' ':'')+'Leí y acepto las reglas y las condiciones declaradas'+(announced || t.prizeExpected===true?' y las condiciones del premio.':'.')+(t.entryFeeCents>0 && mine.some(r=>!r.judge)?' Acepto el costo de inscripción de '+money(t.entryFeeCents)+'.':'')+(mine.some(r=>r.judge)?' Acepto el cargo de juez y la coordinación del premio según esas condiciones.':'')));form.append(consent);
      const actions=el('div','','rl-actions'),message=el('p','','field-help');message.setAttribute('role','status');
      const yes=el('button',mine.some(r=>!r.judge) && t.entryFeeCents>0?'Confirmar inscripción · '+money(t.entryFeeCents):mine.some(r=>r.judge)?'Aceptar mis cargos':'Confirmar mi asistencia','primary-button rl-answer');yes.type='button';yes.dataset.accept='true';yes.disabled=busy || !check.checked;
      const no=el('button','No podré asistir','format-choice rl-answer');no.type='button';no.disabled=busy;
      check.addEventListener('change',()=>{check.checked?consents.add(key):consents.delete(key);yes.disabled=busy || !check.checked;});
      yes.addEventListener('click',()=>void answer(true,message));no.addEventListener('click',()=>void answer(false,message));actions.append(yes,no);form.append(actions,message);root.append(form);
    }else if(mine.length)root.append(el('p',mine.every(r=>r.status==='ACCEPTED')?(mine.some(r=>r.judge)?'Tu participación y tus cargos están aceptados.':'Tu inscripción está aceptada. Confirmá tu asistencia cuando estés listo para jugar.'):'Ya respondiste a la invitación.','rl-own-state'));
    if(t.judgeIds?.length){const judgeDetails=el('details','','rl-judge-details');judgeDetails.append(el('summary','Jurado y responsables'),judge);root.append(judgeDetails);}
    people.forEach(p=>previousStatuses.set(p.id,p.status));
    const next=el('section','','rl-card rl-next');
    const allAccepted=statuses.every(s=>s==='ACCEPTED') && allEntriesPaid(t);
    next.append(el('p',t.draw && allAccepted?'Las llaves ya están disponibles.':statuses.includes('REJECTED')?'Hay una invitación rechazada. El sorteo permanece detenido.':`El sorteo requiere todos los cargos aceptados, los pagos acreditados y la asistencia de todos los jugadores. Cargos aceptados (${statuses.filter(s=>s==='ACCEPTED').length}/${statuses.length} cargos).`));
    if(t.draw && allAccepted){const link=el('a','Ver llaves →','format-choice');link.href='#tournamentDraw';next.append(link);}root.append(next);clock();return root;
  }
  return {render,clock,destroy(){cancelAnimationFrame(frame);actionId++;root.replaceChildren();headerStats?.remove();}};
}
