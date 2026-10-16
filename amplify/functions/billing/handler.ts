import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { assertActiveAccount } from '../lifecycle';
import { db,table,read,fee,isCreator,assertBillingAccess,ensureCheckout,publicCheckout,mp,reconcilePayment } from './common';
type Event={fieldName?:string;info?:{fieldName:string};identity?:{sub?:string};arguments:Record<string,any>};
export const handler=async(event:Event)=>{
  const sub=event.identity?.sub;if(!sub)throw new Error('Iniciá sesión.');
  await assertActiveAccount(sub);
  const args=event.arguments || {},operation=event.fieldName || event.info?.fieldName || ('amountCents' in args?'setTournamentFee':args.checkoutId?'checkTournamentPayment':'getTournamentFee');
  if(operation==='getTournamentFee')return {...await fee(),canPay:await isCreator(sub) || process.env.MERCADOPAGO_MODE==='live'};
  if(operation==='setTournamentFee') {
    if(!await isCreator(sub))throw new Error('Sólo el Creador puede cambiar la tarifa.');
    if(!Number.isSafeInteger(args.amountCents) || args.amountCents<1 || args.amountCents>100000000 || typeof args.enabled!=='boolean')throw new Error('Revisá el precio. Debe ser un importe positivo con hasta dos decimales.');
    await db.send(new UpdateCommand({TableName:table('BILLING_SETTINGS_TABLE_NAME'),Key:{id:'creation'},UpdateExpression:'SET amountCents=:a, enabled=:e, updatedAt=:now, createdAt=if_not_exists(createdAt,:now), #t=:t',ExpressionAttributeNames:{'#t':'__typename'},ExpressionAttributeValues:{':a':args.amountCents,':e':args.enabled,':now':new Date().toISOString(),':t':'BillingSettings'}}));
    return {...await fee(),canPay:true};
  }
  await assertBillingAccess(sub);
  if(!/^[0-9a-f-]{36}$/i.test(args.checkoutId || ''))throw new Error('Solicitud inválida.');
  let row=await read('PAYMENT_TABLE_NAME',args.checkoutId);
  if(!row || row.createdBySub!==sub)throw new Error('Solicitud no encontrada para tu cuenta.');
  if(row.deletedAt)return publicCheckout(row);
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
