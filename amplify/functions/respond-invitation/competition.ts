import {GetCommand,UpdateCommand,DynamoDBDocumentClient} from '@aws-sdk/lib-dynamodb';
import {competitionState,usesCompetition,attendanceReady,pendingDrawApprovals,competitionHasBegun,COUNTDOWN_MS,DRAW_COUNTDOWN_MS} from '../../../shared/competition';
import {allEntriesPaid} from '../../../shared/tournament-room';
import {assertActiveTournament} from '../lifecycle';
import {createDraw} from './draw';

// Función pura: el reloj y el sorteo se inyectan para probar el flujo sin AWS ni cobros.
export function changeCompetition(t:any,sub:string,owned:string[],a:any,now=Date.now(),draw=createDraw){
 assertActiveTournament(t);if(!usesCompetition(t))throw new Error('Este encuentro usa el flujo anterior.');
 if(a.action==='DRAW_FINISH' && t.draw){if(sub!==t.createdBySub && !owned.length)throw new Error('Sólo los integrantes pueden completar el sorteo.');return t;}
 if(t.winnerProfileId || t.status==='COMPLETED' || competitionHasBegun(t,now))throw new Error('El encuentro ya comenzó o finalizó. La llave quedó bloqueada.');
 if(!allEntriesPaid(t) || !t.rosterStatuses?.every((s:string)=>s==='ACCEPTED'))throw new Error('Primero deben aceptar todos los cargos y acreditarse las inscripciones.');
 const s=structuredClone(competitionState(t));s.attendance ||= {};s.affected ||= [];s.approvals ||= [];s.changes ||= [];
 let resultDraw=t.draw,status=t.status;const at=new Date(now).toISOString();
 if(a.action==='ATTENDANCE'){
  if(owned.length!==1 || typeof a.ready!=='boolean')throw new Error('Sólo podés confirmar tu propia asistencia.');
  if(!a.ready)throw new Error('La asistencia confirmada no se puede cancelar.');
  const id=owned[0];
  if(s.attendance[id]?.ready===true)return t;
  if(now<Date.parse(t.startsAt))throw new Error('La asistencia se habilita a partir del horario previsto del encuentro.');
  s.attendance[id]={ready:true,at};
 }else if(a.action==='DRAW_SCHEDULE'){
  if(sub!==t.createdBySub)throw new Error('Sólo el organizador puede iniciar el sorteo.');
  if(now<Date.parse(t.startsAt))throw new Error('El sorteo se habilita a la hora programada.');
  if(resultDraw)throw new Error('La llave ya fue sorteada.');
  if(!attendanceReady(t))throw new Error('Todos los jugadores deben estar listos para sortear.');
  if(s.drawAt)return t;
  s.drawAt=new Date(now+DRAW_COUNTDOWN_MS).toISOString();
 }else if(a.action==='DRAW_FINISH'){
  if(sub!==t.createdBySub && !owned.length)throw new Error('Sólo los integrantes pueden completar el sorteo.');
  if(!attendanceReady(t) || !s.drawAt)throw new Error('El sorteo todavía no está preparado.');
  if(now<Date.parse(s.drawAt))throw new Error('Todavía no terminó la cuenta regresiva del sorteo.');
  resultDraw=draw(t);s.originalDraw=resultDraw;s.revision=(s.revision || 0)+1;s.drawnAt=at;s.affected=[];s.approvals=[];
 }else if(a.action==='SWAP'){
  if(sub!==t.createdBySub)throw new Error('Sólo el organizador puede cambiar posiciones.');
  if(!resultDraw || !t.participantIds.includes(a.fromProfileId) || !t.participantIds.includes(a.toProfileId) || a.fromProfileId===a.toProfileId)throw new Error('Elegí dos participantes distintos de la llave.');
  if(a.drawRevision!==s.revision)throw new Error('La llave cambió. Actualizá antes de mover posiciones.');
  const reason=String(a.reason || '').trim();if(reason.length<5 || reason.length>250)throw new Error('Añadí un motivo de 5 a 250 caracteres.');
  if(s.changes.length>=40)throw new Error('Se alcanzó el límite de cambios de la llave.');
  const before=JSON.parse(resultDraw),order=before.order.map((p:any)=>({...p})),x=order.findIndex((p:any)=>p.id===a.fromProfileId),y=order.findIndex((p:any)=>p.id===a.toProfileId);
  [order[x],order[y]]=[order[y],order[x]];
  const next=draw(t,order),oldPairs=opponents(resultDraw),newPairs=opponents(next);
  const affected=t.participantIds.filter((id:string)=>JSON.stringify(oldPairs[id])!==JSON.stringify(newPairs[id]));
  // También requieren aceptación quienes se movieron, aunque todos-contra-todos conserve rivales.
  affected.push(a.fromProfileId,a.toProfileId);s.affected=[...new Set([...s.affected,...affected])];s.approvals=[];
  s.revision++;s.startAt=null;s.changes.push({at,bySub:sub,reason,from:a.fromProfileId,to:a.toProfileId,revision:s.revision,before:oldPairs,after:newPairs});resultDraw=next;
 }else if(a.action==='ACCEPT_DRAW'){
  if(owned.length!==1 || !resultDraw || a.drawRevision!==s.revision)throw new Error('La llave cambió o no podés aceptar por otro jugador.');
  if(!s.affected.includes(owned[0]))throw new Error('Tu posición no requiere una nueva aceptación.');
  s.approvals=[...new Set([...s.approvals,owned[0]])];
 }else throw new Error('Acción del encuentro inválida.');
 if(resultDraw && attendanceReady(t) && pendingDrawApprovals(t,s).length===0){s.startAt ||= new Date(now+COUNTDOWN_MS).toISOString();status='READY';}
 else{s.startAt=null;status=resultDraw?'DRAW_APPROVAL':'CHECK_IN';}
 if(Buffer.byteLength(JSON.stringify(s),'utf8')>220000)throw new Error('La auditoría alcanzó su límite. Conservá esta llave o creá un nuevo torneo.');
 return {...t,draw:resultDraw || null,status,competitionState:JSON.stringify(s),membershipRevision:(t.membershipRevision || 0)+1,updatedAt:at};
}
function opponents(value:string):Record<string,any>{
 const d=JSON.parse(value),out:Record<string,any>={};d.order.forEach((p:any)=>out[p.id]=[]);
 for(const round of d.rounds)for(const m of round.matches){if(m.entrants){for(const p of m.entrants)out[p.id]?.push({match:m.id,rivals:m.entrants.filter((q:any)=>q.id!==p.id).map((q:any)=>q.id)});continue;}
  if(m.left?.playerId)out[m.left.playerId]?.push({match:m.id,rival:m.right?.playerId || null});if(m.right?.playerId)out[m.right.playerId]?.push({match:m.id,rival:m.left?.playerId || null});}
 return out;
}
export async function competitionAction(db:DynamoDBDocumentClient,sub:string,a:any){
 if(typeof a.tournamentId!=='string'||!/^[a-f0-9-]{36}$/i.test(a.tournamentId))throw new Error('Torneo inválido.');
 const TableName=process.env.TOURNAMENT_TABLE_NAME!,Key={id:a.tournamentId};
 for(let attempt=0;attempt<5;attempt++){
  const t=(await db.send(new GetCommand({TableName,Key,ConsistentRead:true}))).Item;assertActiveTournament(t);
  const profiles=await Promise.all(t!.participantIds.map(async(id:string)=>(await db.send(new GetCommand({TableName:process.env.PROFILE_TABLE_NAME!,Key:{id},ConsistentRead:true}))).Item));
  const owned=profiles.filter(p=>p?.owner?.split('::')[0]===sub).map(p=>p!.id),next=changeCompetition(t,sub,owned,a);
  if(next===t)return t;
  try{await db.send(new UpdateCommand({TableName,Key,UpdateExpression:'SET #s=:s,#d=:d,competitionState=:cs,membershipRevision=:next,updatedAt=:now',ConditionExpression:'attribute_exists(id) AND attribute_not_exists(deletedAt) AND attribute_not_exists(winnerProfileId) AND membershipRevision=:previous',ExpressionAttributeNames:{'#s':'status','#d':'draw'},ExpressionAttributeValues:{':s':next.status,':d':next.draw,':cs':next.competitionState,':next':next.membershipRevision,':now':next.updatedAt,':previous':t!.membershipRevision || 0}}));return next;}
  catch(e){if((e as Error).name!=='ConditionalCheckFailedException'||attempt===4)throw e;}
 }
 throw new Error('Hay cambios simultáneos. Actualizá para continuar.');
}
