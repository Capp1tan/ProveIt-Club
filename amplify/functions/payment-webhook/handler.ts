import { createHmac,timingSafeEqual } from 'node:crypto';
import { reconcilePayment } from '../billing/common';
type Event={requestContext?:{http?:{method?:string}};headers?:Record<string,string>;queryStringParameters?:Record<string,string>;body?:string;isBase64Encoded?:boolean};
export const handler=async(event:Event)=>{
  const response=(statusCode:number)=>({statusCode,headers:{'Content-Type':'text/plain','Cache-Control':'no-store'},body:statusCode<300?'OK':'Not accepted'});
  if(event.requestContext?.http?.method!=='POST')return response(405);
  if((event.body?.length || 0)>20000)return response(413);
  const headers=Object.fromEntries(Object.entries(event.headers || {}).map(([k,v])=>[k.toLowerCase(),v]));
  const query=event.queryStringParameters || {},id=query['data.id'];
  const parts=Object.fromEntries((headers['x-signature'] || '').split(',').map(p=>p.trim().split('=')));
  const requestId=headers['x-request-id'],secret=process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if(!secret || !/^\d{1,30}$/.test(id || '') || !requestId || requestId.length>200 || !/^\d{10,16}$/.test(parts.ts || '') || !/^[a-f0-9]{64}$/i.test(parts.v1 || ''))return response(401);
  const expected=createHmac('sha256',secret).update(`id:${id.toLowerCase()};request-id:${requestId};ts:${parts.ts};`).digest();
  if(!timingSafeEqual(expected,Buffer.from(parts.v1,'hex')))return response(401);
  // Se admiten reintentos antiguos firmados: los efectos son idempotentes.
  try {const body=JSON.parse(event.isBase64Encoded?Buffer.from(event.body || '','base64').toString('utf8'):event.body || '{}');if(String(body.data?.id)!==id || body.type!=='payment')return response(400);}
  catch{return response(400);}
  try {await reconcilePayment(id);return response(200);}
  catch(error){console.error('payment_reconciliation_failed',{name:(error as Error).name});return response(503);}
};
