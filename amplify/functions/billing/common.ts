// Sólo servidor: importes en centavos, claves en secretos y comprobación contra MP.
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
export const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));
export const table = (key: string) => process.env[key]!;
export const read = async (key: string, id: string): Promise<any> => (await db.send(new GetCommand({TableName:table(key),Key:{id},ConsistentRead:true}))).Item;
export const mode = () => process.env.MERCADOPAGO_MODE === 'live' ? 'LIVE' : 'TEST';
export async function mp(path: string, body?: any, method?:string): Promise<any> {
  const token=process.env.MERCADOPAGO_ACCESS_TOKEN;
  if(!token) throw new Error('Los pagos todavía no están configurados.');
  const response=await fetch('https://api.mercadopago.com'+path,{method:method || (body?'POST':'GET'),headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(8000)});
  if(!response.ok) {
    // Nunca devolver respuestas del proveedor con datos privados o credenciales.
    console.warn('mercadopago_api_error',{status:response.status,path:path.split('?')[0]});
    throw new Error('Mercado Pago no pudo procesar la solicitud. Intentá nuevamente o contactá al organizador.');
  }
  return response.json();
}
export async function isCreator(sub: string) {return (await read('CLAIM_TABLE_NAME','creator'))?.accountSub===sub;}
export async function fee() {
  const settings=await read('BILLING_SETTINGS_TABLE_NAME','creation');
  return {amountCents:settings?.amountCents ?? 100,currency:'ARS',enabled:settings?.enabled ?? true,mode:mode()};
}
export async function assertBillingAccess(sub:string) {
  if(mode()==='TEST' && !await isCreator(sub))throw new Error('Los pagos están en preparación. Por ahora sólo el Creador puede probar el proceso.');
}
export function publicCheckout(row:any) {
  // Las mutaciones no necesitan enviar el borrador ni el identificador del pagador.
  return {id:row.id,tournamentName:row.tournamentName,createdBySub:row.createdBySub,status:row.status,amountCents:row.amountCents,currency:row.currency,paymentMode:row.paymentMode,checkoutUrl:row.deletedAt?null:row.checkoutUrl,expiresAt:row.expiresAt,createdAt:row.createdAt,updatedAt:row.updatedAt,deletedAt:row.deletedAt};
}
export async function ensureCheckout(row:any,sub:string) {
  if(row.createdBySub!==sub)throw new Error('Esta solicitud no te pertenece.');
  if(row.deletedAt)throw new Error('La solicitud o el torneo fueron eliminados. No vuelvas a pagar este enlace.');
  if(row.status==='APPROVED' || row.checkoutUrl || row.status==='REVERSED')return publicCheckout(row);
  if(Date.parse(row.expiresAt)<=Date.now())throw new Error('La solicitud venció. Creá un nuevo borrador.');
  if(row.paymentMode!==mode())throw new Error('Esta solicitud pertenece a otro entorno de pagos. Creá un nuevo borrador.');
  const now=new Date().toISOString(),lease=Date.now()+45000;
  try {await db.send(new UpdateCommand({TableName:table('PAYMENT_TABLE_NAME'),Key:{id:row.id},UpdateExpression:'SET leaseUntil = :lease',ConditionExpression:'attribute_not_exists(checkoutUrl) AND (#s = :pending) AND (attribute_not_exists(leaseUntil) OR leaseUntil < :now)',ExpressionAttributeNames:{'#s':'status'},ExpressionAttributeValues:{':lease':lease,':now':Date.now(),':pending':'PENDING'}}));}
  catch(error){if((error as Error).name!=='ConditionalCheckFailedException')throw error;return publicCheckout(await read('PAYMENT_TABLE_NAME',row.id));}
  try {
    const account=await mp('/users/me');
    if(account.site_id!=='MLA')throw new Error('La cuenta de cobro debe operar en Argentina.');
    const back='https://proveitclub.win/pago.html?id='+encodeURIComponent(row.id);
    const preference=await mp('/checkout/preferences',{
      items:[{id:'tournament-creation',title:'ProveIt Club — creación de torneo',description:'Servicio de organización de un torneo',currency_id:'ARS',quantity:1,unit_price:row.amountCents/100}],
      external_reference:row.id,metadata:{proveit_checkout:row.id},
      back_urls:{success:back,pending:back,failure:back},auto_return:'approved',
      notification_url:process.env.PAYMENT_WEBHOOK_URL,
      expires:true,expiration_date_from:now,expiration_date_to:row.expiresAt,
      payment_methods:{excluded_payment_types:[{id:'ticket'},{id:'atm'}],installments:1},
      statement_descriptor:'PROVEIT CLUB',
    });
    const checkoutUrl=row.paymentMode==='TEST' ? preference.sandbox_init_point : preference.init_point;
    if(!/^https:\/\/(?:www|sandbox)\.mercadopago\.com\.ar\//.test(checkoutUrl || ''))throw new Error('Mercado Pago no devolvió una dirección de cobro válida.');
    await db.send(new UpdateCommand({TableName:table('PAYMENT_TABLE_NAME'),Key:{id:row.id},UpdateExpression:'SET checkoutUrl=:url, preferenceId=:pref, collectorId=:collector, updatedAt=:now REMOVE leaseUntil',ConditionExpression:'leaseUntil=:lease AND #s=:pending',ExpressionAttributeNames:{'#s':'status'},ExpressionAttributeValues:{':url':checkoutUrl,':pref':String(preference.id),':collector':String(account.id),':now':now,':lease':lease,':pending':'PENDING'}}));
    return publicCheckout({...row,checkoutUrl,updatedAt:now});
  } catch(error) {
    // No se comparte ningún checkout si no se pudo guardar su referencia primero.
    await db.send(new UpdateCommand({TableName:table('PAYMENT_TABLE_NAME'),Key:{id:row.id},UpdateExpression:'REMOVE leaseUntil',ConditionExpression:'leaseUntil=:lease',ExpressionAttributeValues:{':lease':lease}})).catch(()=>{});
    throw error;
  }
}
export async function reconcilePayment(paymentId:string) {
  if(!/^\d{1,30}$/.test(paymentId))return;
  // El cuerpo del webhook y el retorno del navegador nunca son prueba del cobro.
  const payment=await mp('/v1/payments/'+paymentId);
  if(!/^[0-9a-f-]{36}$/i.test(payment.external_reference || ''))return;
  const row=await read('PAYMENT_TABLE_NAME',payment.external_reference);
  if(!row || !row.collectorId || String(payment.collector_id)!==row.collectorId)return;
  if(payment.live_mode!==(row.paymentMode==='LIVE') || row.paymentMode!==mode() || payment.currency_id!=='ARS')return;
  const amount=Number(payment.transaction_amount);
  if(!Number.isFinite(amount) || Math.round(amount*100)!==row.amountCents)return;
  if(payment.metadata?.proveit_checkout!==row.id)return;
  const now=new Date().toISOString();
  if(['refunded','charged_back'].includes(payment.status) && row.paymentId===String(payment.id)) {
    if(row.status==='REVERSED')return;
    // Se conserva el registro: nunca se borra el torneo ni se inicia una devolución.
    await db.send(new TransactWriteCommand({TransactItems:[
      {Update:{TableName:table('PAYMENT_TABLE_NAME'),Key:{id:row.id},UpdateExpression:'SET #s=:s, updatedAt=:now',ConditionExpression:'paymentId=:pid',ExpressionAttributeNames:{'#s':'status'},ExpressionAttributeValues:{':s':'REVERSED',':now':now,':pid':String(payment.id)}}},
      {Update:{TableName:table('TOURNAMENT_TABLE_NAME'),Key:{id:row.id},UpdateExpression:'SET creationPaymentStatus=:s, updatedAt=:now, membershipRevision=if_not_exists(membershipRevision,:zero)+:one',ConditionExpression:'attribute_exists(id)',ExpressionAttributeValues:{':s':'REVERSED',':now':now,':zero':0,':one':1}}},
    ]}));return;
  }
  if(payment.status!=='approved' || Number(payment.transaction_amount_refunded || 0)>0 || row.status==='REVERSED')return;
  const expire=()=>mp('/checkout/preferences/'+encodeURIComponent(row.preferenceId),{expires:true,expiration_date_to:now},'PUT').catch(()=>{console.warn('preference_expiration_pending');});
  if(row.status==='APPROVED'){if(row.paymentId===String(payment.id))await expire();return;}
  if(row.deletedAt || await read('CLAIM_TABLE_NAME','deleted-account:'+row.createdBySub)) {await expire();return;}
  const payload=JSON.parse(row.payload);
  // Una única transacción publica torneo, invitaciones y recibo interno.
  const tournament={...payload.tournament,creationPaymentStatus:'APPROVED',paymentMode:row.paymentMode,updatedAt:now};
  try {await db.send(new TransactWriteCommand({TransactItems:[
    {Put:{TableName:table('CLAIM_TABLE_NAME'),Item:{id:'payment:'+String(payment.id),accountSub:row.createdBySub,createdAt:now,updatedAt:now,__typename:'UniqueClaim'},ConditionExpression:'attribute_not_exists(id)'}},
    {Put:{TableName:table('TOURNAMENT_TABLE_NAME'),Item:tournament,ConditionExpression:'attribute_not_exists(id)'}},
    ...payload.invites.map((invite:any)=>({Put:{TableName:table('INVITATION_TABLE_NAME'),Item:{...invite,createdAt:now,updatedAt:now},ConditionExpression:'attribute_not_exists(id)'}})),
    {Update:{TableName:table('PAYMENT_TABLE_NAME'),Key:{id:row.id},UpdateExpression:'SET #s=:approved, paymentId=:pid, updatedAt=:now',ConditionExpression:'#s=:pending AND attribute_not_exists(deletedAt)',ExpressionAttributeNames:{'#s':'status'},ExpressionAttributeValues:{':approved':'APPROVED',':pending':'PENDING',':pid':String(payment.id),':now':now}}},
    {ConditionCheck:{TableName:table('CLAIM_TABLE_NAME'),Key:{id:'deleted-account:'+row.createdBySub},ConditionExpression:'attribute_not_exists(id)'}},
  ]}));}
  catch(error) {if((error as Error).name!=='TransactionCanceledException' || (await read('PAYMENT_TABLE_NAME',row.id))?.status!=='APPROVED')throw error;}
  // Reduce la posibilidad de volver a pagar usando un enlace guardado.
  // Si MP falla, una notificación repetida reintenta el vencimiento.
  await expire();
}
