import {tournamentIsLive, roomIsClosed} from './tournament-room';
import {competitionStart} from './competition';

export function visibleHomeTournaments(rows:any[]) {
  return rows.filter(t=>t && t.id && !t.deletedAt && !['DELETED','CANCELLED','CANCELED'].includes(t.status) && t.visibility!=='PRIVATE' && t.isPrivate!==true);
}
export function latestChampion(rows:any[]) {
  return visibleHomeTournaments(rows).filter(t=>t.status==='COMPLETED' && t.winnerProfileId && t.winnerName)
    .sort((a,b)=>(Date.parse(b.decidedAt || b.updatedAt || b.createdAt) || 0)-(Date.parse(a.decidedAt || a.updatedAt || a.createdAt) || 0))[0] || null;
}
export function homeActivity(rows:any[],now=Date.now()) {
  return visibleHomeTournaments(rows).map(t=>{
    const href='/torneo.html?id='+encodeURIComponent(t.id);
    if(t.status==='COMPLETED' && t.winnerProfileId && t.winnerName)return {id:t.id,tone:'gold',text:`${t.winnerName} ganó ${t.name}`,href:roomIsClosed(t,now)?'/torneos.html':href};
    if(tournamentIsLive(t,now))return {id:t.id,tone:'live',text:`En juego: ${t.name}`,href};
    const total=t.participantIds?.length || 0;
    if(!total || t.winnerProfileId || t.status==='COMPLETED')return null;
    const statuses=t.rosterStatuses;
    if(Array.isArray(statuses) && statuses.includes('REJECTED'))return null;
    const pending=Array.isArray(statuses)?statuses.slice(0,total).filter((s:string)=>s==='PENDING').length:0;
    if(pending)return {id:t.id,tone:'open',text:`${t.name}: ${pending===1?'falta confirmar 1 jugador':`faltan confirmar ${pending} jugadores`}`,href};
    if(t.status==='READY' && t.draw && Number.isFinite(competitionStart(t)))return {id:t.id,tone:'lobby',text:`${t.name}: cuenta regresiva para empezar`,href};
    return {id:t.id,tone:'lobby',text:`${t.name}: sala de espera`,href};
  }).filter(Boolean).slice(0,12);
}
