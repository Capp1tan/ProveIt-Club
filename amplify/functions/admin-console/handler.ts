// Consola de consulta: nunca acepta un rol del navegador ni devuelve claves del entorno.
import {randomUUID} from 'node:crypto';
import {DynamoDBClient} from '@aws-sdk/client-dynamodb';
import {DynamoDBDocumentClient,GetCommand,ScanCommand,QueryCommand,PutCommand} from '@aws-sdk/lib-dynamodb';
import {CognitoIdentityProviderClient,ListUsersCommand,AdminGetUserCommand} from '@aws-sdk/client-cognito-identity-provider';
import {S3Client,GetObjectCommand} from '@aws-sdk/client-s3';
import {getSignedUrl} from '@aws-sdk/s3-request-presigner';
const db=DynamoDBDocumentClient.from(new DynamoDBClient({})),cognito=new CognitoIdentityProviderClient({}),s3=new S3Client({});
const env=(key:string)=>process.env[key]!;
const get=async(table:string,id:string)=>(await db.send(new GetCommand({TableName:env(table),Key:{id},ConsistentRead:true}))).Item;
const attributes=(u:any)=>Object.fromEntries((u.Attributes || u.UserAttributes || []).map((x:any)=>[x.Name,x.Value]));
const encode=(kind:string,key:any)=>key?Buffer.from(JSON.stringify({kind,key})).toString('base64url'):null;
function decode(kind:string,cursor:any){
 if(!cursor)return undefined;
 if(typeof cursor!=='string' || cursor.length>8000)throw new Error('Página inválida.');
 try{const c=JSON.parse(Buffer.from(cursor,'base64url').toString());if(c.kind!==kind)throw Error();return c.key;}catch{throw new Error('Página inválida.');}
}
async function profileFor(sub:string){
 const direct=await get('PROFILE_TABLE_NAME',sub);if(direct?.owner?.split('::')[0]===sub)return direct;
 let key;const rows:any[]=[];
 do{const r=await db.send(new ScanCommand({TableName:env('PROFILE_TABLE_NAME'),ConsistentRead:true,FilterExpression:'begins_with(#o,:prefix) OR #o=:sub',ExpressionAttributeNames:{'#o':'owner'},ExpressionAttributeValues:{':prefix':sub+'::',':sub':sub},ExclusiveStartKey:key}));rows.push(...(r.Items || []));key=r.LastEvaluatedKey;}while(key);
 return rows.sort((a,b)=>(b.updatedAt || '').localeCompare(a.updatedAt || ''))[0] || null;
}
export const handler=async(event:{arguments?:Record<string,any>;identity?:{sub?:string}})=>{
 const sub=event.identity?.sub;if(!sub)throw new Error('Iniciá sesión.');
 // El identificador persistente de Creador es la única fuente de autorización.
 const [creator,deleted]=await Promise.all([get('CLAIM_TABLE_NAME','creator'),get('CLAIM_TABLE_NAME','deleted-account:'+sub)]);
 if(deleted || creator?.accountSub!==sub)throw new Error('Acceso exclusivo del administrador general.');
 const a=event.arguments || {},action=a.action,q=String(a.search || '').trim().toLocaleLowerCase('es');
 if(q.length>100)throw new Error('La búsqueda admite hasta 100 caracteres.');
 const audit=async(target:string,reason='Consulta administrativa')=>db.send(new PutCommand({TableName:env('SOCIAL_TABLE_NAME'),Item:{pk:'ADMIN_AUDIT',sk:new Date().toISOString()+'#'+randomUUID(),actorSub:sub,action,target,reason,requestedAt:new Date().toISOString()}}));
 if(action==='ACCESS')return JSON.stringify({allowed:true});
 if(action==='USERS'){
  await audit('users');let token=decode('USERS',a.cursor),rows:any[]=[];
  for(let page=0;page<5;page++){
   const r=await cognito.send(new ListUsersCommand({UserPoolId:env('USER_POOL_ID'),Limit:20,PaginationToken:token,...(q.includes('@')?{Filter:'email = "'+q.replace(/\\/g,'\\\\').replace(/"/g,'\\"')+'"'}:{})}));
   const items=await Promise.all((r.Users || []).map(async u=>{const attrs=attributes(u),p=attrs.sub?await profileFor(attrs.sub):null;return {id:attrs.sub,username:u.Username,nickname:p?.nickname || 'Sin perfil',profileId:p?.id,email:attrs.email || '',emailVerified:attrs.email_verified==='true',enabled:u.Enabled,status:u.UserStatus,createdAt:u.UserCreateDate?.toISOString()};}));
   rows.push(...items.filter(u=>!q || [u.nickname,u.email,u.id,u.username].some(v=>String(v || '').toLocaleLowerCase('es').includes(q))));token=r.PaginationToken;if(rows.length || !token)break;
  }
  return JSON.stringify({rows,cursor:encode('USERS',token)});
 }
 if(action==='USER'){
  if(typeof a.targetId!=='string' || !/^[a-f0-9-]{36}$/i.test(a.targetId))throw new Error('Cuenta inválida.');
  await audit(a.targetId);
  const list=await cognito.send(new ListUsersCommand({UserPoolId:env('USER_POOL_ID'),Filter:'sub = "'+a.targetId+'"',Limit:2}));
  const found=list.Users?.[0];if(!found?.Username)throw new Error('No se encontró la identidad de esta cuenta.');
  const [u,p,account]=await Promise.all([cognito.send(new AdminGetUserCommand({UserPoolId:env('USER_POOL_ID'),Username:found.Username})),profileFor(a.targetId),get('ACCOUNT_TABLE_NAME',a.targetId)]);
  const raw=attributes(u),identity:Record<string,any>={username:u.Username,status:u.UserStatus,enabled:u.Enabled,createdAt:u.UserCreateDate?.toISOString(),updatedAt:u.UserLastModifiedDate?.toISOString(),mfa:u.UserMFASettingList || []};
  for(const k of ['sub','email','email_verified','phone_number','phone_number_verified','name','nickname','preferred_username','picture','locale','zoneinfo'])if(k in raw)identity[k]=raw[k];
  const phoneOptional=Boolean(await get('CLAIM_TABLE_NAME','phone-optional:'+a.targetId)) || creator.accountSub===a.targetId;
  return JSON.stringify({identity,profile:p,account:account || null,phoneOptional});
 }
 if(action==='AVATAR'){
  if(typeof a.targetId!=='string' || a.targetId.length>128)throw new Error('Perfil inválido.');
  await audit(a.targetId,'Lectura administrativa de foto de perfil');
  const p=await get('PROFILE_TABLE_NAME',a.targetId);
  if(!p?.avatarPath || !/^(profile-pictures|profile-private)\//.test(p.avatarPath))throw new Error('El perfil no tiene una foto disponible.');
  return JSON.stringify({url:await getSignedUrl(s3,new GetObjectCommand({Bucket:env('PROFILE_BUCKET_NAME'),Key:p.avatarPath}),{expiresIn:60})});
 }
 if(action==='MESSAGES'){
  const room=a.roomKey,reason=String(a.reason || '').trim();
  if(typeof room!=='string' || !/^(DM#[a-f0-9-]{36}#[a-f0-9-]{36}|TOURNAMENT#[a-f0-9-]{36})$/i.test(room) || reason.length<10 || reason.length>500)throw new Error('Elegí una sala válida y registrá el motivo de consulta entre 10 y 500 caracteres.');
  await audit(room,reason);
  const key=decode('MESSAGES:'+room,a.cursor);
  if(key && (key.pk!==room || typeof key.sk!=='string'))throw new Error('Página inválida.');
  const r=await db.send(new QueryCommand({TableName:env('SOCIAL_TABLE_NAME'),KeyConditionExpression:'pk=:p AND begins_with(sk,:m)',ExpressionAttributeValues:{':p':room,':m':'MSG#'},Limit:30,ScanIndexForward:false,ConsistentRead:true,ExclusiveStartKey:key}));
  return JSON.stringify({rows:(r.Items || []).map(m=>({id:m.id,senderName:m.senderName,senderProfileId:m.senderProfileId,body:m.body,createdAt:m.createdAt})),cursor:encode('MESSAGES:'+room,r.LastEvaluatedKey)});
 }
 const tables:Record<string,string>={TOURNAMENTS:'TOURNAMENT_TABLE_NAME',PAYMENTS:'PAYMENT_TABLE_NAME',INVITATIONS:'INVITATION_TABLE_NAME',BADGES:'BADGE_TABLE_NAME',SETTINGS:'BILLING_SETTINGS_TABLE_NAME',PROFILES:'PROFILE_TABLE_NAME',PRIVATE_ACCOUNTS:'ACCOUNT_TABLE_NAME',CLAIMS:'CLAIM_TABLE_NAME'};
 const kind=String(a.collection || '');
 if(action==='RECORD'){
  if(!Object.hasOwn(tables,kind) || typeof a.targetId!=='string' || !a.targetId || a.targetId.length>512)throw new Error('Registro inválido.');
  await audit(kind+':'+a.targetId);
  return JSON.stringify({row:await get(tables[kind],a.targetId) || null});
 }
 if(action!=='RECORDS' || ![...Object.keys(tables),'FRIENDSHIPS','ROOMS','REPORTS','AUDIT','JUDGES'].includes(kind))throw new Error('Sección inválida.');
 await audit(kind);
 let key=decode(kind,a.cursor),rows:any[]=[],next;
 for(let page=0;page<5;page++){
  if(tables[kind]){
   if(key && (typeof key.id!=='string' || Object.keys(key).length!==1))throw new Error('Página inválida.');
   const r=await db.send(new ScanCommand({TableName:env(tables[kind]),Limit:20,ExclusiveStartKey:key,ConsistentRead:true}));rows.push(...(r.Items || []).filter(item=>!q || JSON.stringify(item).toLocaleLowerCase('es').includes(q)));next=r.LastEvaluatedKey;
  }else if(kind==='REPORTS' || kind==='AUDIT'){
   const pk=kind==='REPORTS'?'JUDGE_REPORTS':'ADMIN_AUDIT';if(key && (key.pk!==pk || typeof key.sk!=='string'))throw new Error('Página inválida.');
   const r=await db.send(new QueryCommand({TableName:env('SOCIAL_TABLE_NAME'),KeyConditionExpression:'pk=:p',ExpressionAttributeValues:{':p':pk},Limit:20,ExclusiveStartKey:key,ConsistentRead:true,ScanIndexForward:false}));rows.push(...(r.Items || []).filter(item=>!q || JSON.stringify(item).toLocaleLowerCase('es').includes(q)));next=r.LastEvaluatedKey;
  }else{
   if(key && (typeof key.pk!=='string' || typeof key.sk!=='string' || Object.keys(key).length!==2))throw new Error('Página inválida.');
   const filter=kind==='FRIENDSHIPS'?'sk=:s':kind==='JUDGES'?'begins_with(pk,:p)':'begins_with(sk,:m)';
   const values=kind==='FRIENDSHIPS'?{':s':'STATE'}:kind==='JUDGES'?{':p':'JUDGE#'}:{':m':'MSG#'};
   const r=await db.send(new ScanCommand({TableName:env('SOCIAL_TABLE_NAME'),FilterExpression:filter,ExpressionAttributeValues:values,Limit:100,ExclusiveStartKey:key,ConsistentRead:true,...(kind==='ROOMS'?{ProjectionExpression:'pk,sk'}:{})}));
   const items=kind==='ROOMS'?[...new Set((r.Items || []).map(i=>i.pk))].map(roomKey=>({roomKey})):r.Items || [];
   rows.push(...items.filter(item=>!q || JSON.stringify(item).toLocaleLowerCase('es').includes(q)));next=r.LastEvaluatedKey;
  }
  key=next;if(rows.length || !next)break;
 }
 if(kind==='ROOMS')rows=await Promise.all([...new Map(rows.map(r=>[r.roomKey,r])).values()].map(async row=>{
  const parts=row.roomKey.split('#');
  if(parts[0]==='DM'){const [left,right]=await Promise.all([profileFor(parts[1]),profileFor(parts[2])]);return {...row,name:(left?.nickname || 'Cuenta sin perfil')+' ↔ '+(right?.nickname || 'Cuenta sin perfil')};}
  const t=await get('TOURNAMENT_TABLE_NAME',parts[1]);return {...row,name:t?.name || 'Torneo no disponible'};
 }));
 // Los borradores de pago pueden contener muchas invitaciones. Se cargan completos al abrirlos.
 if(kind==='PAYMENTS')rows=rows.map(row=>Object.fromEntries(['id','tournamentName','createdBySub','status','amountCents','currency','paymentMode','createdAt','updatedAt','expiresAt'].filter(k=>k in row).map(k=>[k,row[k]])));
 return JSON.stringify({rows,cursor:encode(kind,next)});
};
