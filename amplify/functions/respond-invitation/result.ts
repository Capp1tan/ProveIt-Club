// El resultado 1v1 es definitivo: sólo el árbitro acordado puede registrarlo.
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
export async function recordDuelResult(db: DynamoDBDocumentClient, sub: string, tournamentId: string, winnerProfileId: string) {
  const TableName=process.env.TOURNAMENT_TABLE_NAME!;
  const read=async()=> (await db.send(new GetCommand({TableName,Key:{id:tournamentId},ConsistentRead:true}))).Item;
  const t=await read();
  if(t?.creationPaymentStatus==='REVERSED')throw new Error('El pago de creación fue revertido. Contactá al administrador.');
  if(!t || t.format!=='DUEL' || t.participantIds.length!==2) throw new Error('El registro de ganador está disponible para Duelo 1v1.');
  if(!t.startsAt || !Number.isFinite(Date.parse(t.startsAt)) || Date.now()<Date.parse(t.startsAt)) throw new Error('Todavía no llegó el horario de inicio.');
  if(!t.participantIds.includes(winnerProfileId)) throw new Error('Elegí uno de los participantes del duelo.');
  let decidedByLabel='Organizador';
  if(t.arbitrationMode==='ORGANIZER') {
    if(t.createdBySub!==sub) throw new Error('En este torneo sólo el organizador puede decidir el resultado.');
  } else {
    const judges=await Promise.all((t.judgeIds || []).map(async(id:string)=>(await db.send(new GetCommand({TableName:process.env.PROFILE_TABLE_NAME!,Key:{id},ConsistentRead:true}))).Item));
    const judge=judges.find(profile=>profile?.owner?.split('::')[0]===sub);
    if(!judge) throw new Error('Sólo un juez designado puede registrar el resultado.');
    decidedByLabel='Juez: '+judge.nickname;
  }
  // Reintentar la misma decisión es seguro; una distinta nunca pisa la anterior.
  if(t.winnerProfileId) {
    if(t.winnerProfileId===winnerProfileId && t.decidedBySub===sub) return t;
    throw new Error('Este duelo ya tiene un resultado definitivo.');
  }
  if(t.status!=='READY' || !t.draw || !Array.isArray(t.rosterStatuses) || !t.rosterStatuses.every((state:string)=>state==='ACCEPTED')) throw new Error('Faltan confirmaciones o el sorteo del duelo.');
  const winnerName=t.participantNames[t.participantIds.indexOf(winnerProfileId)],now=new Date().toISOString();
  try {
    const result=await db.send(new UpdateCommand({TableName,Key:{id:tournamentId},
      UpdateExpression:'SET winnerProfileId = :winner, winnerName = :name, decidedBySub = :sub, decidedByLabel = :label, decidedAt = :now, updatedAt = :now, #status = :completed',
      ConditionExpression:'attribute_not_exists(winnerProfileId) AND #status = :ready AND membershipRevision = :revision',
      ExpressionAttributeNames:{'#status':'status'},
      ExpressionAttributeValues:{':winner':winnerProfileId,':name':winnerName,':sub':sub,':label':decidedByLabel,':now':now,':completed':'COMPLETED',':ready':'READY',':revision':t.membershipRevision || 0},ReturnValues:'ALL_NEW'}));
    return result.Attributes;
  } catch(error) {
    if((error as Error).name!=='ConditionalCheckFailedException') throw error;
    const latest=await read();
    if(latest?.winnerProfileId===winnerProfileId && latest.decidedBySub===sub) return latest;
    throw new Error('El estado del duelo cambió. Actualizá antes de continuar.');
  }
}
