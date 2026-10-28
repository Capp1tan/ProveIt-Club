import {community} from '../community';
// Amistades y mensajes privados: ninguna tabla tiene acceso directo desde el navegador.
// Las revisiones y las transacciones protegen el cupo frente a aceptaciones simultáneas.
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient,GetCommand,QueryCommand,UpdateCommand,TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { assertActiveAccount,assertActiveTournament,assertOpenTournamentRoom } from '../lifecycle';
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
type Event={arguments:Record<string,any>;identity?:{sub?:string};fieldName?:string;info?:{fieldName?:string}};
export const handler=async(event:Event)=>{
 const sub=event.identity?.sub;if(!sub)throw new Error('Iniciá sesión.');
 const a=event.arguments || {},realtime=(event.fieldName || event.info?.fieldName)==='clubChatSend',action=realtime?'SEND':a.action;
 if(String(action).startsWith('COMMUNITY_'))return JSON.stringify(await community(db,sub,a));
 // Lecturas independientes en paralelo; nunca se cachean permisos entre peticiones.
 const ownId=typeof a.selfProfileId==='string' && a.selfProfileId.length<=128?a.selfProfileId:sub;
 const light=['STATE','INBOX'].includes(action);
 const [mine,,profile,creatorRow]=await Promise.all([state(sub),assertActiveAccount(sub),light?Promise.resolve(null):read('PROFILE_TABLE_NAME',ownId),action==='STATE' || ['REQUEST','ACCEPT'].includes(action)?read('CLAIM_TABLE_NAME','creator'):Promise.resolve(null)]);
 const creator=creatorRow?.accountSub;
 const limit=(id:string)=>id===creator?null:20;
 if(action==='STATE')return JSON.stringify({friends:mine.friends,incoming:mine.incoming,outgoing:mine.outgoing,limit:limit(sub)});
 if(action==='INBOX'){
  const rows:any[]=[];let key;
  do{const page=await db.send(new QueryCommand({TableName:table(),KeyConditionExpression:'pk=:pk AND begins_with(sk,:prefix)',ExpressionAttributeValues:{':pk':'USER#'+sub,':prefix':'INBOX#'},ConsistentRead:true,ExclusiveStartKey:key}));rows.push(...(page.Items || []));key=page.LastEvaluatedKey;}while(key);
  const ids=new Set(mine.friends.map(p=>p.profileId));
  return JSON.stringify({conversations:rows.filter(row=>ids.has(row.peerProfileId)).map(row=>({profileId:row.peerProfileId,name:row.peerName || 'Amigo',lastAt:row.lastAt,receivedCount:row.receivedCount || 0,unread:Math.max(0,(row.receivedCount || 0)-(row.readCount || 0))})).sort((a,b)=>(b.lastAt || '').localeCompare(a.lastAt || ''))});
 }
 // Los perfiles antiguos tienen UUID propio; siempre comprobamos su dueño real.
 if(!profile?.owner?.startsWith(sub+'::'))throw new Error('Guardá tu perfil antes de usar amigos y chats.');
 const me:Person={sub,profileId:profile.id};
 let other:State|undefined,target:Person|undefined,targetName='Amigo';
 if(['REQUEST','ACCEPT','DECLINE','CANCEL','REMOVE'].includes(action) || (['MESSAGES','SEND','READ'].includes(action) && a.roomType==='DIRECT')){
   // Para retirar una amistad de una cuenta eliminada conservamos su referencia privada.
   const known=[...mine.friends,...mine.incoming,...mine.outgoing].find(p=>p.profileId===a.targetProfileId);
   const [p,knownState]=await Promise.all([typeof a.targetProfileId==='string' && a.targetProfileId.length<=128?read('PROFILE_TABLE_NAME',a.targetProfileId):Promise.resolve(null),known?state(known.sub):Promise.resolve(null),known && !['REMOVE','DECLINE','CANCEL'].includes(action)?assertActiveAccount(known.sub):Promise.resolve()]);
   const id=p?.owner?.split('::')[0] || known?.sub;
   if(!uuid(id) || id===sub)throw new Error('Elegí otra cuenta del club.');
   const sameKnown=known?.sub===id;
   target={sub:id,profileId:p?.id || known!.profileId};other=sameKnown && knownState?knownState:await state(id);
   targetName=p?.nickname || 'Amigo';
   if(!['REMOVE','DECLINE','CANCEL'].includes(action)){if(!sameKnown)await assertActiveAccount(id);if(!p)throw new Error('Esa cuenta ya no está disponible.');}
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
 if(!['MESSAGES','SEND','READ'].includes(action))throw new Error('Operación inválida.');
 let pk:string,roomCheck:any,tournament:any;
 if(a.roomType==='DIRECT' && target && other){
  if(!has(mine.friends,target.sub) || !has(other.friends,sub))throw new Error('Este chat está disponible únicamente entre amigos.');
  pk='DM#'+[sub,target.sub].sort().join('#');roomCheck=check(other);
 }else if(a.roomType==='TOURNAMENT' && uuid(a.roomId)){
  const t=await read('TOURNAMENT_TABLE_NAME',a.roomId);assertOpenTournamentRoom(t);tournament=t;
  const ids=[...t!.participantIds,...t!.judgeIds,...(t!.treasurerId?[t!.treasurerId]:[])];
  // Ya comprobamos que este perfil pertenece al sub autenticado: no hace falta
  // leer todos los perfiles de la sala en cada consulta de mensajes.
  const member=t!.createdBySub===sub || ids.some((id:string,index:number)=>id===profile.id && (!t!.rosterStatuses || t!.rosterStatuses[index]==='ACCEPTED'));
  if(!member)throw new Error('El chat es sólo para el organizador e integrantes confirmados del torneo.');
  pk='TOURNAMENT#'+a.roomId;
  roomCheck={ConditionCheck:{TableName:process.env.TOURNAMENT_TABLE_NAME!,Key:{id:a.roomId},ConditionExpression:'attribute_not_exists(deletedAt) AND updatedAt=:v',ExpressionAttributeValues:{':v':t!.updatedAt}}};
 }else throw new Error('Sala inválida.');
 const inboxKey=target?{pk:'USER#'+sub,sk:'INBOX#'+target.profileId}:null;
 if(action==='READ'){
  if(!inboxKey || !Number.isSafeInteger(a.seenCount) || a.seenCount<0)throw new Error('Lectura inválida.');
  if(a.seenCount===0)return JSON.stringify({ok:true});
  // Marcador acumulado: un mensaje que llega al mismo tiempo sigue sin leer.
  try{await db.send(new UpdateCommand({TableName:table(),Key:inboxKey,UpdateExpression:'SET readCount=:seen',ConditionExpression:'receivedCount>=:seen AND (attribute_not_exists(readCount) OR readCount<:seen)',ExpressionAttributeValues:{':seen':a.seenCount}}));}
  catch(error){if((error as Error).name!=='ConditionalCheckFailedException')throw error;const latest=(await db.send(new GetCommand({TableName:table(),Key:inboxKey,ConsistentRead:true}))).Item;if((latest?.readCount || 0)<a.seenCount)throw new Error('Actualizá la conversación para marcarla como leída.');}
  return JSON.stringify({ok:true});
 }
 if(action==='MESSAGES'){
   const inbox=inboxKey?(await db.send(new GetCommand({TableName:table(),Key:inboxKey,ConsistentRead:true}))).Item:null;
   let cursor;if(a.cursor){try{if(typeof a.cursor!=='string' || a.cursor.length>1500)throw 0;cursor=JSON.parse(Buffer.from(a.cursor,'base64url').toString());if(cursor.pk!==pk || typeof cursor.sk!=='string' || cursor.sk.length>150 || Object.keys(cursor).length!==2)throw 0;}catch{throw new Error('Página inválida.');}}
   let after;if(a.after){try{if(typeof a.after!=='string' || a.after.length>1500 || a.cursor)throw 0;after=JSON.parse(Buffer.from(a.after,'base64url').toString());if(after.pk!==pk || typeof after.sk!=='string' || !after.sk.startsWith('MSG#') || after.sk.length>150)throw 0;}catch{throw new Error('Actualización inválida.');}}
   const page=await db.send(new QueryCommand({TableName:table(),KeyConditionExpression:after?'pk=:pk AND sk>:after':'pk=:pk AND begins_with(sk,:prefix)',ExpressionAttributeValues:after?{':pk':pk,':after':after.sk}:{':pk':pk,':prefix':'MSG#'},ScanIndexForward:Boolean(after),Limit:50,ExclusiveStartKey:cursor,ConsistentRead:true}));
   const rows=after?(page.Items || []):(page.Items || []).reverse(),last=rows.at(-1);
   return JSON.stringify({messages:rows.map(({pk,sk,...message})=>message),receivedCount:inbox?.receivedCount || 0,after:last?Buffer.from(JSON.stringify({pk,sk:last.sk})).toString('base64url'):a.after || null,hasMore:Boolean(after && page.LastEvaluatedKey),cursor:!after && page.LastEvaluatedKey?Buffer.from(JSON.stringify(page.LastEvaluatedKey)).toString('base64url'):null});
 }
 // Los destinatarios salen de la amistad recíproca o de la nómina aceptada.
 // Una suscripción vieja jamás recibe contenido: cada lectura revalida permisos.
 const finishSend=async(result:any)=>{
  if(!realtime)return JSON.stringify(result);
  const recipients=new Set<string>([sub]);
  if(target)recipients.add(target.sub);
  if(tournament){
   recipients.add(tournament.createdBySub);
   const ids=[...tournament.participantIds,...tournament.judgeIds,...(tournament.treasurerId?[tournament.treasurerId]:[])];
   const accepted=ids.filter((_:string,i:number)=>!tournament.rosterStatuses || tournament.rosterStatuses[i]==='ACCEPTED');
   const people=await Promise.all([...new Set<string>(accepted)].map(id=>read('PROFILE_TABLE_NAME',id)));
   for(const p of people){const id=p?.owner?.split('::')[0];if(id)recipients.add(id);}
  }
  return {eventId:a.messageId,recipients:[...recipients]};
 };
 const body=typeof a.body==='string'?a.body.trim():'';
 if(!body || body.length>1000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(body))throw new Error('Escribí un mensaje de 1 a 1000 caracteres.');
 if(!uuid(a.messageId))throw new Error('Identificador de mensaje inválido.');
 // Clave estable por intento: reintentar una petición sin respuesta no duplica el envío.
 const sent=(await db.send(new GetCommand({TableName:table(),Key:{pk:'SENT#'+sub,sk:a.messageId},ConsistentRead:true}))).Item;
 if(sent){if(sent.room!==pk || sent.body!==body)throw new Error('Identificador ya utilizado.');return finishSend({ok:true,...(sent.message?{message:sent.message}:{})});}
 const now=new Date().toISOString(),nowMs=Date.now();
 const item={pk,sk:'MSG#'+now+'#'+a.messageId,id:a.messageId,senderSub:sub,senderProfileId:profile.id,senderName:profile.nickname,body,createdAt:now};
 const {pk:messagePk,sk:messageSk,...message}=item;
 // Un envío ya no reescribe toda la lista de amigos ni cambia su revisión.
 // La frecuencia tiene su propio registro; los permisos se comprueban en la transacción.
 const items:any[]=[check(mine),roomCheck,active(sub),{Put:{TableName:table(),Item:item,ConditionExpression:'attribute_not_exists(pk)'}},{Put:{TableName:table(),Item:{pk:'SENT#'+sub,sk:a.messageId,room:pk,body,message,ttl:Math.floor(Date.now()/1000)+86400},ConditionExpression:'attribute_not_exists(pk)'}},{Update:{TableName:table(),Key:{pk:'RATE#'+sub,sk:'SEND'},UpdateExpression:'SET lastMessageAt=:now',ConditionExpression:'attribute_not_exists(lastMessageAt) OR lastMessageAt<=:cutoff',ExpressionAttributeValues:{':now':nowMs,':cutoff':nowMs-300}}}];
 if(target)items.push(active(target.sub));
 if(target){
  // Sólo recibir suma al contador. Enviar actualiza la lista, sin crear no leídos propios.
  items.push({Update:{TableName:table(),Key:{pk:'USER#'+target.sub,sk:'INBOX#'+profile.id},UpdateExpression:'SET peerProfileId=:id,peerName=:name,lastAt=:now,receivedCount=if_not_exists(receivedCount,:zero)+:one',ExpressionAttributeValues:{':id':profile.id,':name':profile.nickname,':now':now,':zero':0,':one':1}}});
  items.push({Update:{TableName:table(),Key:inboxKey!,UpdateExpression:'SET peerProfileId=:id,peerName=:name,lastAt=:now',ExpressionAttributeValues:{':id':target.profileId,':name':targetName,':now':now}}});
 }
 if(tournament)assertOpenTournamentRoom(tournament);
 await transact(items);return finishSend({ok:true,message});
};
async function transact(items:any[]){for(let attempt=0;attempt<3;attempt++){try{await db.send(new TransactWriteCommand({TransactItems:items}));return;}catch(error){const reasons=(error as any).CancellationReasons || [];if(attempt<2 && ((error as Error).name==='TransactionConflictException' || reasons.some((r:any)=>r.Code==='TransactionConflict'))){await new Promise(resolve=>setTimeout(resolve,50+attempt*80));continue;}if((error as Error).name==='TransactionCanceledException')throw new Error('La conversación cambió o enviaste demasiado rápido. Volvé a intentar.');throw error;}}}
