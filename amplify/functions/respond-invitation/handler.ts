// Respuesta y sorteo atómicos, con control de revisión para confirmaciones simultáneas.
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { recordDuelResult } from './result';
import { prizeAction } from './prize';
import { phoneOptional, assertActiveAccount, assertActiveTournament } from '../lifecycle';
import { createDraw } from './draw';
const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const respond = async (event: { identity?: { sub?: string }; arguments: { prizeType?: string; prizeTitle?: string; prizeDescription?: string; prizeLinks?: string; prizeAttachments?: string; prizeRevision?: number; uploadContentType?: string; uploadSize?: number; invitationId?: string; accept?: boolean; tournamentId?: string; winnerProfileId?: string;resultReason?:string;resultKind?:string;acceptTerms?:boolean;termsVersion?:number;prizeHolder?:string;prizeFunder?:string;prizeFundingStatus?:string; acceptOrganizerDecision?: boolean } }) => {
  const sub=event.identity?.sub;
  if(!sub)throw new Error('Iniciá sesión.');
  await assertActiveAccount(sub);
  if ('prizeTitle' in event.arguments || 'uploadContentType' in event.arguments) return prizeAction(db,sub,event.arguments);
  if (event.arguments.winnerProfileId) {
    if (!sub || !event.arguments.tournamentId || typeof event.arguments.winnerProfileId !== 'string' || event.arguments.winnerProfileId.length>128) throw new Error('Resultado inválido.');
    return recordDuelResult(db, sub, event.arguments.tournamentId, event.arguments.winnerProfileId,event.arguments.resultReason,event.arguments.resultKind);
  }
  // Recupera también un torneo de 2.2.0 que ya tenía todas sus invitaciones aceptadas.
  if (event.arguments.tournamentId) {
    if (!sub) throw new Error('Iniciá sesión.');
    const table=process.env.TOURNAMENT_TABLE_NAME!;
    const key={id:event.arguments.tournamentId};
    const t=(await db.send(new GetCommand({TableName:table,Key:key,ConsistentRead:true}))).Item;
    if(!t || t.createdBySub!==sub) throw new Error('Sólo el organizador puede preparar este sorteo.');
    assertActiveTournament(t);
    if(t.creationPaymentStatus==='REVERSED')throw new Error('El pago de creación fue revertido. Contactá al administrador.');
    if(t.draw) return t;
    if(!Array.isArray(t.rosterStatuses) || !t.rosterStatuses.length || !t.rosterStatuses.every((s:string)=>s==='ACCEPTED')) throw new Error('Faltan confirmaciones.');
    const draw=createDraw(t),now=new Date().toISOString();
    try {
      await db.send(new TransactWriteCommand({TransactItems:[{Update:{TableName:table,Key:key,
        UpdateExpression:'SET #draw = :draw, #status = :ready, updatedAt = :now',
        ConditionExpression:'attribute_exists(id) AND attribute_not_exists(deletedAt) AND attribute_not_exists(#draw) AND (attribute_not_exists(creationPaymentStatus) OR creationPaymentStatus=:paid OR creationPaymentStatus=:exempt) AND (attribute_not_exists(membershipRevision) OR membershipRevision=:revision)',
        ExpressionAttributeNames:{'#draw':'draw','#status':'status'},
        ExpressionAttributeValues:{':draw':draw,':ready':'READY',':now':now,':paid':'APPROVED',':exempt':'EXEMPT',':revision':t.membershipRevision || 0}}}]}));
      return {...t,draw,status:'READY',updatedAt:now};
    } catch(error) {
      if((error as Error).name!=='TransactionCanceledException') throw error;
      const latest=(await db.send(new GetCommand({TableName:table,Key:key,ConsistentRead:true}))).Item;
      assertActiveTournament(latest);
      if(latest?.draw) return latest;
      throw error;
    }
  }
  const {invitationId,accept}=event.arguments;
  if(!sub || typeof invitationId!=='string' || invitationId.length>200 || typeof accept!=='boolean') throw new Error('Respuesta inválida.');
  if (accept) {
    const account = (await db.send(new GetCommand({ TableName: process.env.ACCOUNT_TABLE_NAME!, Key: { id: sub }, ConsistentRead: true }))).Item;
    if (!account?.phoneNumber && !await phoneOptional(sub)) throw new Error('Completá tu teléfono en Mi perfil antes de aceptar.');
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
    assertActiveTournament(tournament);
    if(!tournament || !Array.isArray(tournament.rosterStatuses) || tournament.rosterStatuses[index]!=='PENDING') throw new Error('El torneo ya no espera esta respuesta.');
    if(tournament.creationPaymentStatus==='REVERSED')throw new Error('El pago de creación fue revertido. Contactá al administrador.');
    const noJudge = tournament.arbitrationMode === 'ORGANIZER';
    if(accept && (event.arguments.acceptTerms!==true || event.arguments.termsVersion!==(tournament.termsVersion || 0) || (invitation.termsVersion || 0)!==(tournament.termsVersion || 0)))throw new Error('Leé y aceptá las condiciones vigentes. Actualizá la invitación si cambiaron.');
    if (accept && noJudge && (event.arguments.acceptOrganizerDecision !== true || invitation.consentVersion !== 'NO_JUDGE_V1' || tournament.consentVersion !== 'NO_JUDGE_V1')) throw new Error('Para unirte, aceptá que este torneo no tiene juez y el organizador decide el resultado.');
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
        {Update:{TableName,Key:{id:invitationId},UpdateExpression:accept ? 'SET #status = :status, updatedAt = :now, consentAcceptedAt = :now, termsAcceptedAt=:now' : 'SET #status = :status, updatedAt = :now',
          ConditionExpression:'recipientSub = :sub AND #status = :pending AND (attribute_not_exists(termsVersion) OR termsVersion=:tv)',ExpressionAttributeNames:{'#status':'status'},
          ExpressionAttributeValues:{':status':status,':now':now,':sub':sub,':pending':'PENDING',':tv':invitation.termsVersion || 0}}},
        {Update:{TableName:tournamentTable,Key:{id:invitation.tournamentId},UpdateExpression:update,
          ConditionExpression:'attribute_exists(id) AND attribute_not_exists(deletedAt) AND (attribute_not_exists(membershipRevision) OR membershipRevision = :previous)',
          ExpressionAttributeNames:names,ExpressionAttributeValues:values}},
      ]}));
      return {...invitation,status,updatedAt:now,...(accept?{termsAcceptedAt:now}: {})};
    } catch(error) {
      if((error as Error).name!=='TransactionCanceledException') throw error;
      // Otra respuesta avanzó la revisión: volver a leer, sin sobrescribirla ni sortear de nuevo.
    }
  }
  throw new Error('Hay respuestas simultáneas. Actualizá y volvé a intentar.');
};

// Conserva el contrato anterior y publica sólo una señal mínima desde el nuevo flujo.
export const handler=async(event:Parameters<typeof respond>[0] & {fieldName?:string;info?:{fieldName?:string}})=>{
 const result=await respond(event);
 if((event.fieldName || event.info?.fieldName)==='answerTournamentInvitation')return {id:result.id,tournamentId:result.tournamentId,status:result.status,changedAt:result.updatedAt};
 return result;
};
