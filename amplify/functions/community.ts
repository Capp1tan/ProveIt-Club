// Lecturas de perfil filtradas en servidor y reputación basada en eventos reales.
import {DynamoDBDocumentClient,GetCommand,ScanCommand,QueryCommand,PutCommand,UpdateCommand,TransactWriteCommand} from '@aws-sdk/lib-dynamodb';
import {S3Client,GetObjectCommand,PutObjectCommand} from '@aws-sdk/client-s3';
import {randomUUID} from 'node:crypto';
import {getSignedUrl} from '@aws-sdk/s3-request-presigner';
import {assertActiveAccount,assertActiveTournament} from './lifecycle';
import {leagueProgress} from './leagues';
import {coverAction} from './tournament-cover';
const s3=new S3Client({requestChecksumCalculation:'WHEN_REQUIRED'});
const env=(k:string)=>process.env[k]!;
export async function community(db:DynamoDBDocumentClient,sub:string,a:any){
 await assertActiveAccount(sub);
 if(['COMMUNITY_COVER_UPLOAD','COMMUNITY_COVER_URL'].includes(a.action))return coverAction(db,sub,a);
 const get=async(t:string,id:string)=>(await db.send(new GetCommand({TableName:env(t),Key:{id},ConsistentRead:true}))).Item;
 const social=async(pk:string,sk='STATE')=>(await db.send(new GetCommand({TableName:env('SOCIAL_TABLE_NAME'),Key:{pk,sk},ConsistentRead:true}))).Item;
 const state=await social('USER#'+sub);
 const admin=(await get('CLAIM_TABLE_NAME','creator'))?.accountSub===sub;
 const owner=(p:any)=>p?.owner?.split('::')[0];
 const visible=async(p:any)=>{
  const target=owner(p);if(!target)return false;
  if(target===sub || p.visibility==='PUBLIC')return true;
  if(!state?.friends?.some((f:any)=>f.sub===target))return false;
  const other=await social('USER#'+target);return Boolean(other?.friends?.some((f:any)=>f.sub===sub));
 };
 const summary=async(id:string)=>{
  // Cada evento tiene una sola entrada histórica y cada votante una sola valoración.
  let key;const rows:any[]=[];
  do{const page=await db.send(new QueryCommand({TableName:env('SOCIAL_TABLE_NAME'),KeyConditionExpression:'pk=:p',ExpressionAttributeValues:{':p':'JUDGE#'+id},ExclusiveStartKey:key,ConsistentRead:true}));rows.push(...(page.Items || []));key=page.LastEvaluatedKey;}while(key);
  const votes=rows.filter(r=>r.sk.startsWith('VOTE#')),positive=votes.filter(r=>r.positive).length;
  let scanKey,events=0;
  do{const page=await db.send(new ScanCommand({TableName:env('TOURNAMENT_TABLE_NAME'),FilterExpression:'#s=:s AND contains(judgeIds,:id) AND attribute_not_exists(deletedAt)',ExpressionAttributeNames:{'#s':'status'},ExpressionAttributeValues:{':s':'COMPLETED',':id':id},ProjectionExpression:'participantIds,judgeIds,rosterStatuses',ExclusiveStartKey:scanKey}));events+=(page.Items || []).filter(t=>!t.rosterStatuses || t.rosterStatuses[t.participantIds.length+t.judgeIds.indexOf(id)]==='ACCEPTED').length;scanKey=page.LastEvaluatedKey;}while(scanKey);
  return {events,votes:votes.length,positive,negative:votes.length-positive,stars:votes.length?Math.round((1+4*positive/votes.length)*10)/10:null,confirmedReports:rows.filter(r=>r.sk.startsWith('REPORT#') && r.status==='CONFIRMED').length};
 };
 const clean=async(p:any,reputation=true)=>{
  if(!p || await get('CLAIM_TABLE_NAME','deleted-account:'+owner(p)))return null;
  const canView=await visible(p);
  return {id:p.id,nickname:p.nickname,owner:owner(p)+'::'+owner(p),accountComplete:Boolean(p.accountComplete),visibility:p.visibility==='PUBLIC'?'PUBLIC':'PRIVATE',canView,avatarPath:p.avatarPath || '',judgeEnabled:Boolean(p.judgeEnabled),...(canView?{bio:p.bio || '',socialLinks:p.socialLinks || '{}'}:{}),...(reputation?{reputation:await summary(p.id)}:{})};
 };
 if(a.action==='COMMUNITY_BADGES'){
  const badges:any[]=[];let key;
  do{const r=await db.send(new ScanCommand({TableName:env('BADGE_TABLE_NAME'),ExclusiveStartKey:key,ProjectionExpression:'#sub,#code,#label,#color,#effect',ExpressionAttributeNames:{'#sub':'accountSub','#code':'code','#label':'label','#color':'color','#effect':'effect'}}));badges.push(...(r.Items || []));key=r.LastEvaluatedKey;}while(key);return {badges};
 }
 if(a.action==='COMMUNITY_DIRECTORY'){
  let key;try{key=a.cursor?JSON.parse(Buffer.from(a.cursor,'base64url').toString()):undefined;}catch{throw new Error('Página inválida.');}
  if(key && (typeof key.id!=='string' || Object.keys(key).length!==1))throw new Error('Página inválida.');
  const result=await db.send(new ScanCommand({TableName:env('PROFILE_TABLE_NAME'),ConsistentRead:true,Limit:60,ExclusiveStartKey:key}));
  const profiles=(await Promise.all((result.Items || []).map(p=>clean(p,false)))).filter(Boolean);
  return {profiles,cursor:result.LastEvaluatedKey?Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64url'):null};
 }
 if(a.action==='COMMUNITY_PROFILE')return {profile:await clean(await get('PROFILE_TABLE_NAME',a.targetProfileId))};
 if(a.action==='COMMUNITY_PROGRESS'){
  const p=await get('PROFILE_TABLE_NAME',a.targetProfileId);
  if(!p || await get('CLAIM_TABLE_NAME','deleted-account:'+owner(p)))throw new Error('Perfil no disponible.');
  // El historial y los logros de perfiles privados nunca salen hacia un no amigo.
  if(!await visible(p))return {hidden:true};
  return leagueProgress(db,p.id);
 }
 if(a.action==='COMMUNITY_UPLOAD'){
  const types:Record<string,string>={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'};
  if(!types[a.contentType] || !Number.isInteger(a.size) || a.size<1 || a.size>2097152)throw new Error('Usá JPG, PNG o WebP hasta 2 MB.');
  const path='profile-private/'+sub+'/'+randomUUID()+'.'+types[a.contentType];
  return {path,url:await getSignedUrl(s3,new PutObjectCommand({Bucket:env('PROFILE_BUCKET_NAME'),Key:path,ContentType:a.contentType,ContentLength:a.size}),{expiresIn:120})};
 }
 if(a.action==='COMMUNITY_AVATAR'){
  if(typeof a.path!=='string' || !/^(profile-pictures|profile-private)\//.test(a.path) || a.path.length>1024)throw new Error('Foto inválida.');
  let key,found:any;
  // Si conocemos el perfil, la lectura consistente evita esperar el índice.
  if(typeof a.targetProfileId==='string'){
    const direct=await get('PROFILE_TABLE_NAME',a.targetProfileId);
    if(direct?.avatarPath===a.path)found=direct;
  }
  if(!found){
    const indexed=await db.send(new QueryCommand({TableName:env('PROFILE_TABLE_NAME'),IndexName:'byAvatarPath',KeyConditionExpression:'avatarPath=:path',ExpressionAttributeValues:{':path':a.path},Limit:1}));
    found=indexed.Items?.[0];
  }
  // Respaldo sólo durante la propagación del índice después de guardar la foto.
  if(!found)do{const page=await db.send(new ScanCommand({TableName:env('PROFILE_TABLE_NAME'),ConsistentRead:true,FilterExpression:'avatarPath=:path',ExpressionAttributeValues:{':path':a.path},ExclusiveStartKey:key}));found=page.Items?.[0];key=page.LastEvaluatedKey;}while(!found && key);
  if(!found || await get('CLAIM_TABLE_NAME','deleted-account:'+owner(found)))throw new Error('Foto no disponible.');
  return {url:await getSignedUrl(s3,new GetObjectCommand({Bucket:env('PROFILE_BUCKET_NAME'),Key:a.path}),{expiresIn:60})};
 }
 if(a.action==='COMMUNITY_REPORTS'){
  if(!admin)throw new Error('Sólo el administrador revisa reclamos.');
  const r=await db.send(new QueryCommand({TableName:env('SOCIAL_TABLE_NAME'),KeyConditionExpression:'pk=:p',ExpressionAttributeValues:{':p':'JUDGE_REPORTS'},Limit:100,ExclusiveStartKey:a.cursor?{pk:'JUDGE_REPORTS',sk:a.cursor}:undefined,ScanIndexForward:false,ConsistentRead:true}));
  return {reports:r.Items || [],cursor:r.LastEvaluatedKey?.sk || null};
 }
 if(a.action==='COMMUNITY_REVIEW'){
  if(!admin || !['CONFIRMED','DISMISSED'].includes(a.status) || typeof a.reason!=='string' || a.reason.trim().length<5 || a.reason.length>500)throw new Error('Revisión inválida.');
  const report=await social('JUDGE_REPORTS',a.reportId);if(!report)throw new Error('Reclamo inexistente.');
  const now=new Date().toISOString();
  await db.send(new TransactWriteCommand({TransactItems:[
   {Update:{TableName:env('SOCIAL_TABLE_NAME'),Key:{pk:'JUDGE_REPORTS',sk:report.sk},UpdateExpression:'SET #s=:s,reviewReason=:r,reviewedBy=:by,reviewedAt=:now',ConditionExpression:'#s=:pending',ExpressionAttributeNames:{'#s':'status'},ExpressionAttributeValues:{':s':a.status,':r':a.reason.trim(),':by':sub,':now':now,':pending':'PENDING'}}},
   {Update:{TableName:env('SOCIAL_TABLE_NAME'),Key:{pk:'JUDGE#'+report.judgeId,sk:'REPORT#'+report.id},UpdateExpression:'SET #s=:s',ExpressionAttributeNames:{'#s':'status'},ExpressionAttributeValues:{':s':a.status}}}
  ]}));return {ok:true};
 }
 const t=await get('TOURNAMENT_TABLE_NAME',a.tournamentId);assertActiveTournament(t);
 if(!t || t.creationPaymentStatus==='REVERSED')throw new Error('Torneo no disponible.');
 if(['COMMUNITY_RATE','COMMUNITY_REPORT'].includes(a.action)){
  if(typeof a.judgeId!=='string' || !t.judgeIds?.includes(a.judgeId))throw new Error('Elegí un juez de este torneo.');
  const judge=await get('PROFILE_TABLE_NAME',a.judgeId);if(owner(judge)===sub)throw new Error('El juez no puede valorarse ni reportarse a sí mismo.');
  const people=await Promise.all((t.participantIds || []).map((id:string)=>get('PROFILE_TABLE_NAME',id)));
  const index=people.findIndex(p=>owner(p)===sub);
  if(index<0 || t.rosterStatuses?.[index]!=='ACCEPTED')throw new Error('Sólo participantes confirmados pueden evaluar este evento.');
  const j=t.participantIds.length+t.judgeIds.indexOf(a.judgeId);
  if(t.rosterStatuses?.[j]!=='ACCEPTED')throw new Error('Ese juez no aceptó el cargo.');
  const now=new Date().toISOString();
  if(a.action==='COMMUNITY_RATE'){
   if(t.status!=='COMPLETED' || typeof a.positive!=='boolean')throw new Error('Podés valorar después de finalizar el torneo.');
   try{await db.send(new PutCommand({TableName:env('SOCIAL_TABLE_NAME'),Item:{pk:'JUDGE#'+a.judgeId,sk:'VOTE#'+t.id+'#'+sub,tournamentId:t.id,positive:a.positive,createdAt:now},ConditionExpression:'attribute_not_exists(pk)'}));}
   catch(e){if((e as Error).name==='ConditionalCheckFailedException')throw new Error('Ya valoraste a este juez en este evento.');throw e;}
   return {ok:true};
  }
  if(typeof a.reason!=='string' || a.reason.trim().length<10 || a.reason.length>1000)throw new Error('Explicá el reclamo entre 10 y 1000 caracteres.');
  const id=t.id+'#'+a.judgeId+'#'+sub,report={id,judgeId:a.judgeId,judgeName:judge?.nickname,tournamentId:t.id,tournamentName:t.name,reporterSub:sub,reason:a.reason.trim(),status:'PENDING',createdAt:now};
  try{await db.send(new TransactWriteCommand({TransactItems:[{Put:{TableName:env('SOCIAL_TABLE_NAME'),Item:{...report,pk:'JUDGE_REPORTS',sk:id},ConditionExpression:'attribute_not_exists(pk)'}},{Put:{TableName:env('SOCIAL_TABLE_NAME'),Item:{pk:'JUDGE#'+a.judgeId,sk:'REPORT#'+id,status:'PENDING'},ConditionExpression:'attribute_not_exists(pk)'}}]}));}
  catch(e){if((e as Error).name==='TransactionCanceledException')throw new Error('Ya hay un reclamo tuyo sobre este juez y evento.');throw e;}return {ok:true};
 }
 if(a.action==='COMMUNITY_TERMS'){
  if(t.createdBySub!==sub || t.status==='COMPLETED' || t.winnerProfileId)throw new Error('Sólo el organizador puede actualizar las condiciones antes del resultado.');
  const description=String(a.description || '').trim(),conflicts=String(a.conflicts || '').trim();
  if(description.length<10 || description.length>1000 || conflicts.length>500)throw new Error('Reglas entre 10 y 1000 caracteres; conflictos hasta 500.');
  if(t.clubRewards && (conflicts || t.judgeIds.some((id:string)=>t.participantIds.includes(id))))throw new Error('Las recompensas del club requieren jueces independientes.');
  const version=(t.termsVersion || 0)+1,now=new Date().toISOString(),invites:any[]=[];
  for(let i=0;i<t.participantIds.length+t.judgeIds.length;i++){
   const id=[...t.participantIds,...t.judgeIds][i],p=await get('PROFILE_TABLE_NAME',id);if(!p)throw new Error('Una cuenta ya no está disponible.');
   invites.push({Put:{TableName:env('INVITATION_TABLE_NAME'),Item:{id:t.id+':'+i,tournamentId:t.id,tournamentName:t.name,profileId:id,recipientSub:owner(p),role:i<t.participantIds.length?'PARTICIPANT':'JUDGE',rosterIndex:i,status:'PENDING',invitedBySub:sub,arbitrationMode:t.arbitrationMode,consentVersion:t.consentVersion || null,termsVersion:version,startsAt:t.startsAt,timeZone:t.timeZone,rulesSnapshot:description+'\nPremio: '+(t.prizeTitle || 'Sin anunciar')+' · Responsable: '+(t.prizeHolder || 'Sin declarar')+' · Financia: '+(t.prizeFunder || 'Sin declarar')+' · '+(t.prizeFundingStatus==='CONFIRMED'?'Confirmado por el responsable':'Pendiente'),conflictsSnapshot:[t.judgeIds.some((id:string)=>t.participantIds.includes(id))?'Un juez también participa.':'',conflicts].filter(Boolean).join(' '),createdAt:now,updatedAt:now,__typename:'TournamentInvitation'}}});
  }
  await db.send(new TransactWriteCommand({TransactItems:[...invites,{Update:{TableName:env('TOURNAMENT_TABLE_NAME'),Key:{id:t.id},UpdateExpression:'SET description=:d,conflicts=:c,termsVersion=:v,rosterStatuses=:r,#s=:s,membershipRevision=:rev,updatedAt=:now REMOVE #draw',ConditionExpression:'attribute_not_exists(deletedAt) AND attribute_not_exists(winnerProfileId) AND (attribute_not_exists(termsVersion) OR termsVersion=:old)',ExpressionAttributeNames:{'#s':'status','#draw':'draw'},ExpressionAttributeValues:{':d':description,':c':conflicts,':v':version,':old':t.termsVersion || 0,':r':Array(invites.length).fill('PENDING'),':s':'AWAITING_RESPONSES',':rev':(t.membershipRevision || 0)+1,':now':now}}}]}));return {ok:true};
 }
 throw new Error('Operación de comunidad inválida.');
}
