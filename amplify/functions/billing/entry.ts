import {TransactWriteCommand} from '@aws-sdk/lib-dynamodb';
import {db,read,table,mode,ensureCheckout} from './common';
import {entryAmount,entryCheckoutId} from './entry-policy';
import {assertActiveTournament,phoneOptional} from '../lifecycle';
export async function prepareEntry(sub:string,args:any){
 if(typeof args.invitationId!=='string' || args.invitationId.length>200)throw new Error('Invitación inválida.');
 const i=await read('INVITATION_TABLE_NAME',args.invitationId);if(!i || i.recipientSub!==sub || i.role!=='PARTICIPANT')throw new Error('Esta inscripción no te pertenece.');
 const t=await read('TOURNAMENT_TABLE_NAME',i.tournamentId);assertActiveTournament(t);
 if(t.winnerProfileId || t.status==='COMPLETED')throw new Error('Este torneo ya finalizó.');
 const amount=entryAmount(t);if(!amount)throw new Error('Este torneo no requiere un pago de inscripción.');
 if(i.status!=='PENDING' || t.participantIds[i.rosterIndex]!==i.profileId || t.rosterStatuses[i.rosterIndex]!=='PENDING')throw new Error('El torneo ya no espera esta inscripción.');
 if(args.acceptTerms!==true || args.termsVersion!==(t.termsVersion || 0) || (i.termsVersion || 0)!==(t.termsVersion || 0))throw new Error('Aceptá las condiciones vigentes antes de pagar.');
 const noJudge=t.arbitrationMode==='ORGANIZER';if(noJudge && (args.acceptOrganizerDecision!==true || t.consentVersion!=='NO_JUDGE_V1'))throw new Error('Aceptá que el organizador decide el resultado.');
 const account=await read('ACCOUNT_TABLE_NAME',sub);if(!account?.phoneNumber && !await phoneOptional(sub))throw new Error('Completá tu teléfono en Mi perfil antes de pagar.');
 const id=entryCheckoutId(t.id,i.profileId),existing=await read('PAYMENT_TABLE_NAME',id);
 if(existing)return ensureCheckout(existing,sub);
 const now=new Date().toISOString(),request={id,kind:'ENTRY',tournamentId:t.id,participantProfileId:i.profileId,rosterIndex:i.rosterIndex,createdBySub:sub,tournamentName:t.name,status:'PENDING',amountCents:amount,currency:'ARS',paymentMode:mode(),
  payload:JSON.stringify({invitationId:i.id,termsVersion:t.termsVersion || 0,acceptOrganizerDecision:noJudge}),expiresAt:new Date(Date.now()+30*60*1000).toISOString(),createdAt:now,updatedAt:now,__typename:'TournamentPayment'};
 try{await db.send(new TransactWriteCommand({TransactItems:[
  {ConditionCheck:{TableName:table('CLAIM_TABLE_NAME'),Key:{id:'deleted-account:'+sub},ConditionExpression:'attribute_not_exists(id)'}},
  {ConditionCheck:{TableName:table('TOURNAMENT_TABLE_NAME'),Key:{id:t.id},ConditionExpression:'attribute_not_exists(deletedAt) AND attribute_not_exists(winnerProfileId) AND termsVersion=:tv',ExpressionAttributeValues:{':tv':t.termsVersion || 0}}},
  {Put:{TableName:table('PAYMENT_TABLE_NAME'),Item:request,ConditionExpression:'attribute_not_exists(id)'}},
 ]}));}catch(error){if((error as Error).name!=='TransactionCanceledException')throw error;const saved=await read('PAYMENT_TABLE_NAME',id);if(!saved)throw new Error('Las condiciones cambiaron. Actualizá antes de pagar.');return ensureCheckout(saved,sub);}
 return ensureCheckout(request,sub);
}
