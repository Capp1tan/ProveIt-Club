// Prueba integral aislada: base de datos en memoria y Mercado Pago simulado.
// NO lee credenciales reales, NO usa la red, NO crea cobros o torneos del club.
const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),crypto=require('node:crypto');
require.extensions['.ts']=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);
for(const key of ['TOURNAMENT_TABLE_NAME','PAYMENT_TABLE_NAME','INVITATION_TABLE_NAME','CLAIM_TABLE_NAME','ACCOUNT_TABLE_NAME','PROFILE_TABLE_NAME','BILLING_SETTINGS_TABLE_NAME'])process.env[key]=key;
Object.assign(process.env,{MERCADOPAGO_MODE:'live',MERCADOPAGO_ACCESS_TOKEN:'TEST_ONLY_NO_NETWORK',MERCADOPAGO_WEBHOOK_SECRET:'TEST_ONLY_SIGNATURE',AWS_REGION:'us-east-1'});
const {DynamoDBDocumentClient}=require('@aws-sdk/lib-dynamodb'),tables=new Map(),calls=[],payments=new Map();let checks=0;
const table=name=>{if(!tables.has(name))tables.set(name,new Map());return tables.get(name);},key=k=>JSON.stringify(k),read=(name,id)=>table(name).get(key({id})),put=(name,row)=>table(name).set(key({id:row.id}),structuredClone(row));
function condition(c,item){
 let text=c.ConditionExpression || 'true';const values=c.ExpressionAttributeValues || {},names=c.ExpressionAttributeNames || {},get=attr=>item?.[names[attr] || attr];
 text=text.replace(/attribute_(not_)?exists\(([#\w]+)\)/g,(_,not,attr)=>String(not?get(attr)===undefined:get(attr)!==undefined));
 text=text.replace(/([#\w]+)\s*(<>|<=|>=|=|<|>)\s*(:\w+)/g,(_,attr,op,key)=>{const a=get(attr),b=values[key];return String(a!==undefined && ({'=':a===b,'<>':a!==b,'<':a<b,'>':a>b,'<=':a<=b,'>=':a>=b})[op]);});
 text=text.replace(/\bAND\b/g,'&&').replace(/\bOR\b/g,'||');
 if(!/^[truefals()\s&|]+$/.test(text))throw new Error('Condición de prueba no soportada: '+text);
 return Function('return ('+text+')')();
}

function update(c){const rows=table(c.TableName),k=key(c.Key),item=structuredClone(rows.get(k) || {...c.Key}),values=c.ExpressionAttributeValues || {},names=c.ExpressionAttributeNames || {};
 const expr=c.UpdateExpression || '';for(const match of expr.matchAll(/([#a-zA-Z][\w#]*)\s*=\s*(:\w+)/g))item[names[match[1]] || match[1]]=structuredClone(values[match[2]]);
 if(expr.includes('REMOVE '))for(const attr of expr.split('REMOVE ')[1].split(','))delete item[names[attr.trim()] || attr.trim()];rows.set(k,item);return item;
}
DynamoDBDocumentClient.prototype.send=async function(command){const c=command.input,type=command.constructor.name;
 if(type==='GetCommand')return {Item:structuredClone(table(c.TableName).get(key(c.Key)))};
 if(type==='UpdateCommand'){if(!condition(c,table(c.TableName).get(key(c.Key))))throw Object.assign(new Error('condition'),{name:'ConditionalCheckFailedException'});return {Attributes:update(c)};}
 if(type==='TransactWriteCommand'){
  for(const operation of c.TransactItems){const v=operation.Put || operation.Update || operation.ConditionCheck,item=operation.Put?read(v.TableName,v.Item.id):table(v.TableName).get(key(v.Key));if(!condition(v,item))throw Object.assign(new Error('transaction condition'),{name:'TransactionCanceledException'});}
  for(const operation of c.TransactItems){if(operation.Put)put(operation.Put.TableName,operation.Put.Item);if(operation.Update)update(operation.Update);}return {};
 }
 throw new Error('Operación de prueba no prevista: '+type);
};
global.fetch=async(url,options={})=>{url=String(url);if(!url.startsWith('https://api.mercadopago.com/'))throw new Error('RED BLOQUEADA');calls.push({url,method:options.method,body:options.body?JSON.parse(options.body):null});let result;
 if(url.endsWith('/users/me'))result={id:99,site_id:'MLA',tags:[]};
 else if(url.endsWith('/checkout/preferences'))result={id:'pref-'+calls.length,init_point:'https://www.mercadopago.com.ar/checkout/test-no-network'};
 else if(url.includes('/checkout/preferences/'))result={};
 else if(url.includes('/v1/payments/'))result=payments.get(url.split('/').at(-1));
 if(!result)throw new Error('Respuesta de prueba no prevista');return {ok:true,status:200,json:async()=>structuredClone(result)};
};
const expect=(value,expected)=>{assert.deepEqual(value,expected);checks++;};
(async()=>{
 const {handler:create}=require('../amplify/functions/create-tournament/handler.ts'),{respond}=require('../amplify/functions/respond-invitation/handler.ts'),{prepareEntry}=require('../amplify/functions/billing/entry.ts'),{reconcilePayment}=require('../amplify/functions/billing/common.ts'),{entryCheckoutId,assertEntryPaid}=require('../amplify/functions/billing/entry-policy.ts'),{allEntriesPaid}=require('../shared/tournament-room.ts');
 const webhook=require('../amplify/functions/payment-webhook/handler.ts').handler;
 const subs=['payer-a','payer-b','organizer'],ids=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222'];
 subs.forEach(sub=>put('ACCOUNT_TABLE_NAME',{id:sub,phoneNumber:'+5491111111111'}));ids.forEach((id,i)=>put('PROFILE_TABLE_NAME',{id,nickname:'Jugador '+i,owner:subs[i]+'::'+subs[i]}));
 const tid='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',args={tournamentId:tid,name:'Torneo de prueba local',activity:'Duelo',description:'Reglas de prueba suficientes',format:'DUEL',participantIds:ids,judgeIds:[],arbitrationMode:'ORGANIZER',acceptOrganizerDecision:true,startsAt:new Date(Date.now()+3600000).toISOString(),timeZone:'America/Argentina/Buenos_Aires'};
 const receipt=await create({identity:{sub:'organizer'},arguments:args});expect(receipt.status,'EXEMPT');expect(receipt.amountCents,0);expect(calls.length,0);expect(read('TOURNAMENT_TABLE_NAME',tid).entryFeeCents,50000);
 const retry=await create({identity:{sub:'organizer'},arguments:args});expect(retry.id,receipt.id);expect(calls.length,0);
 await assert.rejects(()=>respond({identity:{sub:subs[0]},arguments:{invitationId:tid+':0',accept:true,acceptTerms:true,termsVersion:1,acceptOrganizerDecision:true}}),/ENTRY_PAYMENT_REQUIRED/);checks++;expect(read('TOURNAMENT_TABLE_NAME',tid).rosterStatuses,['PENDING','PENDING']);
 const values=index=>({invitationId:tid+':'+index,acceptTerms:true,termsVersion:1,acceptOrganizerDecision:true});
 await assert.rejects(()=>prepareEntry('intruder',values(0)),/pertenece/);checks++;expect(calls.length,0);
 await assert.rejects(()=>prepareEntry(subs[0],{...values(0),acceptTerms:false}),/condiciones/);checks++;expect(calls.length,0);
 const first=await prepareEntry(subs[0],values(0));expect(first.amountCents,50000);expect(first.kind,'ENTRY');expect(calls.find(c=>c.body?.items)?.body.items[0].unit_price,500);expect(first.id,entryCheckoutId(tid,ids[0]));
 const preferencesBefore=calls.filter(c=>c.body?.items).length;await prepareEntry(subs[0],values(0));expect(calls.filter(c=>c.body?.items).length,preferencesBefore);
 const payment=(id,invoice)=>({id,external_reference:invoice,collector_id:99,live_mode:true,currency_id:'ARS',transaction_amount:500,transaction_amount_refunded:0,status:'approved',metadata:{proveit_checkout:invoice}});
 payments.set('1001',payment('1001',first.id));
 const noSignature=await webhook({requestContext:{http:{method:'POST'}},headers:{},queryStringParameters:{'data.id':'1001'},body:JSON.stringify({type:'payment',data:{id:'1001'}})});expect(noSignature.statusCode,401);expect(read('PAYMENT_TABLE_NAME',first.id).status,'PENDING');
 const timestamp='1793188800',requestId='test-request',signature=crypto.createHmac('sha256','TEST_ONLY_SIGNATURE').update(`id:1001;request-id:${requestId};ts:${timestamp};`).digest('hex');
 const approved=await webhook({requestContext:{http:{method:'POST'}},headers:{'x-signature':`ts=${timestamp},v1=${signature}`,'x-request-id':requestId},queryStringParameters:{'data.id':'1001'},body:JSON.stringify({type:'payment',data:{id:'1001'}})});expect(approved.statusCode,200);expect(read('PAYMENT_TABLE_NAME',first.id).status,'APPROVED');expect(read('TOURNAMENT_TABLE_NAME',tid).rosterStatuses,['ACCEPTED','PENDING']);expect(read('TOURNAMENT_TABLE_NAME',tid).draw,undefined);
 const second=await prepareEntry(subs[1],values(1));assert.notEqual(first.id,second.id);checks++;
 payments.set('1002',{...payment('1002',second.id),transaction_amount:499});await reconcilePayment('1002');expect(read('PAYMENT_TABLE_NAME',second.id).status,'PENDING');
 payments.set('1002',payment('1002',second.id));await reconcilePayment('1002');const complete=read('TOURNAMENT_TABLE_NAME',tid);expect(complete.status,'CHECK_IN');expect(allEntriesPaid(complete),true);assert.ok(!complete.draw);checks++;
 const revision=complete.membershipRevision;await reconcilePayment('1001');expect(read('TOURNAMENT_TABLE_NAME',tid).membershipRevision,revision);expect(calls.filter(c=>c.body?.items).length,2);
 assert.throws(()=>assertEntryPaid(complete,{role:'PARTICIPANT',profileId:ids[1]},read('PAYMENT_TABLE_NAME',first.id),subs[1],'LIVE'),/corresponde/);checks++;
 // Nuevas condiciones conservan el pago y requieren una aceptación nueva, sin checkout.
 complete.termsVersion=2;complete.rosterStatuses=['PENDING','ACCEPTED'];complete.membershipRevision++;delete complete.draw;complete.status='AWAITING_RESPONSES';put('TOURNAMENT_TABLE_NAME',complete);const invite=read('INVITATION_TABLE_NAME',tid+':0');invite.status='PENDING';invite.termsVersion=2;put('INVITATION_TABLE_NAME',invite);
 await reconcilePayment('1001');expect(read('TOURNAMENT_TABLE_NAME',tid).rosterStatuses[0],'PENDING');
 await respond({identity:{sub:subs[0]},arguments:{invitationId:invite.id,accept:true,acceptTerms:true,termsVersion:2,acceptOrganizerDecision:true}});expect(read('TOURNAMENT_TABLE_NAME',tid).rosterStatuses[0],'ACCEPTED');expect(calls.filter(c=>c.body?.items).length,2);
 payments.set('1001',{...payment('1001',first.id),status:'refunded',transaction_amount_refunded:500});await reconcilePayment('1001');expect(read('PAYMENT_TABLE_NAME',first.id).status,'REVERSED');expect(allEntriesPaid(read('TOURNAMENT_TABLE_NAME',tid)),false);
 payments.set('1002',{...payment('1002',second.id),transaction_amount_refunded:100});await reconcilePayment('1002');expect(read('PAYMENT_TABLE_NAME',second.id).status,'REVERSED');expect(read('TOURNAMENT_TABLE_NAME',tid).entryPaymentStatuses[1],'REVERSED');
 await assert.rejects(()=>respond({identity:{sub:'organizer'},arguments:{tournamentId:tid}}),/pagos/);checks++;
 // Torneo previo sin tarifa individual: continúa sin cobro retroactivo.
 const old=structuredClone(read('TOURNAMENT_TABLE_NAME',tid));delete old.competitionVersion;delete old.competitionState;delete old.entryFeeCents;delete old.entryPaymentStatuses;expect(allEntriesPaid(old),true);
 old.id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';old.rosterStatuses=['PENDING','ACCEPTED'];old.status='AWAITING_RESPONSES';delete old.draw;put('TOURNAMENT_TABLE_NAME',old);put('INVITATION_TABLE_NAME',{...invite,id:old.id+':0',tournamentId:old.id,status:'PENDING'});
 await respond({identity:{sub:subs[0]},arguments:{invitationId:old.id+':0',accept:true,acceptTerms:true,termsVersion:2,acceptOrganizerDecision:true}});expect(read('TOURNAMENT_TABLE_NAME',old.id).status,'READY');
 // El cargo de juez no genera cobro; sigue pendiente el pago de ambos jugadores.
 const judgeId='33333333-3333-4333-8333-333333333333',judgedId='cccccccc-cccc-4ccc-8ccc-cccccccccccc';put('PROFILE_TABLE_NAME',{id:judgeId,nickname:'Juez de prueba',judgeEnabled:true,owner:'organizer::organizer'});
 await create({identity:{sub:'organizer'},arguments:{...args,tournamentId:judgedId,arbitrationMode:'JUDGES',judgeIds:[judgeId]}});
 await respond({identity:{sub:'organizer'},arguments:{invitationId:judgedId+':2',accept:true,acceptTerms:true,termsVersion:1}});expect(read('TOURNAMENT_TABLE_NAME',judgedId).rosterStatuses,['PENDING','PENDING','ACCEPTED']);expect(calls.filter(c=>c.body?.items).length,2);
 // Cambiar reglas o premio invalida asistencia y sorteo, no los pagos acreditados.
 const {changeCompetition}=require('../amplify/functions/respond-invitation/competition.ts'),{competitionState}=require('../shared/competition.ts'),{prizeAction}=require('../amplify/functions/respond-invitation/prize.ts'),{community}=require('../amplify/functions/community.ts');
 const db=DynamoDBDocumentClient.from(new (require('@aws-sdk/client-dynamodb').DynamoDBClient)({}));
 const resetId='dddddddd-dddd-4ddd-8ddd-dddddddddddd';let draft={...structuredClone(complete),id:resetId,startsAt:new Date(Date.now()-1000).toISOString(),rosterStatuses:['ACCEPTED','ACCEPTED'],entryPaymentStatuses:['APPROVED','APPROVED'],competitionState:'{}',competitionVersion:4,prizeRevision:0};delete draft.draw;
 for(let i=0;i<2;i++)draft=changeCompetition(draft,subs[i],[ids[i]],{action:'ATTENDANCE',ready:true});put('TOURNAMENT_TABLE_NAME',draft);
 await assert.rejects(()=>prizeAction(db,subs[0],{tournamentId:resetId,prizeTitle:'Una cena',prizeHolder:'Organizador',prizeFundingStatus:'CONFIRMED',prizeRevision:0}),/organizador/);checks++;
 const prize=await prizeAction(db,'organizer',{tournamentId:resetId,prizeTitle:'Una cena',prizeHolder:'Organizador',prizeFundingStatus:'CONFIRMED',prizeRevision:0});
 expect(prize.draw,undefined);expect(competitionState(prize).attendance,{});expect(competitionState(prize).startAt,null);expect(prize.entryPaymentStatuses,['APPROVED','APPROVED']);expect(prize.status,'AWAITING_RESPONSES');expect(prize.prizeFundingStatus,'CONFIRMED');
 // Reconstituir la presencia únicamente en esta base ficticia para probar otro cambio.
 draft={...prize,rosterStatuses:['ACCEPTED','ACCEPTED']};for(let i=0;i<2;i++)draft=changeCompetition(draft,subs[i],[ids[i]],{action:'ATTENDANCE',ready:true});put('TOURNAMENT_TABLE_NAME',draft);
 await community(db,'organizer',{action:'COMMUNITY_TERMS',tournamentId:resetId,description:'Nuevas reglas aceptadas explícitamente'});
 const changed=read('TOURNAMENT_TABLE_NAME',resetId);expect(changed.draw,undefined);expect(competitionState(changed).startAt,null);expect(changed.entryPaymentStatuses,['APPROVED','APPROVED']);expect(changed.rosterStatuses,['PENDING','PENDING']);
 changed.competitionState=JSON.stringify({startAt:new Date(Date.now()-1).toISOString()});put('TOURNAMENT_TABLE_NAME',changed);
 await assert.rejects(()=>prizeAction(db,'organizer',{tournamentId:resetId,prizeTitle:'Otro premio',prizeHolder:'Organizador',prizeFundingStatus:'PENDING',prizeRevision:1}),/antes de comenzar/);checks++;
 await assert.rejects(()=>community(db,'organizer',{action:'COMMUNITY_TERMS',tournamentId:resetId,description:'Cambio después de empezar el torneo'}),/bloqueadas/);checks++;
 // La operación pública devuelve una señal mínima y persiste con revisión en la tabla.
 const {handler:resolver}=require('../amplify/functions/respond-invitation/handler.ts');
 const liveId='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',live={...draft,id:liveId,competitionState:'{}',membershipRevision:0,rosterStatuses:['ACCEPTED','ACCEPTED'],status:'CHECK_IN'};delete live.draw;put('TOURNAMENT_TABLE_NAME',live);
 await assert.rejects(()=>resolver({fieldName:'tournamentCompetition',identity:{sub:'organizer'},arguments:{tournamentId:liveId,action:'ATTENDANCE',ready:true}}),/propia/);checks++;
 const signal=await resolver({fieldName:'tournamentCompetition',identity:{sub:subs[0]},arguments:{tournamentId:liveId,action:'ATTENDANCE',ready:true}});expect(signal.tournamentId,liveId);expect(Object.keys(signal).sort(),['changedAt','id','status','tournamentId']);expect(read('TOURNAMENT_TABLE_NAME',liveId).membershipRevision,1);
 const signal2=await resolver({fieldName:'tournamentCompetition',identity:{sub:subs[1]},arguments:{tournamentId:liveId,action:'ATTENDANCE',ready:true}});expect(signal2.status,'CHECK_IN');expect(read('TOURNAMENT_TABLE_NAME',liveId).membershipRevision,2);expect(read('TOURNAMENT_TABLE_NAME',liveId).draw,null);
 await resolver({fieldName:'tournamentCompetition',identity:{sub:'organizer'},arguments:{tournamentId:liveId,action:'DRAW_SCHEDULE'}});
 const waiting=read('TOURNAMENT_TABLE_NAME',liveId),clock=JSON.parse(waiting.competitionState);clock.drawAt=new Date(Date.now()-1).toISOString();waiting.competitionState=JSON.stringify(clock);put('TOURNAMENT_TABLE_NAME',waiting);
 const drawn=await resolver({fieldName:'tournamentCompetition',identity:{sub:subs[1]},arguments:{tournamentId:liveId,action:'DRAW_FINISH'}});expect(drawn.status,'READY');assert.ok(read('TOURNAMENT_TABLE_NAME',liveId).draw);checks++;
 // Gratuidad global: sólo el administrador puede activarla; no se abre MP.
 const {handler:billing}=require('../amplify/functions/billing/handler.ts');put('CLAIM_TABLE_NAME',{id:'creator',accountSub:'organizer'});
 await assert.rejects(()=>billing({fieldName:'setTournamentFee',identity:{sub:subs[0]},arguments:{amountCents:50000,enabled:true,freeEntries:true}}),/Sólo/);checks++;
 const free=await billing({fieldName:'setTournamentFee',identity:{sub:'organizer'},arguments:{amountCents:70000,enabled:true,freeEntries:true}});expect(free.freeEntries,true);expect(free.participantAmountCents,0);expect(free.standardAmountCents,70000);
 const freeId='ffffffff-ffff-4fff-8fff-ffffffffffff',beforeFree=calls.length;await create({identity:{sub:'organizer'},arguments:{...args,tournamentId:freeId}});expect(read('TOURNAMENT_TABLE_NAME',freeId).entryFeeCents,0);
 for(let i=0;i<2;i++)await respond({identity:{sub:subs[i]},arguments:{invitationId:freeId+':'+i,accept:true,acceptTerms:true,termsVersion:1,acceptOrganizerDecision:true}});
 expect(read('TOURNAMENT_TABLE_NAME',freeId).rosterStatuses,['ACCEPTED','ACCEPTED']);expect(calls.length,beforeFree);expect(allEntriesPaid(read('TOURNAMENT_TABLE_NAME',freeId)),true);
 const paidAgain=await billing({fieldName:'setTournamentFee',identity:{sub:'organizer'},arguments:{amountCents:70000,enabled:true,freeEntries:false}});expect(paidAgain.participantAmountCents,70000);expect(read('TOURNAMENT_TABLE_NAME',freeId).entryFeeCents,0);expect(read('TOURNAMENT_TABLE_NAME',tid).entryFeeCents,50000);
 const preserve=await billing({fieldName:'setTournamentFee',identity:{sub:'organizer'},arguments:{amountCents:70000,enabled:true,freeEntries:true}});expect(preserve.freeEntries,true);
 await billing({fieldName:'setTournamentFee',identity:{sub:'organizer'},arguments:{amountCents:70000,enabled:true}});expect(read('BILLING_SETTINGS_TABLE_NAME','participation').freeEntries,true);
 process.env.MERCADOPAGO_MODE='test';await require('../amplify/functions/billing/common.ts').assertBillingAccess(subs[0]);checks++;process.env.MERCADOPAGO_MODE='live';
 // Torneo finalizado: eliminación individual, texto obligatorio y permisos del servidor.
 const {handler:maintenance}=require('../amplify/functions/maintenance/handler.ts');const playedId='abababab-abab-4bab-8bab-abababababab';put('TOURNAMENT_TABLE_NAME',{...read('TOURNAMENT_TABLE_NAME',freeId),id:playedId,status:'COMPLETED',winnerProfileId:ids[0],createdBySub:'another-organizer'});
 await assert.rejects(()=>maintenance({fieldName:'deleteClubTournament',identity:{sub:'organizer'},arguments:{tournamentId:playedId}}),/ELIMINAR/);checks++;
 await assert.rejects(()=>maintenance({fieldName:'deleteClubTournament',identity:{sub:subs[0]},arguments:{tournamentId:playedId,confirmation:'ELIMINAR'}}),/organizador/);checks++;
 expect(read('TOURNAMENT_TABLE_NAME',playedId).status,'COMPLETED');
 expect(await maintenance({fieldName:'deleteClubTournament',identity:{sub:'organizer'},arguments:{tournamentId:playedId,confirmation:'ELIMINAR'}}),true);expect(read('TOURNAMENT_TABLE_NAME',playedId).status,'DELETED');expect(read('TOURNAMENT_TABLE_NAME',freeId).status,'CHECK_IN');

 console.log(`${checks} comprobaciones de inscripción correctas. Todos los cobros, tablas y webhooks fueron simulados sin red.`);
})().catch(error=>{console.error(error);process.exitCode=1;});
