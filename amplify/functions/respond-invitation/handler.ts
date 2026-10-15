// Respuesta y sorteo atómicos, con control de revisión para confirmaciones simultáneas.
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { createDraw } from './draw';
const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));
export const handler = async (event: { identity?: { sub?: string }; arguments: { invitationId?: string; accept?: boolean; tournamentId?: string } }) => {
  const sub=event.identity?.sub;
  // Recupera también un torneo de 2.2.0 que ya tenía todas sus invitaciones aceptadas.
  if (event.arguments.tournamentId) {
    if (!sub) throw new Error('Iniciá sesión.');
    const table=process.env.TOURNAMENT_TABLE_NAME!;
    const key={id:event.arguments.tournamentId};
    const t=(await db.send(new GetCommand({TableName:table,Key:key,ConsistentRead:true}))).Item;
    if(!t || t.createdBySub!==sub) throw new Error('Sólo el organizador puede preparar este sorteo.');
    if(t.draw) return t;
    if(!Array.isArray(t.rosterStatuses) || !t.rosterStatuses.length || !t.rosterStatuses.every((s:string)=>s==='ACCEPTED')) throw new Error('Faltan confirmaciones.');
    const draw=createDraw(t),now=new Date().toISOString();
    try {
      await db.send(new TransactWriteCommand({TransactItems:[{Update:{TableName:table,Key:key,
        UpdateExpression:'SET #draw = :draw, #status = :ready, updatedAt = :now',
        ConditionExpression:'attribute_exists(id) AND attribute_not_exists(#draw)',
        ExpressionAttributeNames:{'#draw':'draw','#status':'status'},
        ExpressionAttributeValues:{':draw':draw,':ready':'READY',':now':now}}}]}));
      return {...t,draw,status:'READY',updatedAt:now};
    } catch(error) {
      if((error as Error).name!=='TransactionCanceledException') throw error;
      const latest=(await db.send(new GetCommand({TableName:table,Key:key,ConsistentRead:true}))).Item;
      if(latest?.draw) return latest;
      throw error;
    }
  }
  const {invitationId,accept}=event.arguments;
  if(!sub || typeof invitationId!=='string' || invitationId.length>200 || typeof accept!=='boolean') throw new Error('Respuesta inválida.');
  if (accept) {
    const account = (await db.send(new GetCommand({ TableName: process.env.ACCOUNT_TABLE_NAME!, Key: { id: sub }, ConsistentRead: true }))).Item;
    if (!account?.phoneNumber) throw new Error('Completá tu teléfono en Mi perfil antes de aceptar.');
  }
  const TableName=process.env.INVITATION_TABLE_NAME!, tournamentTable=process.env.TOURNAMENT_TABLE_NAME!;
  const read=()=>db.send(new GetCommand({TableName,Key:{id:invitationId},ConsistentRead:true}));
  const status=accept?'ACCEPTED':'REJECTED';
  for(let attempt=0;attempt<5;attempt++) {
    const invitation=(await read()).Item;
    if(!invitation || invitation.recipientSub!==sub) throw new Error('Esta invitación no te pertenece.');
    if(invitation.status!=='PENDING') {
      if(invitation.status===status) return invitation;
      throw new Error('Ya respondiste esta invitación.');
    }
    const index=invitation.rosterIndex;
    if(!Number.isInteger(index) || index<0 || index>80) throw new Error('Invitación inválida.');
    const tournament=(await db.send(new GetCommand({TableName:tournamentTable,Key:{id:invitation.tournamentId},ConsistentRead:true}))).Item;
    if(!tournament || !Array.isArray(tournament.rosterStatuses) || tournament.rosterStatuses[index]!=='PENDING') throw new Error('El torneo ya no espera esta respuesta.');
    const statuses=[...tournament.rosterStatuses]; statuses[index]=status;
    const allAccepted=statuses.every(value=>value==='ACCEPTED');
    const draw=tournament.draw || (allAccepted?createDraw(tournament):null);
    const revision=tournament.membershipRevision || 0,now=new Date().toISOString();
    const names:Record<string,string>={'#status':'status'};
    const values:Record<string,any>={':statuses':statuses,':status':allAccepted?'READY':statuses.includes('REJECTED')?'NEEDS_REPLACEMENT':'AWAITING_RESPONSES',':now':now,':next':revision+1,':previous':revision};
    let update='SET rosterStatuses = :statuses, #status = :status, updatedAt = :now, membershipRevision = :next';
    if(draw) { update+=', #draw = :draw'; names['#draw']='draw'; values[':draw']=draw; }
    try {
      await db.send(new TransactWriteCommand({TransactItems:[
        {Update:{TableName,Key:{id:invitationId},UpdateExpression:'SET #status = :status, updatedAt = :now',
          ConditionExpression:'recipientSub = :sub AND #status = :pending',ExpressionAttributeNames:{'#status':'status'},
          ExpressionAttributeValues:{':status':status,':now':now,':sub':sub,':pending':'PENDING'}}},
        {Update:{TableName:tournamentTable,Key:{id:invitation.tournamentId},UpdateExpression:update,
          ConditionExpression:'attribute_exists(id) AND (attribute_not_exists(membershipRevision) OR membershipRevision = :previous)',
          ExpressionAttributeNames:names,ExpressionAttributeValues:values}},
      ]}));
      return {...invitation,status,updatedAt:now};
    } catch(error) {
      if((error as Error).name!=='TransactionCanceledException') throw error;
      // Otra respuesta avanzó la revisión: volver a leer, sin sobrescribirla ni sortear de nuevo.
    }
  }
  throw new Error('Hay respuestas simultáneas. Actualizá y volvé a intentar.');
};
