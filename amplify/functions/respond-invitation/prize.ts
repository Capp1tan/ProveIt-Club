import {resetCompetition,competitionHasBegun} from '../../../shared/competition';
// Premio provisional: permisos comprobados en servidor y archivos privados en S3.
import { randomUUID } from 'node:crypto';
import { GetCommand, UpdateCommand, TransactWriteCommand, DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { assertActiveTournament } from '../lifecycle';
// El navegador sube el cuerpo real; no firmar el checksum de un cuerpo vacío.
const s3=new S3Client({requestChecksumCalculation:'WHEN_REQUIRED'});
const types:Record<string,string>={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','video/mp4':'mp4','video/webm':'webm'};
export async function prizeAction(db:DynamoDBDocumentClient,sub:string,args:any) {
  if(typeof args.tournamentId!=='string' || !/^[a-f0-9-]{36}$/i.test(args.tournamentId))throw new Error('Torneo inválido.');
  const TableName=process.env.TOURNAMENT_TABLE_NAME!,Key={id:args.tournamentId};
  const t=(await db.send(new GetCommand({TableName,Key,ConsistentRead:true}))).Item;
  assertActiveTournament(t);
  if(t.creationPaymentStatus==='REVERSED')throw new Error('El pago del torneo fue revertido.');
  if(t.winnerProfileId || t.status==='COMPLETED' || competitionHasBegun(t))throw new Error('El premio sólo se modifica antes de comenzar el torneo.');
  if(t.arbitrationMode==='ORGANIZER') {
    if(t.createdBySub!==sub)throw new Error('Sólo el organizador puede definir este premio.');
  } else {
    const judges=await Promise.all((t.judgeIds || []).map(async(id:string,index:number)=>({index,profile:(await db.send(new GetCommand({TableName:process.env.PROFILE_TABLE_NAME!,Key:{id},ConsistentRead:true}))).Item})));
    if(!judges.some(({index,profile})=>profile?.owner?.split('::')[0]===sub && (!t.rosterStatuses || t.rosterStatuses[t.participantIds.length+index]==='ACCEPTED')))throw new Error('Sólo un juez confirmado puede definir el premio.');
  }
  const Bucket=process.env.PRIZE_BUCKET_NAME!;
  if('uploadContentType' in args) {
    const type=args.uploadContentType,size=args.uploadSize,max=type?.startsWith('video/')?20*1024*1024:5*1024*1024;
    if(!types[type] || !Number.isInteger(size) || size<1 || size>max)throw new Error('Usá JPG, PNG o WebP hasta 5 MB, o MP4/WebM hasta 20 MB.');
    const path=`prize-media/${t.id}/${sub}/${randomUUID()}.${types[type]}`;
    const url=await getSignedUrl(s3,new PutObjectCommand({Bucket,Key:path,ContentType:type,ContentLength:size}),{expiresIn:120});
    return {path,url};
  }
  const prizeType=args.prizeType || t.prizeType || 'OTHER';
  if(!['MONEY','SURPRISE','FOOD','TECH','CLOTHING','EXPERIENCE','OTHER'].includes(prizeType))throw new Error('Tipo de premio inválido.');
  const title=String(args.prizeTitle || '').trim(),description=String(args.prizeDescription || '').trim();
  if(title.length>120 || description.length>1200)throw new Error('El título admite 120 caracteres y la descripción 1200.');
  if(!Number.isInteger(args.prizeRevision) || args.prizeRevision<0)throw new Error('Revisión inválida.');
  let links:any,attachments:any;
  try{links=JSON.parse(args.prizeLinks || '[]');attachments=JSON.parse(args.prizeAttachments || '[]');}catch{throw new Error('Adjuntos inválidos.');}
  if(!Array.isArray(links) || links.length>5 || !Array.isArray(attachments) || attachments.length>4)throw new Error('Hasta 5 enlaces y 4 archivos.');
  links=links.map((raw:any)=>{if(typeof raw!=='string' || raw.length>1500)throw new Error('Enlace inválido.');let u:URL;try{u=new URL(raw);}catch{throw new Error('Usá enlaces completos con https://.');}if(u.protocol!=='https:' || u.username || u.password)throw new Error('Sólo enlaces HTTPS sin credenciales.');return u.href;});
  const previous=JSON.parse(t.prizeAttachments || '[]');
  attachments=await Promise.all(attachments.map(async(item:any)=>{
    if(typeof item?.path!=='string' || typeof item.name!=='string' || item.name.length>120 || !item.path.startsWith(`prize-media/${t.id}/`) || (!item.path.startsWith(`prize-media/${t.id}/${sub}/`) && !previous.some((old:any)=>old.path===item.path)))throw new Error('No podés adjuntar este archivo.');
    const head=await s3.send(new HeadObjectCommand({Bucket,Key:item.path}));
    const type=head.ContentType || '',max=type.startsWith('video/')?20*1024*1024:5*1024*1024;
    if(!types[type] || !head.ContentLength || head.ContentLength>max)throw new Error('El archivo no cumple el formato o tamaño permitido.');
    return {path:item.path,name:item.name,kind:type.startsWith('video/')?'video':'image'};
  }));
  if(!title && (description || links.length || attachments.length))throw new Error('Dale un título al premio.');
  const holder=String(args.prizeHolder || '').trim(),funder=String(args.prizeFunder || '').trim(),funding=args.prizeFundingStatus;
  if(title && (!holder || holder.length>120 || funder.length>120 || !['PENDING','CONFIRMED'].includes(funding)))throw new Error('Indicá quién entrega el premio y si está confirmado.');
  const now=new Date().toISOString(),version=(t.termsVersion || 0)+1,invites:any[]=[];
  // Un cambio en el premio es material: todos vuelven a aceptar y el torneo se pausa.
  for(const [i,id] of [...t.participantIds,...t.judgeIds].entries()){
   const p=(await db.send(new GetCommand({TableName:process.env.PROFILE_TABLE_NAME!,Key:{id},ConsistentRead:true}))).Item;
   if(!p?.owner)throw new Error('Una cuenta ya no está disponible.');
   invites.push({Put:{TableName:process.env.INVITATION_TABLE_NAME!,Item:{id:t.id+':'+i,tournamentId:t.id,tournamentName:t.name,recipientSub:p.owner.split('::')[0],profileId:id,role:i<t.participantIds.length?'PARTICIPANT':'JUDGE',rosterIndex:i,status:'PENDING',entryFeeCents:i<t.participantIds.length?(t.entryFeeCents || 0):0,invitedBySub:t.createdBySub,arbitrationMode:t.arbitrationMode,consentVersion:t.consentVersion || null,startsAt:t.startsAt,timeZone:t.timeZone,termsVersion:version,rulesSnapshot:(t.description || '')+'\nPremio: '+(title || 'Sin anunciar')+' · Responsable: '+holder+' · Financia: '+funder+' · '+(funding==='CONFIRMED'?'Confirmado por el responsable':'Pendiente de confirmación'),conflictsSnapshot:t.conflicts || '',createdAt:now,updatedAt:now,__typename:'TournamentInvitation'}}});
  }
  try {
    await db.send(new TransactWriteCommand({TransactItems:[...invites,{Update:{TableName,Key,
      UpdateExpression:'SET prizeType=:type, prizeTitle=:title, prizeDescription=:description, prizeLinks=:links, prizeAttachments=:attachments, prizeRevision=:next, prizeUpdatedAt=:now, prizeUpdatedBySub=:sub, updatedAt=:now, prizeHolder=:holder, prizeFunder=:funder,prizeFundingStatus=:funding,termsVersion=:tv,rosterStatuses=:rs,#s=:waiting,membershipRevision=:mr,competitionState=:cs,prizeImagePath=:empty REMOVE #draw',
      ConditionExpression:'attribute_exists(id) AND attribute_not_exists(deletedAt) AND attribute_not_exists(winnerProfileId) AND #s <> :completed AND (attribute_not_exists(creationPaymentStatus) OR creationPaymentStatus=:paid OR creationPaymentStatus=:exempt) AND (attribute_not_exists(prizeRevision) OR prizeRevision=:previous) AND (attribute_not_exists(membershipRevision) OR membershipRevision=:oldMr)',
      ExpressionAttributeNames:{'#s':'status','#draw':'draw'},ExpressionAttributeValues:{':cs':resetCompetition(t),':empty':attachments.length?'':(t.prizeImagePath || ''),':type':prizeType,':holder':holder,':funder':funder,':funding':funding || 'PENDING',':tv':version,':rs':Array(invites.length).fill('PENDING'),':waiting':'AWAITING_RESPONSES',':mr':(t.membershipRevision || 0)+1,':oldMr':t.membershipRevision || 0,':title':title,':description':description,':links':JSON.stringify(links),':attachments':JSON.stringify(attachments),':next':args.prizeRevision+1,':now':now,':sub':sub,':previous':args.prizeRevision,':completed':'COMPLETED',':paid':'APPROVED',':exempt':'EXEMPT'}}}]}));
    return (await db.send(new GetCommand({TableName,Key,ConsistentRead:true}))).Item;
  }catch(error){if((error as Error).name==='TransactionCanceledException')throw new Error('El premio o el torneo cambió. Cancelá la edición y actualizá antes de guardar.');throw error;}
}
