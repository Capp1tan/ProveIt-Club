import {resolveBracket} from '../../../shared/tournament-bracket';
import {competitionStart,usesCompetition,attendanceReady,pendingDrawApprovals} from '../../../shared/competition';
// El resultado 1v1 es definitivo: sólo el árbitro acordado puede registrarlo.
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { assertActiveTournament } from '../lifecycle';
import {validatePodium,allEntriesPaid} from '../../../shared/tournament-room';
export async function recordDuelResult(db: DynamoDBDocumentClient, sub: string, tournamentId: string, winnerProfileId: string,resultReason='',resultKind='NORMAL',runnerUpProfileId?:string,thirdPlaceProfileId?:string,matchId?:string) {
  const TableName=process.env.TOURNAMENT_TABLE_NAME!;
  const read=async()=> (await db.send(new GetCommand({TableName,Key:{id:tournamentId},ConsistentRead:true}))).Item;
  const t=await read();
  assertActiveTournament(t);
  if(t?.creationPaymentStatus==='REVERSED')throw new Error('El pago de creación fue revertido. Contactá al administrador.');
  if(!t || !t.participantIds?.length)throw new Error('Torneo inválido.');
  if(!['NORMAL','DISPUTED','SANCTION'].includes(resultKind) || typeof resultReason!=='string' || resultReason.length>500 || (resultKind!=='NORMAL' && resultReason.trim().length<10))throw new Error('Los resultados discutidos y las sanciones necesitan un motivo de 10 a 500 caracteres.');
  if(!Number.isFinite(competitionStart(t)) || Date.now()<competitionStart(t) || (usesCompetition(t) && (!attendanceReady(t) || pendingDrawApprovals(t).length>0))) throw new Error('Todavía no llegó el horario de inicio.');
  if(!allEntriesPaid(t))throw new Error('Hay pagos de inscripción pendientes de revisión.');
  if(!t.participantIds.includes(winnerProfileId)) throw new Error('Elegí uno de los participantes del duelo.');
  let decidedByLabel='Organizador';
  if(t.arbitrationMode==='ORGANIZER') {
    if(t.createdBySub!==sub) throw new Error('En este torneo sólo el organizador puede decidir el resultado.');
  } else {
    const judges=await Promise.all((t.judgeIds || []).map(async(id:string)=>(await db.send(new GetCommand({TableName:process.env.PROFILE_TABLE_NAME!,Key:{id},ConsistentRead:true}))).Item));
    const judge=judges.find(profile=>profile?.owner?.split('::')[0]===sub);
    if(judge && t.rosterStatuses?.[t.participantIds.length+t.judgeIds.indexOf(judge.id)]!=='ACCEPTED')throw new Error('Aceptá las condiciones vigentes antes de registrar resultados.');
    if(!judge) throw new Error('Sólo un juez designado puede registrar el resultado.');
    decidedByLabel='Juez: '+judge.nickname;
  }
  const now=new Date().toISOString();
  let nextDraw:string|undefined;
  if(t.format==='DOUBLE_ELIMINATION' && (!t.winnerProfileId || matchId)){
    const draw=JSON.parse(t.draw || '{}');
    const previous=matchId && Object.hasOwn(draw.results || {},matchId)?draw.results[matchId]:null;
    if(previous){
      if(previous.winnerId===winnerProfileId && previous.decidedBySub===sub)return t;
      throw new Error('Este encuentro ya tiene un resultado.');
    }
    if(!matchId || !draw.rounds)throw new Error('Elegí un encuentro de la llave.');
    const match=resolveBracket(draw).get(matchId);
    if(!match?.playable || (winnerProfileId!==match.left && winnerProfileId!==match.right))throw new Error('Elegí un jugador de un encuentro disponible.');
    draw.results={...draw.results,[matchId]:{winnerId:winnerProfileId,kind:resultKind,reason:resultReason.trim(),decidedBySub:sub,decidedAt:now}};
    nextDraw=JSON.stringify(draw);
    if(matchId==='gf'){
      runnerUpProfileId=(winnerProfileId===match.left?match.right:match.left) ?? undefined;
      thirdPlaceProfileId=undefined;
    }
  }else if(matchId)throw new Error('Este formato no admite resultados por encuentro.');
  const podium=validatePodium(t.participantIds,winnerProfileId,runnerUpProfileId,thirdPlaceProfileId);
  const sameResult=(row:any)=>row?.winnerProfileId===winnerProfileId && row.decidedBySub===sub && (row.runnerUpProfileId || null)===podium.runnerUp && (row.thirdPlaceProfileId || null)===podium.thirdPlace;
  // Reintentar la misma decisión es seguro; una distinta nunca pisa la anterior.
  if(t.winnerProfileId) {
    if(sameResult(t)) return t;
    throw new Error('Este duelo ya tiene un resultado definitivo.');
  }
  if(t.status!=='READY' || !t.draw || !Array.isArray(t.rosterStatuses) || !t.rosterStatuses.every((state:string)=>state==='ACCEPTED')) throw new Error('Faltan confirmaciones o el sorteo del duelo.');
  const winnerName=t.participantNames[t.participantIds.indexOf(winnerProfileId)];
  const intermediate=nextDraw && matchId!=='gf';
  const drawGuard=nextDraw?' AND #draw = :oldDraw':'';
  const drawNames=nextDraw?{'#draw':'draw'}:{};
  const drawValues=nextDraw?{':draw':nextDraw,':oldDraw':t.draw}:{};
  try {
    const result=await db.send(new UpdateCommand({TableName,Key:{id:tournamentId},
      UpdateExpression:intermediate?'SET #draw = :draw, updatedAt = :now':'SET winnerProfileId = :winner, winnerName = :name, decidedBySub = :sub, decidedByLabel = :label, decidedAt = :now, updatedAt = :now, #status = :completed, resultReason=:reason, resultKind=:kind, runnerUpProfileId=:second, thirdPlaceProfileId=:third'+(nextDraw?', #draw = :draw':''),
      ConditionExpression:'attribute_not_exists(deletedAt) AND attribute_not_exists(winnerProfileId) AND #status = :ready AND membershipRevision = :revision AND (attribute_not_exists(creationPaymentStatus) OR creationPaymentStatus=:paid OR creationPaymentStatus=:exempt)'+drawGuard,
      ExpressionAttributeNames:{'#status':'status',...drawNames},
      ExpressionAttributeValues:{':ready':'READY',':revision':t.membershipRevision || 0,':paid':'APPROVED',':exempt':'EXEMPT',':now':now,...drawValues,...(intermediate?{}:{':second':podium.runnerUp,':third':podium.thirdPlace,':reason':resultReason.trim(),':kind':resultKind,':winner':winnerProfileId,':name':winnerName,':sub':sub,':label':decidedByLabel,':completed':'COMPLETED'})},ReturnValues:'ALL_NEW'}));
    return result.Attributes;
  } catch(error) {
    if((error as Error).name!=='ConditionalCheckFailedException') throw error;
    const latest=await read();
    const decision=nextDraw && matchId && latest?.draw?JSON.parse(latest.draw).results?.[matchId]:null;
    if(decision?.winnerId===winnerProfileId && decision.decidedBySub===sub)return latest;
    if(!nextDraw && sameResult(latest)) return latest;
    throw new Error('El estado del duelo cambió. Actualizá antes de continuar.');
  }
}
