import {tournamentIsLive} from './tournament-room';
import {competitionStart} from './competition';
export function directoryTone(t:any,now=Date.now()){const phase=directoryStatus(t,now);return phase==='soon'?(t.rosterStatuses?.some((s:string)=>s!=='ACCEPTED')?'pending':'waiting'):phase;}

export const DIRECTORY_FILTERS=[['all','Todos'],['live','En juego'],['soon','Por arrancar'],['done','Terminados']] as const;
export function directoryStatus(t:any,now=Date.now()):'live'|'soon'|'done'{return t.status==='COMPLETED' || t.winnerProfileId?'done':tournamentIsLive(t,now)?'live':'soon';}
export function directoryRelation(t:any,sub:string,profileId?:string){
 const players=t.participantIds || [],judges=t.judgeIds || [],p=players.indexOf(profileId),j=judges.indexOf(profileId);
 const status=(i:number)=>i<0?null:!t.rosterStatuses?'ACCEPTED':t.rosterStatuses[i] || null;
 const participant=status(p),judge=status(j<0?-1:players.length+j),treasurer=t.treasurerId===profileId && profileId?status(players.length+judges.length):null;
 const organizer=Boolean(sub && t.createdBySub===sub),invited=[participant,judge,treasurer].includes('PENDING'),playing=participant==='ACCEPTED',judging=judge==='ACCEPTED';
 return {organizer,invited,playing,judging,mine:organizer || invited || playing || judging || treasurer==='ACCEPTED',label:organizer?'Organizás':invited?'Te invitaron':playing?'Participás':judging?'Sos juez':treasurer==='ACCEPTED'?'Responsable':null};
}
const normalize=(s:string)=>s.normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase('es');
export function directoryBase(rows:any[],query='',mine=false,sub='',profileId?:string){
 const q=normalize(query.trim());
 return rows.filter(t=>t && t.id && !t.deletedAt && !['DELETED','CANCELLED','CANCELED'].includes(t.status) && (!mine || (directoryRelation(t,sub,profileId).mine && directoryStatus(t)!=='done')) && (!q || normalize(`${t.name || ''} ${t.activity || ''}`).includes(q)));
}
export function directorySort(rows:any[],order='smart',now=Date.now()){
 const priorities={live:0,soon:1,done:2};const stamp=(s:any,fallback=0)=>Date.parse(s) || fallback;
 return [...rows].sort((a,b)=>{
  if(order==='name')return String(a.name).localeCompare(String(b.name),'es',{sensitivity:'base'}) || String(a.id).localeCompare(String(b.id));
  if(order==='recent')return stamp(b.createdAt)-stamp(a.createdAt) || String(a.id).localeCompare(String(b.id));
  const aState=directoryStatus(a,now),bState=directoryStatus(b,now),different=priorities[aState]-priorities[bState];if(different)return different;
  if(aState==='done')return stamp(b.decidedAt,b.createdAt?stamp(b.createdAt):0)-stamp(a.decidedAt,a.createdAt?stamp(a.createdAt):0);
  const start=(t:any)=>Number.isFinite(competitionStart(t))?competitionStart(t):stamp(t.startsAt,Number.MAX_SAFE_INTEGER);
  return start(a)-start(b) || stamp(b.createdAt)-stamp(a.createdAt);
 });
}
