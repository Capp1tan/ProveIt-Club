// Estados del inicio: sin cuentas, consultas ni escrituras en AWS.
const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
const previous=require.extensions['.ts'];
require.extensions['.ts']=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);
try{
 const {homeActivity,latestChampion}=require('../shared/home-activity.ts');
 const now=Date.parse('2026-11-03T18:00:00Z');
 const base={id:'match',name:'Copa del club',participantIds:['a','b'],participantNames:['Ana','Beto'],status:'AWAITING_RESPONSES',createdAt:'2026-11-03T12:00:00Z',rosterStatuses:['ACCEPTED','PENDING']};
 assert.match(homeActivity([base],now)[0].text,/falta confirmar 1 jugador/);
 assert.match(homeActivity([{...base,rosterStatuses:['ACCEPTED','ACCEPTED','PENDING']}],now)[0].text,/sala de espera/,'Un juez pendiente no cuenta como jugador faltante');
 assert.equal(homeActivity([{...base,rosterStatuses:['ACCEPTED','REJECTED']}],now).length,0);
 assert.equal(homeActivity([{...base,deletedAt:'today'}],now).length,0);
 assert.equal(homeActivity([{...base,status:'CANCELLED'}],now).length,0);
 assert.equal(homeActivity([{...base,visibility:'PRIVATE'}],now).length,0);
 assert.equal(homeActivity([{...base,isPrivate:true}],now).length,0);
 const ready={...base,status:'READY',startsAt:new Date(now-1000).toISOString(),draw:'{}',rosterStatuses:['ACCEPTED','ACCEPTED']};
 assert.equal(homeActivity([ready],now)[0].tone,'live');
 assert.equal(homeActivity([{...ready,startsAt:new Date(now+1000).toISOString()}],now)[0].tone,'lobby');
 assert.notEqual(homeActivity([{...ready,entryFeeCents:50000,entryPaymentStatuses:['APPROVED','PENDING']}],now)[0].tone,'live');
 const done={...ready,status:'COMPLETED',winnerProfileId:'a',winnerName:'Ana',decidedAt:new Date(now-1000).toISOString()};
 assert.match(homeActivity([done],now)[0].text,/Ana ganó Copa del club/);
 assert.equal(homeActivity([done],now)[0].href,'/torneo.html?id=match');
 assert.equal(homeActivity([done],now+300000)[0].href,'/torneos.html','Un resultado antiguo no envía a una sala cerrada');
 const older={...done,id:'old',decidedAt:new Date(now-100000).toISOString()};
 assert.equal(latestChampion([older,done]).id,'match');
 assert.equal(latestChampion([done,older]).id,'match');
 assert.equal(latestChampion([{...done,winnerName:''}]),null);
 assert.equal(latestChampion([{...done,deletedAt:'today'}]),null);
 assert.equal(latestChampion([ready]),null);
 assert.equal(homeActivity(Array.from({length:30},(_,i)=>({...base,id:String(i)})),now).length,12);
 assert.deepEqual(homeActivity([],now),[]);
 console.log('20 comprobaciones correctas: estados reales, confirmaciones, privacidad, cobros pendientes, campeón y salas cerradas.');
}finally{if(previous)require.extensions['.ts']=previous;else delete require.extensions['.ts'];}
