// Flujo completo sin red, credenciales, cobros ni notificaciones reales.
const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
const {changeCompetition}=require('../amplify/functions/respond-invitation/competition.ts');
const {competitionState,competitionStart,resetCompetition}=require('../shared/competition.ts');
const {tournamentIsLive}=require('../shared/tournament-room.ts');
const {createDraw}=require('../amplify/functions/respond-invitation/draw.ts');
let checks=0;const ok=(a,b)=>{assert.deepEqual(a,b);checks++;},fail=(fn,pattern)=>{assert.throws(fn,pattern);checks++;};
let now=Date.now();const ids=['a','b','c','d'];
let t={id:'test',createdBySub:'org',competitionVersion:4,competitionState:'{}',format:'SINGLE_ELIMINATION',startsAt:new Date(now).toISOString(),participantIds:ids,participantNames:['Ana','Bruno','Cami','Dante'],judgeIds:['judge'],rosterStatuses:Array(5).fill('ACCEPTED'),entryFeeCents:50000,entryPaymentStatuses:Array(4).fill('APPROVED'),membershipRevision:0,status:'CHECK_IN'};
const deterministic=(t,order)=>createDraw(t,order || ids.map((id,i)=>({id,name:t.participantNames[i]})));
const action=(row,id,ready,time=now)=>changeCompetition(row,'user-'+id,[id],{action:'ATTENDANCE',ready},time,deterministic);
fail(()=>action({...t,entryPaymentStatuses:['PENDING','APPROVED','APPROVED','APPROVED']},'a',true),/inscripciones/);
fail(()=>action({...t,rosterStatuses:['PENDING',...Array(4).fill('ACCEPTED')]},'a',true),/cargos/);
fail(()=>changeCompetition(t,'outsider',[],{action:'ATTENDANCE',ready:true},now),/propia/);
fail(()=>action(t,'a',true,now-1),/horario/);
for(const id of ids.slice(0,3))t=action(t,id,true);
ok(t.draw,null);ok(competitionStart(t),NaN);ok(t.status,'CHECK_IN');
fail(()=>changeCompetition(t,'org',[],{action:'DRAW_SCHEDULE'},now),/Todos/);
t=action(t,'d',true);ok(t.draw,null);ok(competitionStart(t),NaN);
fail(()=>changeCompetition(t,'other',[],{action:'DRAW_SCHEDULE'},now),/organizador/);
t=changeCompetition(t,'org',[],{action:'DRAW_SCHEDULE'},now);const due=competitionState(t).drawAt;
ok(Date.parse(due),now+60000);ok(t.status,'CHECK_IN');ok(t.draw,null);
ok(changeCompetition(t,'org',[],{action:'DRAW_SCHEDULE'},now+1000),t);
fail(()=>changeCompetition(t,'user-a',['a'],{action:'DRAW_FINISH'},now+59999),/cuenta regresiva/);
fail(()=>changeCompetition(t,'other',[],{action:'DRAW_FINISH'},now+60000),/integrantes/);
const canceled=action(t,'a',false,now+1000);ok(competitionState(canceled).drawAt,null);
fail(()=>changeCompetition(canceled,'org',[],{action:'DRAW_FINISH'},now+60000),/preparado/);
t=changeCompetition(t,'user-a',['a'],{action:'DRAW_FINISH'},now+60000,deterministic);now+=60000;
ok(changeCompetition(t,'user-b',['b'],{action:'DRAW_FINISH'},now+5000),t);
const original=t.draw,firstStart=competitionStart(t);
ok(firstStart,now+120000);ok(t.status,'READY');ok(tournamentIsLive(t,now+119999),false);ok(tournamentIsLive(t,firstStart),true);
// Repetir la asistencia no vuelve a sortear ni reinicia el reloj.
t=action(t,'d',true,now+1000);ok(t.draw,original);ok(competitionStart(t),firstStart);
fail(()=>changeCompetition(t,'other',[],{action:'SWAP',fromProfileId:'b',toProfileId:'c',reason:'Cambio solicitado',drawRevision:1},now),/organizador/);
fail(()=>changeCompetition(t,'org',[],{action:'SWAP',fromProfileId:'b',toProfileId:'c',reason:'Cambio solicitado',drawRevision:0},now),/cambió/);
const swap={action:'SWAP',fromProfileId:'b',toProfileId:'c',reason:'Balancear el encuentro solicitado',drawRevision:1};
t=changeCompetition(t,'org',[],swap,now+2000,deterministic);let state=competitionState(t);
ok(t.status,'DRAW_APPROVAL');ok(competitionStart(t),NaN);ok(state.originalDraw,original);ok(JSON.parse(t.draw).order.map(p=>p.id),['a','c','b','d']);ok(state.affected.sort(),ids);ok(state.changes.length,1);ok(state.changes[0].before.a[0].rival,'b');ok(state.changes[0].after.a[0].rival,'c');
fail(()=>changeCompetition(t,'org',[],{action:'ACCEPT_DRAW',drawRevision:2},now),/otro jugador/);
fail(()=>changeCompetition(t,'user-a',['a'],{action:'ACCEPT_DRAW',drawRevision:1},now),/cambió/);
for(const id of ids)t=changeCompetition(t,'user-'+id,[id],{action:'ACCEPT_DRAW',drawRevision:2},now+3000,deterministic);
ok(t.status,'READY');ok(competitionStart(t),now+123000);ok(competitionState(t).originalDraw,original);
t=action(t,'a',false,now+4000);ok(competitionStart(t),NaN);ok(tournamentIsLive(t,now+200000),false);
t=action(t,'a',true,now+5000);ok(competitionStart(t),now+125000);ok(competitionState(t).changes.length,1);
fail(()=>action(t,'a',false,now+125000),/comenzó/);
fail(()=>changeCompetition(t,'org',[],{...swap,drawRevision:2},now+125000),/comenzó/);
fail(()=>action({...t,deletedAt:new Date().toISOString()},'a',true),/eliminado/);
fail(()=>action({...t,winnerProfileId:'a'},'a',true),/finalizó/);
const reset=JSON.parse(resetCompetition(t));ok(reset.attendance,{});ok(reset.startAt,null);ok(reset.changes.length,1);ok(reset.originalDraw,null);
// Todas las modalidades conservan orden y jugadores al reconstruir posiciones.
for(const format of ['DUEL','ROUND_ROBIN','SINGLE_ELIMINATION','DOUBLE_ELIMINATION','SWISS','FREE_FOR_ALL']){const draw=JSON.parse(deterministic({...t,format},[{id:'d',name:'Dante'},{id:'c',name:'Cami'},{id:'b',name:'Bruno'},{id:'a',name:'Ana'}]));ok(draw.order.map(p=>p.id),['d','c','b','a']);ok(draw.rounds.length>0,true);}
console.log(checks+' comprobaciones correctas: asistencia, reloj, permisos, sorteo persistente, cambios transparentes, nueva aceptación y bloqueo al comenzar.');


// Dos clientes completan simultáneamente el mismo sorteo: sólo una escritura gana.
(async()=>{
 const {competitionAction}=require('../amplify/functions/respond-invitation/competition.ts');
 const savedEnv=[process.env.TOURNAMENT_TABLE_NAME,process.env.PROFILE_TABLE_NAME];process.env.TOURNAMENT_TABLE_NAME='qa-tournaments';process.env.PROFILE_TABLE_NAME='qa-profiles';
 try{
  let row={...t,id:'11111111-1111-4111-8111-111111111111',draw:null,status:'CHECK_IN',winnerProfileId:null,competitionState:JSON.stringify({attendance:Object.fromEntries(ids.map(id=>[id,{ready:true}])),drawAt:new Date(Date.now()-1000).toISOString()}),membershipRevision:10},writes=0;
  const db={send:async command=>{const a=command.input;if(command.constructor.name==='GetCommand')return {Item:structuredClone(a.TableName==='qa-tournaments'?row:{id:a.Key.id,owner:'user-'+a.Key.id+'::test'})};if(command.constructor.name==='UpdateCommand'){if(a.ExpressionAttributeValues[':previous']!==row.membershipRevision){const e=new Error('race');e.name='ConditionalCheckFailedException';throw e;}writes++;const v=a.ExpressionAttributeValues;row={...row,status:v[':s'],draw:v[':d'],competitionState:v[':cs'],membershipRevision:v[':next'],updatedAt:v[':now']};return {};}throw new Error('unexpected command');}};
  const results=await Promise.all(['a','b'].map(id=>competitionAction(db,'user-'+id,{tournamentId:row.id,action:'DRAW_FINISH'})));
  ok(writes,1);ok(results[0].draw,results[1].draw);ok(results[0].competitionState,results[1].competitionState);ok(row.membershipRevision,11);console.log('Concurrencia correcta: dos clientes, una escritura y una única llave compartida.');
 }finally{[process.env.TOURNAMENT_TABLE_NAME,process.env.PROFILE_TABLE_NAME]=savedEnv;}
})().catch(e=>{console.error(e);process.exitCode=1;});
