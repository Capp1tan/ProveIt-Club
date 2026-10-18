import {mountBadgeAdmin} from './badges.js';
import {mountBillingAdmin} from './billing-admin.js';
import {mountJudgeReportAdmin} from './judge-ui.js';
import {configureAmplify,profileClient} from './auth-client.js';
import {socialLinks} from './profile-components.js';
import {Hub} from 'aws-amplify/utils';
import '../admin.css';
import '../community.css';
const root=document.getElementById('adminApp'),notice=document.getElementById('adminNotice');
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
let epoch=0,busy=false,section='USERS',cursor=null,next=null,history=[],query='',api,room=null;
const sections=[['USERS','Cuentas'],['PROFILES','Perfiles'],['PRIVATE_ACCOUNTS','Teléfonos registrados'],['TOURNAMENTS','Torneos'],['PAYMENTS','Pagos'],['INVITATIONS','Invitaciones'],['BADGES','Emblemas'],['FRIENDSHIPS','Amistades'],['JUDGES','Reputación de jueces'],['REPORTS','Reclamos'],['ROOMS','Salas y mensajes'],['SETTINGS','Configuración de tarifas'],['CLAIMS','Reservas y accesos'],['AUDIT','Registro de consultas']];
async function request(action,args={}){const current=epoch;let timeout,r;try{r=await Promise.race([api.mutations.clubAdmin({action,...args}),new Promise((_,reject)=>{timeout=setTimeout(()=>reject(new Error('La consulta tardó demasiado. Podés reintentar; no se modificaron datos.')),35000);})]);}finally{clearTimeout(timeout);}if(current!==epoch)throw new Error('La sesión cambió.');if(r.errors?.length)throw new Error(r.errors.map(e=>e.message).join(' '));if(!r.data)throw new Error('No se recibió una respuesta del servidor.');return JSON.parse(r.data);}
Hub.listen('auth',({payload})=>{if(['signedOut','signedIn'].includes(payload.event)){epoch++;root.replaceChildren();notice.textContent='La sesión cambió. Recargá para volver a comprobar tu acceso.';}});
const nav=el('nav','','admin-sections'),panel=el('section','','admin-panel'),heading=el('h2','Cuentas'),list=el('div','','admin-records'),detail=el('section','','admin-detail');
detail.hidden=true;detail.setAttribute('aria-live','polite');
const searchForm=el('form','','admin-search'),search=el('input'),searchButton=el('button','Buscar','social-button'),reload=el('button','Actualizar','social-button');
search.type='search';search.maxLength=100;search.autocomplete='off';search.placeholder='Nick, correo, nombre o identificador';search.setAttribute('aria-label','Buscar datos en la sección');searchButton.type='submit';reload.type='button';searchForm.append(search,searchButton,reload);
const paging=el('div','','admin-paging'),previous=el('button','← Página anterior','social-button'),following=el('button','Página siguiente →','social-button'),pageNotice=el('p','','social-help');
previous.type=following.type='button';paging.append(previous,pageNotice,following);
panel.append(heading,searchForm,list,paging,detail);
function setBusy(value){busy=value;searchButton.disabled=reload.disabled=value;previous.disabled=value || !history.length;following.disabled=value || !next;nav.querySelectorAll('button').forEach(b=>b.disabled=value);}
function jsonView(value){const wrapper=el('details'),summary=el('summary','Ver registro completo'),pre=el('pre',JSON.stringify(value,null,2),'admin-json');wrapper.append(summary,pre);return wrapper;}
function addField(parent,label,value){const row=el('div','','admin-field');row.append(el('dt',label),el('dd',value===undefined || value===null || value===''?'Sin dato':String(value)));parent.append(row);}
function date(v){if(!v)return 'Sin fecha';const d=new Date(v);return Number.isNaN(d.valueOf())?String(v):d.toLocaleString('es-AR');}
function link(label,url){const a=el('a',label,'social-button');a.href=url;return a;}
async function account(row){
 if(busy)return;setBusy(true);const current=epoch;detail.hidden=false;detail.replaceChildren(el('p','Cargando ficha de la cuenta…'));
 try{
  const data=await request('USER',{targetId:row.id});if(current!==epoch)return;
  const u=data.identity,p=data.profile,fields=el('dl','','admin-fields');detail.replaceChildren(el('h2',p?.nickname || 'Cuenta sin perfil'));
  addField(fields,'Correo electrónico',u.email);addField(fields,'Correo verificado',u.email_verified==='true'?'Sí':'No');
  addField(fields,'Teléfono del perfil',data.account?.phoneNumber);addField(fields,'Teléfono verificado por SMS',data.account?.phoneVerified?'Sí':'No');addField(fields,'Teléfono opcional',data.phoneOptional?'Sí':'No');
  addField(fields,'Estado',u.status);addField(fields,'Acceso habilitado',u.enabled?'Sí':'No');addField(fields,'ID de cuenta',u.sub);addField(fields,'Creada',date(u.createdAt));
  addField(fields,'Privacidad',p?.visibility==='PUBLIC'?'Público':'Privado');addField(fields,'Disponible como juez',p?.judgeEnabled?'Sí':'No');addField(fields,'Biografía',p?.bio);
  detail.append(fields);if(p){detail.append(socialLinks({...p,canView:true}),link('Abrir perfil del club','/perfil.html?id='+encodeURIComponent(p.id)));
   if(p.avatarPath){const photo=el('button','Ver foto de la cuenta','social-button');photo.type='button';photo.addEventListener('click',async()=>{photo.disabled=true;try{const r=await request('AVATAR',{targetId:p.id});const img=el('img','','admin-avatar');img.src=r.url;img.alt='Foto de '+p.nickname;photo.replaceWith(img);}catch(e){notice.textContent=e.message;photo.disabled=false;}});detail.append(photo);}
  }
  detail.append(jsonView(data));notice.textContent='Ficha administrativa consultada. El acceso quedó registrado.';
 }catch(e){if(current===epoch)detail.replaceChildren(el('p',e.message));}finally{if(current===epoch)setBusy(false);}
}
function roomView(row){
 detail.hidden=false;detail.replaceChildren(el('h2',row.name || 'Consulta de mensajes'),el('p','Acceso administrativo registrado. Indicá el motivo de soporte, moderación o revisión. No se modifican mensajes.'));
 const form=el('form','','community-form'),label=el('label','Motivo de la consulta'),reason=el('textarea'),open=el('button','Consultar mensajes','social-button'),messages=el('div','','admin-messages'),older=el('button','Cargar mensajes anteriores','social-button');
 reason.required=true;reason.minLength=10;reason.maxLength=500;reason.rows=2;label.append(reason);open.type='submit';older.type='button';older.hidden=true;form.append(label,open);detail.append(form,messages,older);
 let messageCursor=null,reading=false;const current=epoch;
 const load=async(reset)=>{if(reading)return;reading=true;open.disabled=older.disabled=true;
  try{const r=await request('MESSAGES',{roomKey:row.roomKey,reason:reason.value,cursor:reset?null:messageCursor});if(current!==epoch)return;if(reset)messages.replaceChildren();for(const m of r.rows){const item=el('article','','admin-message');item.append(el('strong',m.senderName || m.senderProfileId),el('small',date(m.createdAt)),el('p',m.body));messages.append(item);}messageCursor=r.cursor;older.hidden=!messageCursor;notice.textContent=r.rows.length?'Mensajes más recientes primero. Consulta registrada.':'La sala no tiene mensajes disponibles.';}
  catch(e){if(current===epoch)notice.textContent=e.message;}finally{reading=false;open.disabled=older.disabled=false;}
 };
 form.addEventListener('submit',e=>{e.preventDefault();void load(true);});older.addEventListener('click',()=>void load(false));
}
async function record(row){
 if(busy)return;
 if(section==='PAYMENTS'){setBusy(true);try{row=(await request('RECORD',{collection:section,targetId:row.id})).row;if(!row)throw new Error('El registro ya no existe.');}catch(e){notice.textContent=e.message;return;}finally{setBusy(false);}}
 detail.hidden=false;detail.replaceChildren(el('h2','Detalle del registro'));const fields=el('dl','','admin-fields');
 const labels={id:'Identificador',name:'Nombre',nickname:'Nick',status:'Estado',activity:'Actividad',format:'Formato',createdAt:'Creado',updatedAt:'Actualizado',startsAt:'Inicio',timeZone:'Zona horaria',createdBySub:'Cuenta organizadora',accountSub:'Cuenta',phoneNumber:'Teléfono',phoneVerified:'Teléfono verificado por SMS',code:'Insignia',reason:'Motivo',reviewReason:'Motivo de revisión',prizeTitle:'Premio',prizeHolder:'Responsable del premio',prizeFunder:'Financia el premio',prizeFundingStatus:'Confirmación del premio',deletedAt:'Eliminado',visibility:'Privacidad',judgeEnabled:'Disponible como juez',currency:'Moneda',paymentMode:'Modo de pago',amountCents:'Importe en centavos',tournamentName:'Torneo',role:'Rol',consentAcceptedAt:'Aceptación',requestedAt:'Consulta solicitada',actorSub:'Administrador',action:'Acción',target:'Registro consultado'};
 if(Number.isInteger(row.amountCents))addField(fields,'Importe',new Intl.NumberFormat('es-AR',{style:'currency',currency:row.currency || 'ARS'}).format(row.amountCents/100));
 for(const [key,value] of Object.entries(row))if(key in labels && value!==null && typeof value!=='object')addField(fields,labels[key],typeof value==='boolean'?(value?'Sí':'No'):value);
 detail.append(fields,jsonView(row));const tournament=row.tournamentId || (section==='TOURNAMENTS'?row.id:null);if(tournament)detail.prepend(link('Abrir torneo','/torneo.html?id='+encodeURIComponent(tournament)));
 const target=section==='PROFILES'?row.owner?.split('::')[0]:row.accountSub || row.createdBySub;
 if(target){const b=el('button','Consultar ficha de la cuenta','social-button');b.type='button';b.addEventListener('click',()=>void account({id:target}));detail.prepend(b);}
}
function renderRows(rows){
 list.replaceChildren();if(!rows.length){list.append(el('p','No hay coincidencias en esta página. Si hay más páginas, podés continuar con «Página siguiente».'));return;}
 const table=el('table','','admin-table'),head=el('thead'),hr=el('tr');
 const labels=section==='USERS'?['Cuenta','Correo','Estado','Acción']:section==='ROOMS'?['Sala','Identificador','Tipo','Acción']:['Registro','Descripción','Estado o fecha','Acción'];
 for(const title of labels)hr.append(el('th',title));head.append(hr);table.append(head);const body=el('tbody');
 for(const row of rows){const tr=el('tr'),values=section==='USERS'?[row.nickname,row.email || 'Sin correo',(row.enabled?'Habilitada':'Deshabilitada')+' · '+row.status]:section==='ROOMS'?[row.name || 'Sala',row.roomKey,row.roomKey?.startsWith('DM#')?'Privada':'Torneo']:[row.id || row.sk || row.pk || 'Registro',row.name || row.tournamentName || row.nickname || row.peerName || row.reason || row.action || row.code || row.target || row.pk || 'Datos del club',row.status || row.createdAt || row.updatedAt || row.requestedAt || ''];
  values.forEach(v=>tr.append(el('td',String(v || ''))));const td=el('td'),b=el('button',section==='USERS'?'Ver cuenta':section==='ROOMS'?'Consultar sala':'Ver detalle','social-button');b.type='button';b.addEventListener('click',()=>{if(section==='USERS')void account(row);else if(section==='ROOMS')roomView(row);else record(row);});td.append(b);tr.append(td);body.append(tr);
 }table.append(body);const scroll=el('div','','admin-table-scroll');scroll.append(table);list.append(scroll);
}
async function load(){
 if(busy)return;setBusy(true);detail.hidden=true;detail.replaceChildren();const current=epoch;notice.textContent='Consultando datos…';
 const management={BADGES:mountBadgeAdmin,SETTINGS:mountBillingAdmin,REPORTS:mountJudgeReportAdmin};
 searchForm.hidden=Boolean(management[section]);paging.hidden=Boolean(management[section]);
 if(management[section]){list.replaceChildren();try{await management[section](list);notice.textContent='Herramientas de administración. Cada cambio vuelve a validar tu permiso en el servidor.';}catch(e){notice.textContent=e.message;}finally{setBusy(false);}return;}
 try{const r=await request(section==='USERS'?'USERS':'RECORDS',{collection:section,search:query,cursor});if(current!==epoch)return;next=r.cursor;renderRows(r.rows);pageNotice.textContent='Página '+(history.length+1)+' · '+r.rows.length+' registros'+(next?' · hay más':'');notice.textContent='Consulta administrativa registrada. Usá Emblemas, Tarifas y Reclamos para administrar el club; cada torneo se gestiona desde su ficha.';}
 catch(e){if(current===epoch){list.replaceChildren();notice.textContent=e.message;next=null;}}finally{if(current===epoch)setBusy(false);}
}
for(const [key,name] of sections){const b=el('button',name,'social-button');b.type='button';b.setAttribute('aria-pressed',String(key===section));b.addEventListener('click',()=>{section=key;query='';search.value='';cursor=next=null;history=[];heading.textContent=name;nav.querySelectorAll('button').forEach(n=>n.setAttribute('aria-pressed',String(n===b)));void load();});nav.append(b);}
searchForm.addEventListener('submit',e=>{e.preventDefault();query=search.value.trim();cursor=next=null;history=[];void load();});reload.addEventListener('click',()=>void load());
following.addEventListener('click',()=>{if(!next || busy)return;history.push(cursor);cursor=next;void load();});previous.addEventListener('click',()=>{if(!history.length || busy)return;cursor=history.pop();void load();});
try{
 if(!await configureAmplify())throw new Error('No pudimos conectar con el club.');api=await profileClient();await request('ACCESS');
 root.append(el('p','Acceso exclusivo del administrador general. Correo, teléfono y perfiles privados se consultan aquí; no se vuelven públicos. No se muestran contraseñas, tokens ni claves de pago.','admin-access'),nav,panel);
 await load();
}catch(e){notice.textContent=e.message || 'Acceso exclusivo del administrador.';root.replaceChildren();}
finally{window.proveitLoadingDone?.('page');}
