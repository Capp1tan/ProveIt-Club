// Pruebas de límites de tiempo y resultados sin tocar AWS ni los datos del club.
const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
const previous=require.extensions['.ts'];
require.extensions['.ts']=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);
try{
 const {ROOM_GRACE_MS,roomDeadline,roomIsClosed,tournamentIsLive,historyResult}=require('../shared/tournament-room.ts');
 const {assertOpenTournamentRoom}=require('../amplify/functions/lifecycle.ts');
 const start=Date.parse('2026-10-28T12:00:00Z'),end=start+60000;
 const ready={status:'READY',startsAt:new Date(start).toISOString(),draw:'{}',rosterStatuses:['ACCEPTED','ACCEPTED'],participantIds:['a','b']};
 assert.equal(tournamentIsLive(ready,start-1),false);assert.equal(tournamentIsLive(ready,start),true);
 assert.equal(tournamentIsLive({...ready,rosterStatuses:['ACCEPTED','PENDING']},start),false);
 assert.equal(tournamentIsLive({...ready,status:'AWAITING_RESPONSES'},start),false);
 const completed={...ready,status:'COMPLETED',winnerProfileId:'a',decidedAt:new Date(end).toISOString()};
 assert.equal(tournamentIsLive(completed,end),false);assert.equal(roomDeadline(completed),end+ROOM_GRACE_MS);
 assert.equal(roomIsClosed(completed,end+ROOM_GRACE_MS-1),false);assert.equal(roomIsClosed(completed,end+ROOM_GRACE_MS),true);
 assert.doesNotThrow(()=>assertOpenTournamentRoom(completed,end+ROOM_GRACE_MS-1));
 assert.throws(()=>assertOpenTournamentRoom(completed,end+ROOM_GRACE_MS),/sala.*cerró/);
 assert.throws(()=>assertOpenTournamentRoom({...completed,deletedAt:'today'},end),/eliminado/);
 assert.equal(roomDeadline(ready),null);assert.equal(roomDeadline({...completed,decidedAt:'invalid'}),null);
 assert.equal(historyResult(completed,'a').placement,1);assert.equal(historyResult(completed,'b').placement,2);
 assert.equal(historyResult({...completed,participantIds:['a','b','c']},'b').placement,null);
 assert.equal(historyResult({...completed,participantIds:['a','b','c']},'b').resultTone,'bronze');
 assert.equal(historyResult(completed,'judge').resultTone,'neutral');
 console.log('18 comprobaciones correctas: inicio real, cierre en el límite, chat bloqueado y podios sin inventar puestos.');
}finally{if(previous)require.extensions['.ts']=previous;else delete require.extensions['.ts'];}
