/** Estado público del encuentro. Nunca incluye pagos privados, teléfono ni correo. */
export const COUNTDOWN_MS=120000;
export const DRAW_COUNTDOWN_MS=30000;
export function competitionState(t:any):any{try{return JSON.parse(t.competitionState || '{}');}catch{return {};}}
export const usesCompetition=(t:any)=>t?.competitionVersion===4;
export function attendanceReady(t:any){return t.participantIds?.length>0 && t.participantIds.every((_:string,index:number)=>t.rosterStatuses?.[index]==='ACCEPTED');}
export function pendingDrawApprovals(t:any,s=competitionState(t)):string[]{return (s.affected || []).filter((id:string)=>!(s.approvals || []).includes(id));}
export function competitionStart(t:any):number{const value=usesCompetition(t)?competitionState(t).startAt:t?.startsAt;const n=Date.parse(value);return Number.isFinite(n)?n:NaN;}
export function scheduledDraw(t:any):number{return usesCompetition(t) && !t.draw?Date.parse(competitionState(t).drawAt):NaN;}
export function resetCompetition(t:any){const old=competitionState(t);return JSON.stringify({attendance:{},revision:(old.revision || 0)+1,changes:old.changes || [],affected:[],approvals:[],originalDraw:null,startAt:null});}
export function competitionHasBegun(t:any,now=Date.now()){const n=competitionStart(t);return Number.isFinite(n)&&now>=n;}
