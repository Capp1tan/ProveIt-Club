/** Sala efímera, historial permanente. La hora de cierre se deriva del resultado
 * guardado por AWS: recargar o cambiar de dispositivo nunca reinicia los 5 min. */
export const ROOM_GRACE_MS=5*60*1000;
export function roomDeadline(t:any):number|null{
 if(!t || (!t.winnerProfileId && t.status!=='COMPLETED'))return null;
 const at=Date.parse(t.decidedAt);return Number.isFinite(at)?at+ROOM_GRACE_MS:null;
}
export function roomIsClosed(t:any,now=Date.now()):boolean{const deadline=roomDeadline(t);return deadline!==null && now>=deadline;}
export function tournamentIsLive(t:any,now=Date.now()):boolean{
 return Boolean(t && !t.winnerProfileId && t.status==='READY' && t.draw && Number.isFinite(Date.parse(t.startsAt)) && now>=Date.parse(t.startsAt) && t.rosterStatuses?.length && t.rosterStatuses.every((s:string)=>s==='ACCEPTED'));
}
/** No inventamos podios: un duelo de dos personas sí determina el segundo puesto. */
export function historyResult(t:any,profileId:string){
 const participant=t.participantIds?.includes(profileId);
 if(t.status!=='COMPLETED')return {result:'Confirmado',placement:null,resultTone:'neutral'};
 if(!participant)return {result:'Juez',placement:null,resultTone:'neutral'};
 if(t.winnerProfileId===profileId)return {result:'1.º puesto',placement:1,resultTone:'gold'};
 if(t.winnerProfileId && t.participantIds?.length===2)return {result:'2.º puesto',placement:2,resultTone:'silver'};
 return {result:'Participó',placement:null,resultTone:'bronze'};
}
