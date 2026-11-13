// Datos ficticios y SDK simulado: verifica privacidad y presentación sin tocar el club.
const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
const {DynamoDBDocumentClient}=require('@aws-sdk/lib-dynamodb');let checks=0;const ok=(a,b)=>{assert.deepEqual(a,b);checks++;};
for(const key of ['SOCIAL_TABLE_NAME','CLAIM_TABLE_NAME','PROFILE_TABLE_NAME'])process.env[key]=key;
const rows=new Map([
 ['SOCIAL_TABLE_NAME:USER#me:STATE',{incoming:[{sub:'other',profileId:'p1'},{sub:'deleted',profileId:'p2'}],friends:[],outgoing:[]}],
 ['SOCIAL_TABLE_NAME:USER#victim:STATE',{incoming:[{sub:'secret-person',profileId:'secret'}]}],
 ['PROFILE_TABLE_NAME:p1',{id:'p1',nickname:'Ana',owner:'other::other',avatarPath:'profile-private/other/photo.webp',phoneNumber:'+5491122222222',email:'private@example.com',bio:'PRIVATE BIO',visibility:'PRIVATE'}],
 ['PROFILE_TABLE_NAME:p2',{id:'p2',nickname:'Borrado',owner:'deleted::deleted'}],
 ['CLAIM_TABLE_NAME:deleted-account:deleted',{id:'deleted-account:deleted'}],
]);
const now=Date.now(),at=n=>new Date(now+n).toISOString();
DynamoDBDocumentClient.prototype.send=async function(command){const c=command.input;
 if(command.constructor.name==='GetCommand'){const id=c.Key.id || c.Key.pk;return {Item:rows.get(c.TableName+':'+id+(c.Key.sk?':'+c.Key.sk:''))};}
 if(command.constructor.name==='QueryCommand'){ok(c.ExpressionAttributeValues[':pk'],'CLUB_NOTICES');return {Items:[{sk:'NOTICE#1',published:true,publishedAt:at(-1000),title:'Aviso real',message:'Texto del club',internal:'PRIVATE DATA',href:'/torneos.html'},{sk:'NOTICE#2',published:true,publishedAt:at(60000),title:'Futuro'},{sk:'NOTICE#3',published:false,publishedAt:at(-1000),title:'Borrador'},{sk:'NOTICE#4',published:true,publishedAt:at(-1000),expiresAt:at(-1),title:'Vencido'}]};}
 throw new Error('No se permiten escrituras en esta prueba');
};
(async()=>{
 const {community}=require('../amplify/functions/community.ts'),{notificationItems}=await import('../src/notification-items.js');
 const feed=await community(DynamoDBDocumentClient.from(new (require('@aws-sdk/client-dynamodb').DynamoDBClient)({})),'me',{action:'COMMUNITY_NOTIFICATIONS',targetProfileId:'victim'});
 ok(feed.friendRequests.length,1);ok(feed.friendRequests[0].nickname,'Ana');ok(Object.keys(feed.friendRequests[0]).sort(),['avatarPath','nickname','profileId']);ok(JSON.stringify(feed).includes('PRIVATE'),false);ok(JSON.stringify(feed).includes('private@example.com'),false);ok(JSON.stringify(feed).includes('secret-person'),false);ok(feed.announcements.length,1);ok(Object.keys(feed.announcements[0]).sort(),['href','id','message','title']);
 const invites=[{tournamentId:'t1',tournamentName:'Duelo',role:'PARTICIPANT',termsVersion:1},{tournamentId:'t1',tournamentName:'Duelo',role:'JUDGE',termsVersion:1}];
 const items=notificationItems(invites,feed);ok(items.length,3);ok(items[0].text,'Te invitaron a competir y ser juez en «Duelo».');ok(items[0].href,'/torneo.html?id=t1');ok(items[1].text,'Ana te envió una solicitud de amistad.');ok(items[1].href,'/amigos.html');ok(items[2].href,'/torneos.html');
 for(const href of ['javascript:alert(1)','https://evil.test/','//evil.test/','https://proveitclub.win.evil.test/','https://x:secret@proveitclub.win/'])ok(notificationItems([],{announcements:[{id:'bad',title:'Aviso',href}]} )[0].href,null);
 ok(notificationItems([],{announcements:[{id:'message',message:'Sólo texto'}]})[0].href,null);
 ok(notificationItems([],{friendRequests:[feed.friendRequests[0],feed.friendRequests[0]]}).length,1);ok(notificationItems().length,0);
 const changed=notificationItems(invites.map(invite=>({...invite,termsVersion:2,termsChangedBy:'JUDGE'})));
 ok(changed.length,1);
 ok(changed[0].id,'tournament:t1:2');
 ok(changed[0].text,'El juez o jurado cambió las condiciones de «Duelo». Revisalas antes de volver a confirmar tu participación.');
 console.log(checks+' comprobaciones correctas: bandeja unificada, solicitudes propias, privacidad, avisos publicados, vínculos seguros y eventos sin duplicar.');
})().catch(e=>{console.error(e);process.exitCode=1;});
