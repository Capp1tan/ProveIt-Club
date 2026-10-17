// Amistades y mensajes privados: ninguna tabla tiene acceso directo desde el navegador.
// Las revisiones y las transacciones protegen el cupo frente a aceptaciones simultáneas.
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient,GetCommand,QueryCommand,TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { assertActiveAccount,assertActiveTournament } from '../lifecycle';
const db=DynamoDBDocumentClient.from(new DynamoDBClient({}));
const table=()=>process.env.SOCIAL_TABLE_NAME!;
const read=async(env:string,id:string)=>(await db.send(new GetCommand({TableName:process.env[env]!,Key:{id},ConsistentRead:true}))).Item;
type Person={sub:string;profileId:string};
type State={pk:string;sk:string;revision:number;friends:Person[];incoming:Person[];outgoing:Person[];lastMessageAt:number;lastRequestAt:number;exists?:boolean};
async function state(sub:string):Promise<State>{const row=(await db.send(new GetCommand({TableName:table(),Key:{pk:'USER#'+sub,sk:'STATE'},ConsistentRead:true}))).Item;return row?{...row,exists:true} as State:{pk:'USER#'+sub,sk:'STATE',revision:0,friends:[],incoming:[],outgoing:[],lastMessageAt:0,lastRequestAt:0};}
function condition(s:State){return {ConditionExpression:s.exists?'revision=:v':'attribute_not_exists(pk)',...(s.exists?{ExpressionAttributeValues:{':v':s.revision}}:{})};}
function put(s:State){const {exists,...item}=s;return {Put:{TableName:table(),Item:{...item,revision:s.revision+1},...condition(s)}};}
function check(s:State){return {ConditionCheck:{TableName:table(),Key:{pk:s.pk,sk:s.sk},...condition(s)}};}
function active(sub:string){return {ConditionCheck:{TableName:process.env.CLAIM_TABLE_NAME!,Key:{id:'deleted-account:'+sub},ConditionExpression:'attribute_not_exists(id)'}};}
const has=(items:Person[],sub:string)=>items.some(p=>p.sub===sub);
const remove=(items:Person[],sub:string)=>items.filter(p=>p.sub!==sub);
const uuid=(v:any)=>typeof v==='string' && /^[\da-f-]{36}$/i.test(v);
type Event={arguments:Record<string,any>;identity?:{sub?:string}};
export const handler=async(event:Event)=>{
 const sub=event.identity?.sub;if(!sub)throw new Error('Iniciá sesión.');
 await assertActiveAccount(sub);
 const a=event.arguments || {},action=a.action;
 const mine=await state(sub);
 const creator=(await read('CLAIM_TABLE_NAME','creator'))?.accountSub;
 const limit=(id:string)=>id===creator?null:20;
 if(action==='STATE')return JSON.stringify({friends:mine.friends,incoming:mine.incoming,outgoing:mine.outgoing,limit:limit(sub)});
 // Los perfiles antiguos tienen UUID propio; siempre comprobamos su dueño real.
 const ownId=typeof a.selfProfileId==='string' && a.selfProfileId.length<=128?a.selfProfileId:sub;
 const profile=await read('PROFILE_TABLE_NAME',ownId);
 if(!profile?.owner?.startsWith(sub+'::'))throw new Error('Guardá tu perfil antes de usar amigos y chats.');
 const me:Person={sub,profileId:profile.id};
 let other:State|undefined,target:Person|undefined;
 if(['REQUEST','ACCEPT','DECLINE','CANCEL','REMOVE'].includes(action) || (['MESSAGES','SEND'].includes(action) && a.roomType==='DIRECT')){
   // Para retirar una amistad de una cuenta eliminada conservamos su referencia privada.
   const known=[...mine.friends,...mine.incoming,...mine.outgoing].find(p=>p.profileId===a.targetProfileId);
   const p=typeof a.targetProfileId==='string' && a.targetProfileId.length<=128?await read('PROFILE_TABLE_NAME',a.targetProfileId):null;
   const id=p?.owner?.split('::')[0] || known?.sub;
   if(!uuid(id) || id===sub)throw new Error('Elegí otra cuenta del club.');
   target={sub:id,profileId:p?.id || known!.profileId};other=await state(id);
   if(!['REMOVE','DECLINE','CANCEL'].includes(action)){await assertActiveAccount(id);if(!p)throw new Error('Esa cuenta ya no está disponible.');}
 }
 const friendship=['REQUEST','ACCEPT','DECLINE','CANCEL','REMOVE'].includes(action);
 if(friendship && target && other){
  const id=target.sub;
  if(action==='REQUEST'){
   if(has(mine.friends,id))return JSON.stringify({ok:true});
   if(has(mine.incoming,id))throw new Error('Ya recibiste su solicitud. Aceptala desde Solicitudes.');
   if(has(mine.outgoing,id))return JSON.stringify({ok:true});
   if((limit(sub)!==null && mine.friends.length>=20) || (limit(id)!==null && other.friends.length>=20))throw new Error('Una de las cuentas llegó al límite de 20 amigos.');
   if(mine.outgoing.length>=50 || other.incoming.length>=100)throw new Error('Hay demasiadas solicitudes pendientes.');
   if(Date.now()-mine.lastRequestAt<3000)throw new Error('Esperá unos segundos antes de enviar otra solicitud.');
   mine.outgoing.push(target);other.incoming.push(me);mine.lastRequestAt=Date.now();
  }else if(action==='ACCEPT'){
   if(!has(mine.incoming,id) || !has(other.outgoing,sub))throw new Error('La solicitud ya no está pendiente.');
   if((limit(sub)!==null && mine.friends.length>=20) || (limit(id)!==null && other.friends.length>=20))throw new Error('Una de las cuentas llegó al límite de 20 amigos.');
   mine.incoming=remove(mine.incoming,id);other.outgoing=remove(other.outgoing,sub);
   if(!has(mine.friends,id))mine.friends.push(target);if(!has(other.friends,sub))other.friends.push(me);
  }else if(action==='DECLINE'){
   if(!has(mine.incoming,id))return JSON.stringify({ok:true});
   mine.incoming=remove(mine.incoming,id);other.outgoing=remove(other.outgoing,sub);
  }else if(action==='CANCEL'){
   if(!has(mine.outgoing,id))return JSON.stringify({ok:true});
   mine.outgoing=remove(mine.outgoing,id);other.incoming=remove(other.incoming,sub);
  }else{
   if(!has(mine.friends,id))return JSON.stringify({ok:true});
   mine.friends=remove(mine.friends,id);other.friends=remove(other.friends,sub);
  }
  const checks:any[]=[active(sub)];if(['REQUEST','ACCEPT'].includes(action))checks.push(active(id));
  await transact([put(mine),put(other),...checks]);return JSON.stringify({ok:true});
 }
 if(!['MESSAGES','SEND'].includes(action))throw new Error('Operación inválida.');
 let pk:string,roomCheck:any;
 if(a.roomType==='DIRECT' && target && other){
  if(!has(mine.friends,target.sub) || !has(other.friends,sub))throw new Error('Este chat está disponible únicamente entre amigos.');
  pk='DM#'+[sub,target.sub].sort().join('#');roomCheck=check(other);
 }else if(a.roomType==='TOURNAMENT' && uuid(a.roomId)){
  const t=await read('TOURNAMENT_TABLE_NAME',a.roomId);assertActiveTournament(t);
  const ids=[...t!.participantIds,...t!.judgeIds,...(t!.treasurerId?[t!.treasurerId]:[])];
  // Ya comprobamos que este perfil pertenece al sub autenticado: no hace falta
  // leer todos los perfiles de la sala en cada consulta de mensajes.
  const member=t!.createdBySub===sub || ids.some((id:string,index:number)=>id===profile.id && (!t!.rosterStatuses || t!.rosterStatuses[index]==='ACCEPTED'));
  if(!member)throw new Error('El chat es sólo para el organizador e integrantes confirmados del torneo.');
  pk='TOURNAMENT#'+a.roomId;
  roomCheck={ConditionCheck:{TableName:process.env.TOURNAMENT_TABLE_NAME!,Key:{id:a.roomId},ConditionExpression:'attribute_not_exists(deletedAt) AND updatedAt=:v',ExpressionAttributeValues:{':v':t!.updatedAt}}};
 }else throw new Error('Sala inválida.');
 if(action==='MESSAGES'){
   let cursor;if(a.cursor){try{if(typeof a.cursor!=='string' || a.cursor.length>1500)throw 0;cursor=JSON.parse(Buffer.from(a.cursor,'base64url').toString());if(cursor.pk!==pk || typeof cursor.sk!=='string' || cursor.sk.length>150 || Object.keys(cursor).length!==2)throw 0;}catch{throw new Error('Página inválida.');}}
   const page=await db.send(new QueryCommand({TableName:table(),KeyConditionExpression:'pk=:pk AND begins_with(sk,:prefix)',ExpressionAttributeValues:{':pk':pk,':prefix':'MSG#'},ScanIndexForward:false,Limit:50,ExclusiveStartKey:cursor,ConsistentRead:true}));
   return JSON.stringify({messages:(page.Items || []).reverse().map(({pk,sk,...message})=>message),cursor:page.LastEvaluatedKey?Buffer.from(JSON.stringify(page.LastEvaluatedKey)).toString('base64url'):null});
 }
 const body=typeof a.body==='string'?a.body.trim():'';
 if(!body || body.length>1000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(body))throw new Error('Escribí un mensaje de 1 a 1000 caracteres.');
 if(!uuid(a.messageId))throw new Error('Identificador de mensaje inválido.');
 // Clave estable por intento: reintentar una petición sin respuesta no duplica el envío.
 const sent=(await db.send(new GetCommand({TableName:table(),Key:{pk:'SENT#'+sub,sk:a.messageId},ConsistentRead:true}))).Item;
 if(sent){if(sent.room!==pk || sent.body!==body)throw new Error('Identificador ya utilizado.');return JSON.stringify({ok:true});}
 if(Date.now()-mine.lastMessageAt<1200)throw new Error('Esperá un segundo entre mensajes.');
 mine.lastMessageAt=Date.now();const now=new Date().toISOString();
 const item={pk,sk:'MSG#'+now+'#'+a.messageId,id:a.messageId,senderSub:sub,senderProfileId:profile.id,senderName:profile.nickname,body,createdAt:now};
 const items:any[]=[put(mine),roomCheck,active(sub),{Put:{TableName:table(),Item:item,ConditionExpression:'attribute_not_exists(pk)'}},{Put:{TableName:table(),Item:{pk:'SENT#'+sub,sk:a.messageId,room:pk,body,ttl:Math.floor(Date.now()/1000)+86400},ConditionExpression:'attribute_not_exists(pk)'}}];
 if(target)items.push(active(target.sub));
 await transact(items);return JSON.stringify({ok:true});
};
async function transact(items:any[]){try{await db.send(new TransactWriteCommand({TransactItems:items}));}catch(error){if((error as Error).name==='TransactionCanceledException')throw new Error('La conversación o la solicitud cambió. Actualizá y volvé a intentar.');throw error;}}
