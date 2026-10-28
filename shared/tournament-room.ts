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
 if(t.runnerUpProfileId===profileId || (t.winnerProfileId && t.participantIds?.length===2))return {result:'2.º puesto',placement:2,resultTone:'silver'};
 if(t.thirdPlaceProfileId===profileId)return {result:'3.º puesto',placement:3,resultTone:'bronze'};
 return {result:'Participó',placement:null,resultTone:'bronze'};
}

/** Un mismo participante no puede ocupar varios puestos. No se adivina el podio. */
export function validatePodium(ids:string[],winner:string,second?:string|null,third?:string|null){
 const runnerUp=second || (ids.length===2?ids.find(id=>id!==winner):null) || null;
 const thirdPlace=third || null,selected=[winner,...(runnerUp?[runnerUp]:[]),...(thirdPlace?[thirdPlace]:[])];
 if(selected.some(id=>!ids.includes(id)) || new Set(selected).size!==selected.length)throw new Error('Elegí participantes distintos para cada puesto.');
 if(thirdPlace && !runnerUp)throw new Error('Elegí el segundo puesto antes del tercero.');
 return {runnerUp,thirdPlace};
}
