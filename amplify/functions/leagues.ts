import {S3Client,GetObjectCommand} from '@aws-sdk/client-s3';
import {getSignedUrl} from '@aws-sdk/s3-request-presigner';
import {roomDeadline,roomIsClosed,historyResult,allEntriesPaid} from '../../shared/tournament-room';
const covers=new S3Client({});
import {DynamoDBDocumentClient,ScanCommand} from '@aws-sdk/lib-dynamodb';

// Lanzamiento de ligas: los eventos anteriores siguen en el historial, sin XP retroactiva.
// Los puntos se calculan en el servidor. No hay campos de XP editables por el navegador.
export const LEAGUE_START = '2026-10-18T21:35:00.000Z';
const ranks = [
  {name:'Pañal con caca',minimum:25}, {name:'Cartón mojado',minimum:50},
  {name:'Madera',minimum:100}, {name:'Cobre',minimum:350},
  {name:'Hierro oxidado',minimum:1000}, {name:'Acero templado',minimum:2500},
  {name:'Obsidiana',minimum:6000}, {name:'Leyenda',minimum:15000},
];

/** Lectura derivada y sin escrituras: cada torneo cuenta como máximo una vez.
 * Sólo resultados posteriores al lanzamiento, con inscripción aceptada y pago no
 * revertido. Máximo tres torneos por día UTC y un evento por grupo de rivales/día.
 * Es una progresión del club, no una calificación oficial de habilidad ni dinero.
 */
export async function leagueProgress(db:DynamoDBDocumentClient,profileId:string){
 const events:any[]=[];let key;
 do{
  const page=await db.send(new ScanCommand({TableName:process.env.TOURNAMENT_TABLE_NAME!,
   FilterExpression:'(contains(participantIds,:id) OR contains(judgeIds,:id)) AND attribute_not_exists(deletedAt)',
   ExpressionAttributeValues:{':id':profileId},ExclusiveStartKey:key,
   ProjectionExpression:'id,#name,activity,#status,participantIds,judgeIds,rosterStatuses,winnerProfileId,runnerUpProfileId,thirdPlaceProfileId,createdAt,startsAt,decidedAt,creationPaymentStatus,resultKind,entryFeeCents,entryPaymentStatuses,coverPath,createdBySub',
   ExpressionAttributeNames:{'#name':'name','#status':'status'}}));
  events.push(...(page.Items || []));key=page.LastEvaluatedKey;
 }while(key);
 const accepted=events.filter(t=>{
  const pi=(t.participantIds || []).indexOf(profileId),ji=(t.judgeIds || []).indexOf(profileId);
  const index=pi>=0?pi:(t.participantIds || []).length+ji;
  return ['AWAITING_RESPONSES','CHECK_IN','DRAW_APPROVAL','READY','COMPLETED'].includes(t.status) && t.creationPaymentStatus!=='REVERSED' &&
   (t.rosterStatuses?.[index]==='ACCEPTED');
 });
 const candidates=accepted.filter(t=>allEntriesPaid(t) && t.status==='COMPLETED' && t.winnerProfileId &&
  t.participantIds?.includes(profileId) && new Set(t.participantIds).size>=2 &&
  t.participantIds.every((_:string,i:number)=>t.rosterStatuses?.[i]==='ACCEPTED') &&
  t.createdAt>=LEAGUE_START && t.decidedAt>=LEAGUE_START && t.resultKind!=='SANCTION')
  .sort((a,b)=>a.decidedAt.localeCompare(b.decidedAt) || a.id.localeCompare(b.id));
 let xp=0;const credited:any[]=[],seen=new Set<string>(),groups=new Set<string>(),days=new Map<string,number>();
 for(const t of candidates){
  const day=t.decidedAt.slice(0,10),rivals=t.participantIds.filter((id:string)=>id!==profileId).sort();
  const group=day+':'+rivals.join(',');
  if(seen.has(t.id) || groups.has(group) || (days.get(day) || 0)>=3)continue;
  seen.add(t.id);groups.add(group);days.set(day,(days.get(day) || 0)+1);
  xp+=25+(t.winnerProfileId===profileId?10:0);credited.push(t);
 }
 const index=ranks.reduce((result,rank,i)=>xp>=rank.minimum?i:result,-1);
 const current=index>=0?ranks[index]:null,next=ranks[index+1];
 const achievements:{title:string;date:string;kind:string}[]=[];
 if(credited.length)achievements.push({title:'Primera participación',date:credited[0].decidedAt,kind:'participation'});
 const win=credited.find(t=>t.winnerProfileId===profileId);
 if(win)achievements.push({title:'Primera victoria',date:win.decidedAt,kind:'victory'});
 for(const count of [5,10,25,50,100])if(credited.length>=count)achievements.push({title:count+' torneos completados',date:credited[count-1].decidedAt,kind:'milestone'});
 return {xp,rank:current?{...current,index}:null,nextMinimum:next?.minimum || null,
  seasonStart:LEAGUE_START,creditedEvents:credited.length,
  achievements:achievements.reverse(),
  history:await Promise.all(accepted.sort((a,b)=>(b.decidedAt || b.startsAt || b.createdAt).localeCompare(a.decidedAt || a.startsAt || a.createdAt)).slice(0,20).map(async t=>{
   let coverUrl='';
   if(typeof t.coverPath==='string' && t.coverPath.startsWith(`tournament-covers/${t.createdBySub}/${t.id}/`) && t.coverPath.endsWith('.webp')){
    try{coverUrl=await getSignedUrl(covers,new GetObjectCommand({Bucket:process.env.PROFILE_BUCKET_NAME!,Key:t.coverPath}),{expiresIn:120});}catch{/* El historial funciona aunque la portada falle. */}
   }
   return {id:t.id,name:t.name,activity:t.activity,status:t.status,date:t.decidedAt || t.startsAt || t.createdAt,
    canCommentOnJudge:t.status==='COMPLETED' && t.participantIds.includes(profileId) &&
      t.judgeIds?.some((id:string,index:number)=>id!==profileId && t.rosterStatuses?.[t.participantIds.length+index]==='ACCEPTED'),
    role:t.participantIds.includes(profileId)?'Participante':'Juez',...historyResult(t,profileId),coverUrl,
    roomClosed:roomIsClosed(t),roomClosesAt:roomDeadline(t)};
  }))};
}
