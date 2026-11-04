import {prepareEntry} from './entry';
import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { assertActiveAccount } from '../lifecycle';
import { db,table,read,fee,mode,isCreator,creationExemption,assertBillingAccess,ensureCheckout,publicCheckout,mp,reconcilePayment,finishEntry } from './common';
type Event={fieldName?:string;info?:{fieldName:string};identity?:{sub?:string};arguments:Record<string,any>};
export const handler=async(event:Event)=>{
  const sub=event.identity?.sub;if(!sub)throw new Error('Iniciá sesión.');
  await assertActiveAccount(sub);
  const args=event.arguments || {},operation=event.fieldName || event.info?.fieldName || ('amountCents' in args?'setTournamentFee':args.checkoutId?'checkTournamentPayment':'getTournamentFee');
  if(operation==='getTournamentFee'){
    const pricing=await fee();return {...pricing,exempt:true,exemptionSource:'FREE_CREATION',canPay:true};
  }
  if(operation==='setTournamentFee') {
    if(!await isCreator(sub))throw new Error('Sólo el Creador puede cambiar la tarifa.');
    if(!Number.isSafeInteger(args.amountCents) || args.amountCents<50000 || args.amountCents>100000000 || typeof args.enabled!=='boolean')throw new Error('Revisá el precio. La inscripción mínima es de $500 ARS.');
    if(args.freeEntries!=null && typeof args.freeEntries!=='boolean')throw new Error('Revisá la opción de inscripciones gratis.');
    const freeUpdate=typeof args.freeEntries==='boolean';
    await db.send(new UpdateCommand({TableName:table('BILLING_SETTINGS_TABLE_NAME'),Key:{id:'participation'},UpdateExpression:'SET amountCents=:a, enabled=:e, updatedAt=:now, createdAt=if_not_exists(createdAt,:now), #t=:t'+(freeUpdate?', freeEntries=:free':''),ExpressionAttributeNames:{'#t':'__typename'},ExpressionAttributeValues:{...(freeUpdate?{':free':args.freeEntries}:{}),':a':args.amountCents,':e':args.enabled,':now':new Date().toISOString(),':t':'BillingSettings'}}));
    const pricing=await fee();return {...pricing,exempt:true,canPay:true};
  }
  await assertBillingAccess(sub);
  if(operation==='prepareTournamentEntryPayment')return prepareEntry(sub,args);
  if(!/^[0-9a-f-]{36}$/i.test(args.checkoutId || ''))throw new Error('Solicitud inválida.');
  let row=await read('PAYMENT_TABLE_NAME',args.checkoutId);
  if(!row || row.createdBySub!==sub)throw new Error('Solicitud no encontrada para tu cuenta.');
  if(row.status==='EXEMPT')return publicCheckout(row);
  if(row.kind!=='ENTRY' && row.status==='PENDING')throw new Error('Crear torneos ahora es gratis. No pagues este enlace anterior.');
  if(row.paymentMode!==mode())throw new Error('Esta solicitud pertenece al entorno anterior. Creá un torneo nuevo para obtener un pago real.');
  if(row.deletedAt)return publicCheckout(row);
  if(row.kind==='ENTRY' && row.status==='APPROVED'){const confirmed=await finishEntry(row);return publicCheckout({...row,entryConfirmed:confirmed});}
  // Límite compartido por cuenta/solicitud: el polling no dispara búsquedas sin fin.
  if(row.status==='PENDING' && row.preferenceId && (!row.lastCheckedAt || Date.now()-row.lastCheckedAt>15000)) {
    try {
      await db.send(new UpdateCommand({TableName:table('PAYMENT_TABLE_NAME'),Key:{id:row.id},UpdateExpression:'SET lastCheckedAt=:now',ConditionExpression:'attribute_not_exists(lastCheckedAt) OR lastCheckedAt < :before',ExpressionAttributeValues:{':now':Date.now(),':before':Date.now()-15000}}));
      const found=await mp('/v1/payments/search?external_reference='+encodeURIComponent(row.id)+'&sort=date_created&criteria=desc&limit=20');
      for(const payment of found.results || [])if(['approved','refunded','charged_back'].includes(payment.status))await reconcilePayment(String(payment.id));
      row=await read('PAYMENT_TABLE_NAME',row.id);
    }catch(error){if((error as Error).name!=='ConditionalCheckFailedException')throw error;}
  }
  return row.checkoutUrl || row.status!=='PENDING' ? publicCheckout(row) : ensureCheckout(row,sub);
};
