// Premio provisional: permisos comprobados en servidor y archivos privados en S3.
import { randomUUID } from 'node:crypto';
import { GetCommand, UpdateCommand, DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { assertActiveTournament } from '../lifecycle';
const s3=new S3Client({});
const types:Record<string,string>={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','video/mp4':'mp4','video/webm':'webm'};
export async function prizeAction(db:DynamoDBDocumentClient,sub:string,args:any) {
  if(typeof args.tournamentId!=='string' || !/^[a-f0-9-]{36}$/i.test(args.tournamentId))throw new Error('Torneo inválido.');
  const TableName=process.env.TOURNAMENT_TABLE_NAME!,Key={id:args.tournamentId};
  const t=(await db.send(new GetCommand({TableName,Key,ConsistentRead:true}))).Item;
  assertActiveTournament(t);
  if(t.creationPaymentStatus==='REVERSED')throw new Error('El pago del torneo fue revertido.');
  if(t.winnerProfileId || t.status==='COMPLETED')throw new Error('El premio no se modifica después de registrar el ganador.');
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
  const now=new Date().toISOString();
  try {
    return (await db.send(new UpdateCommand({TableName,Key,
      UpdateExpression:'SET prizeTitle=:title, prizeDescription=:description, prizeLinks=:links, prizeAttachments=:attachments, prizeRevision=:next, prizeUpdatedAt=:now, prizeUpdatedBySub=:sub, updatedAt=:now',
      ConditionExpression:'attribute_exists(id) AND attribute_not_exists(deletedAt) AND attribute_not_exists(winnerProfileId) AND #s <> :completed AND (attribute_not_exists(creationPaymentStatus) OR creationPaymentStatus=:paid) AND (attribute_not_exists(prizeRevision) OR prizeRevision=:previous)',
      ExpressionAttributeNames:{'#s':'status'},ExpressionAttributeValues:{':title':title,':description':description,':links':JSON.stringify(links),':attachments':JSON.stringify(attachments),':next':args.prizeRevision+1,':now':now,':sub':sub,':previous':args.prizeRevision,':completed':'COMPLETED',':paid':'APPROVED'},ReturnValues:'ALL_NEW'}))).Attributes;
  }catch(error){if((error as Error).name==='ConditionalCheckFailedException')throw new Error('El premio o el torneo cambió. Cancelá la edición y actualizá antes de guardar.');throw error;}
}
