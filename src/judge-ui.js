import {communityAction} from './community-api.js';
import '../community.css';
const el=(tag,text,cls)=>{const n=document.createElement(tag);n.textContent=text;if(cls)n.className=cls;return n;};
export function judgePanel(t,{isOrganizer,onChanged}){
 const root=el('section','','tournament-panel');root.append(el('h2',t.judgeIds?.length?'Condiciones y reputación de jueces':'Condiciones del torneo'));
 if(t.judgeIds?.length)root.append(el('p','Condiciones versión '+(t.termsVersion || 0)+'. Cada juez acepta el cargo y confirma que entiende las reglas. Los cambios materiales requieren una nueva aceptación de todos.'));
 if(t.conflicts)root.append(el('p','Conflictos de interés declarados: '+t.conflicts,'arbitration-warning'));
 if(t.judgeIds?.some(id=>t.participantIds.includes(id)))root.append(el('p','Un juez también compite. Su interés se declara a todos los integrantes.','arbitration-warning'));
 if(t.judgeIds?.length)root.append(el('small','Los vínculos personales se declaran por los integrantes; el sitio no puede descubrirlos automáticamente. Las recompensas del club requieren un juez independiente.'));
 if(isOrganizer && !t.winnerProfileId){
  const form=el('form','','community-form'),rules=el('textarea'),conflicts=el('textarea'),submit=el('button','Actualizar y pedir nueva aceptación','social-button'),message=el('p','','community-notice');
  rules.value=t.description || '';rules.required=true;rules.minLength=10;rules.maxLength=1000;rules.rows=3;conflicts.value=t.conflicts || '';conflicts.maxLength=500;conflicts.rows=2;
  const r=el('label','Reglas vigentes'),c=el('label','Conflictos de interés');r.append(rules);c.append(conflicts);submit.type='submit';message.setAttribute('role','status');
  form.append(r,c,submit,message);form.addEventListener('submit',async e=>{e.preventDefault();if(submit.disabled)return;if(!confirm('Los cruces se pausarán y todos deberán aceptar nuevamente. ¿Actualizar las condiciones?'))return;submit.disabled=true;try{await communityAction('TERMS',{tournamentId:t.id,description:rules.value,conflicts:conflicts.value});await onChanged();}catch(e){message.textContent=e.message;submit.disabled=false;}});root.append(form);
 }
 t.judgeIds?.forEach((id,index)=>{
  const card=el('article','','judge-feedback'),link=el('a',t.judgeNames[index]);link.href='/perfil.html?id='+encodeURIComponent(id);card.append(link);
  const message=el('p','','community-notice');message.setAttribute('role','status');
  const actions=el('div','','judge-actions');
  if(t.status==='COMPLETED')for(const [positive,label] of [[true,'👍 Valoración positiva'],[false,'👎 Valoración negativa']]){
   const b=el('button',label,'social-button');b.type='button';b.addEventListener('click',async()=>{actions.querySelectorAll('button').forEach(n=>n.disabled=true);try{await communityAction('RATE',{tournamentId:t.id,judgeId:id,positive});message.textContent='Valoración registrada. Gracias.';}catch(e){message.textContent=e.message;actions.querySelectorAll('button').forEach(n=>n.disabled=false);}});actions.append(b);
  }
  const report=el('button','Presentar reclamo','social-button');report.type='button';
  report.addEventListener('click',()=>{if(card.querySelector('form'))return;const form=el('form','','community-form'),reason=el('textarea'),label=el('label','Explicá qué ocurrió'),send=el('button','Enviar a revisión del administrador','social-button');reason.required=true;reason.minLength=10;reason.maxLength=1000;reason.rows=3;label.append(reason);send.type='submit';form.append(label,send);form.addEventListener('submit',async e=>{e.preventDefault();send.disabled=true;try{await communityAction('REPORT',{tournamentId:t.id,judgeId:id,reason:reason.value});message.textContent='Reclamo enviado. Sólo afectará el historial si el administrador lo confirma.';form.remove();}catch(e){message.textContent=e.message;send.disabled=false;}});card.append(form);});
  actions.append(report);card.append(actions,el('small','Sólo participantes confirmados pueden valorar o reclamar. Una valoración por juez y evento; no se permiten autoevaluaciones.'),message);root.append(card);
 });return root;
}
export async function mountJudgeReportAdmin(host=document.querySelector('main')){
 const root=el('section','','profile-card');root.append(el('h2','Reclamos de jueces'));host.append(root);
 const status=el('p','Cargando…','community-notice'),list=el('div');root.append(status,list);
 let cursor=null;const more=el('button','Ver más reclamos','social-button');more.type='button';more.hidden=true;root.append(more);
 async function load(){more.disabled=true;try{const data=await communityAction('REPORTS',{cursor});cursor=data.cursor;for(const report of data.reports){const row=el('article','','community-report'),link=el('a',report.tournamentName);link.href='/torneo.html?id='+encodeURIComponent(report.tournamentId);row.append(el('h3',report.judgeName),link,el('p',report.reason),el('p','Estado: '+report.status));if(report.status==='PENDING'){
    const reason=el('textarea');reason.placeholder='Motivo de la revisión administrativa';reason.maxLength=500;row.append(reason);
    for(const [value,label] of [['CONFIRMED','Confirmar reclamo verídico'],['DISMISSED','Desestimar reclamo']]){const button=el('button',label,'social-button');button.type='button';button.addEventListener('click',async()=>{if(reason.value.trim().length<5){status.textContent='Añadí el motivo de tu decisión.';return;}row.querySelectorAll('button').forEach(n=>n.disabled=true);try{await communityAction('REVIEW',{reportId:report.sk,status:value,reason:reason.value});row.append(el('p','Revisión guardada: '+value));status.textContent='Revisión registrada.';}catch(e){status.textContent=e.message;row.querySelectorAll('button').forEach(n=>n.disabled=false);}});row.append(button);}
   }else row.append(el('p','Revisión: '+(report.reviewReason || '')));list.append(row);}status.textContent=list.childElementCount?'Los pendientes no afectan la reputación.':'No hay reclamos.';more.hidden=!cursor;}catch(e){status.textContent=e.message;}finally{more.disabled=false;}}
 more.addEventListener('click',load);await load();
}
