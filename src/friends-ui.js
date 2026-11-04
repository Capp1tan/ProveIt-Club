import '../social.css';
import '../friends.css';
import {configureAmplify,getCurrentUser,avatarUrl} from './auth-client.js';
import {registeredProfiles} from './tournaments-api.js';
import {loadBadges,badgeElements,decorateAvatar} from './badges.js';
import {socialAction} from './social-api.js';
import {openDirectChat} from './chat-dock.js';
import {Hub} from 'aws-amplify/utils';

const root=document.getElementById('friendsApp'),notice=document.getElementById('friendsNotice'),headingActions=document.getElementById('friendsHeadingActions');
const el=(tag,text='',cls='')=>{const n=document.createElement(tag);n.textContent=text;if(cls)n.className=cls;return n;};
const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
const svg={add:'<circle cx="9" cy="8" r="3"/><path d="M2 21v-3a7 7 0 0 1 14 0v3m3-13v6m-3-3h6"/>',chat:'<path d="M21 11a9 9 0 0 1-9 9H4l-3 2 2-6a9 9 0 1 1 18-5Z"/>',swords:'<path d="m3 3 11 11m-3 3 6-6m-1 5 5 5M21 3 10 14m-3-3 6 6m-5-1-5 5M3 3l1 5 4-4ZM21 3l-1 5-4-4Z"/>',share:'<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.5 10.5 7-4m-7 7 7 4"/>',check:'<path d="m5 12 4 4L19 6"/>'};
function icon(name){const n=el('span','','friends-icon');n.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${svg[name] || ''}</svg>`;return n;}
function button(label,fn,primary=false,kind){const b=el('button','','friends-button'+(primary?' is-primary':''));b.type='button';if(kind)b.append(icon(kind));b.append(document.createTextNode(label));b.addEventListener('click',fn);return b;}
let user=null,state=null,profiles=[],busy=false,closed=false,refreshing=false,timer,epoch=0,activeTab='friends',tabChosen=false,fingerprint='',tabAnimation;
const target=new URLSearchParams(location.search).get('persona'),photos=new Map();
const tabs=el('div','','friends-tabs'),indicator=el('span','','friends-tab-indicator'),panel=el('section','','friends-tab-panel'),limit=el('p','','friends-limit');
tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','Amigos y solicitudes');indicator.setAttribute('aria-hidden','true');tabs.append(indicator);
panel.id='friendsTabPanel';panel.setAttribute('role','tabpanel');panel.tabIndex=0;
const tabButtons=new Map();
for(const [id,label] of [['friends','Amigos'],['incoming','Solicitudes'],['outgoing','Enviadas']]){
 const b=el('button','','friends-tab');b.type='button';b.id='friendsTab-'+id;b.setAttribute('role','tab');b.setAttribute('aria-controls',panel.id);b.append(el('span',label),el('span','','friends-tab-count'));b.addEventListener('click',()=>selectTab(id,true));tabs.append(b);tabButtons.set(id,b);
 b.addEventListener('keydown',event=>{const ids=[...tabButtons.keys()],i=ids.indexOf(id);let next;if(event.key==='ArrowRight')next=(i+1)%3;if(event.key==='ArrowLeft')next=(i+2)%3;if(event.key==='Home')next=0;if(event.key==='End')next=2;if(next!==undefined){event.preventDefault();selectTab(ids[next],false);tabButtons.get(ids[next]).focus();}});
}
function say(message,error=false){notice.textContent=message;notice.dataset.error=String(error);}
function moveIndicator(animate=false){const selected=tabButtons.get(activeTab);if(!selected?.isConnected)return;const old=indicator.getBoundingClientRect();tabAnimation?.cancel();indicator.style.left=selected.offsetLeft+'px';indicator.style.width=selected.offsetWidth+'px';const next=indicator.getBoundingClientRect();if(animate && !reduced() && old.width && next.width && indicator.animate)tabAnimation=indicator.animate([{transform:`translateX(${old.left-next.left}px) scaleX(${old.width/next.width})`},{transform:'none'}],{duration:180,easing:'cubic-bezier(.23,1,.32,1)'});}
function updateTabs(animate=false){for(const [id,b] of tabButtons){const selected=id===activeTab,n=state?.[id]?.length || 0;b.setAttribute('aria-selected',String(selected));b.tabIndex=selected?0:-1;const count=b.lastElementChild;count.textContent=String(n);count.hidden=!n;}panel.setAttribute('aria-labelledby','friendsTab-'+activeTab);moveIndicator(animate);}
function selectTab(id,animate=false){if(!state || closed)return;activeTab=id;tabChosen=true;updateTabs(animate);renderPanel(animate);}
function enter(surface){if(!reduced() && surface.animate)surface.animate([{opacity:0,transform:'translateY(6px)'},{opacity:1,transform:'translateY(0)'}],{duration:190,easing:'cubic-bezier(.23,1,.32,1)'});}
function person(ref,kind){
 const p=profiles.find(p=>p.id===ref.profileId),name=p?.nickname || 'Cuenta no disponible',row=el('li','','friend-card'),photo=el('span',Array.from(name)[0] || '?','person-avatar friend-avatar');
 decorateAvatar(photo,p?.owner?.split('::')[0]);photo.setAttribute('aria-hidden','true');
 if(p?.avatarPath){const key=p.id+':'+p.avatarPath;if(!photos.has(key))photos.set(key,avatarUrl(p.avatarPath,{profileId:p.id}).catch(()=>''));const token=epoch;void photos.get(key).then(url=>{if(token!==epoch || !url || !row.isConnected)return;const img=el('img');img.alt='';img.width=48;img.height=48;img.loading='lazy';img.decoding='async';img.src=url;img.addEventListener('error',()=>{photo.textContent=Array.from(name)[0] || '?';},{once:true});photo.replaceChildren(img);});}
 const copy=el('div','','friend-copy'),identity=el('div','','friend-name'),link=el('a',name);link.href='/perfil.html?id='+encodeURIComponent(ref.profileId);identity.append(link,badgeElements(p?.owner?.split('::')[0]));
 copy.append(identity,el('small',kind==='incoming'?'Quiere sumarse a tu grupo':kind==='outgoing'?'Solicitud pendiente':kind==='directory'?'Miembro del club':'Amigo en ProveIt'));
 const actions=el('div','','friend-actions');
 const action=(label,code,primary=false)=>{const b=button(label,()=>void act(code,ref.profileId),primary,code==='ACCEPT'?'check':undefined);b.dataset.friendAction='';b.disabled=busy;return b;};
 if(kind==='friends'){
  actions.append(button('Chatear',()=>openChat(ref),false,'chat'));
  const challenge=el('a','','friends-button friend-challenge');challenge.href='/crear-torneo.html?rival='+encodeURIComponent(ref.profileId);challenge.setAttribute('aria-label','Desafiar a '+name);challenge.append(icon('swords'),el('span','Desafiar'));actions.append(challenge);
  const more=el('details','','friend-more'),summary=el('summary','⋯');summary.setAttribute('aria-label','Más opciones con '+name);const remove=button('Quitar amigo',()=>{if(confirm(`¿Quitar a ${name} de tus amigos? El chat quedará inaccesible hasta que vuelvan a agregarse.`))void act('REMOVE',ref.profileId);});remove.dataset.friendAction='';remove.disabled=busy;more.append(summary,remove);more.addEventListener('toggle',()=>{if(more.open)panel.querySelectorAll('details[open]').forEach(d=>{if(d!==more)d.open=false;});});actions.append(more);
 }else if(kind==='incoming')actions.append(action('Aceptar','ACCEPT',true),action('Rechazar','DECLINE'));
 else if(kind==='outgoing')actions.append(action('Cancelar','CANCEL'));
 else actions.append(action('Agregar','REQUEST',true));
 row.append(photo,copy,actions);return row;
}
function empty(title,description,actions=[],seats=4){const box=el('div','','friends-empty'),art=el('div','','friends-empty-art');art.setAttribute('aria-hidden','true');for(let i=0;i<seats;i++){const seat=el('span');seat.style.setProperty('--seat',i);art.append(seat);}box.append(art,el('h2',title),el('p',description));if(actions.length){const controls=el('div','','friends-empty-actions');controls.append(...actions);box.append(controls);}return box;}
const addButton=()=>button('Sumá a tu grupo',()=>void openPicker(),true,'add');
async function share(){const data={title:'ProveIt Club',text:'Armemos un desafío en ProveIt. Creá tu perfil y te agrego.',url:location.origin};try{if(navigator.share)await navigator.share(data);else{await navigator.clipboard.writeText(data.url);say('Link copiado. Pasalo por el grupo.');}}catch(error){if(error.name!=='AbortError')say('No pudimos compartir el enlace. Podés copiar la dirección del sitio.',true);}}
function renderPanel(animate=false){panel.replaceChildren();const refs=state[activeTab] || [];if(refs.length){const list=el('ul','','friends-grid');list.append(...refs.map(ref=>person(ref,activeTab)));panel.append(list);}else if(activeTab==='friends')panel.append(empty('Tu grupo está vacío','Un torneo sin rivales es un monólogo. Sumá a los que siempre dicen “yo te gano”.',[addButton(),button('Compartir link',share,false,'share')]));else if(activeTab==='incoming')panel.append(empty('Nada para responder','Cuando alguien te mande una solicitud, aparece acá.',[],2));else panel.append(empty('No mandaste solicitudes','Buscá a tu gente y mandales una.',[addButton()],2));if(animate)enter(panel);}
function render(force=false){if(!state || closed)return;const version=JSON.stringify({state,profiles});if(!force && fingerprint===version)return;fingerprint=version;if(!headingActions.firstElementChild)headingActions.append(addButton());limit.textContent=state.friends.length+' amigos · '+(state.limit===null?'sin límite para tu cuenta':state.limit+' como máximo');if(!tabs.isConnected){root.replaceChildren(tabs,limit,panel);if(!tabChosen && state.incoming.length)activeTab='incoming';}updateTabs();renderPanel();if(picker.open)renderPicker();}
function setBusy(value){busy=value;document.querySelectorAll('[data-friend-action]').forEach(b=>b.disabled=value);}
async function act(action,id){if(busy || closed)return;setBusy(true);const token=epoch;say('Guardando…');
 try{await socialAction(action,{targetProfileId:id});if(token!==epoch)return;const next=await socialAction('STATE');if(token!==epoch)return;state=next;try{const people=await registeredProfiles();if(token!==epoch)return;profiles=people;photos.clear();}catch{/* Los nombres ya cargados siguen siendo públicos. */}render(true);say(({REQUEST:'Solicitud enviada.',ACCEPT:'¡Sumaste un amigo! Ya pueden chatear.',DECLINE:'Solicitud rechazada.',CANCEL:'Solicitud cancelada.',REMOVE:'Amistad eliminada.'})[action]);window.dispatchEvent(new Event('proveit:social-updated'));}
 catch(error){if(token===epoch)say(error.message || 'No pudimos guardar el cambio.',true);}finally{if(token===epoch)setBusy(false);}
}
function openChat(ref){openDirectChat({profileId:ref.profileId,name:profiles.find(p=>p.id===ref.profileId)?.nickname || 'Chat privado'});}

// El selector usa el directorio autorizado; abrirlo no envía solicitudes.
const picker=el('dialog','','friends-picker'),pickerHead=el('div','','friends-picker-head'),pickerTitle=el('h2','Sumá a tu grupo'),pickerClose=button('×',()=>closePicker()),search=el('input'),directory=el('ul','','friends-picker-list'),pickerStatus=el('p','','friends-picker-status');
pickerTitle.id='friendPickerTitle';picker.setAttribute('aria-labelledby',pickerTitle.id);pickerClose.setAttribute('aria-label','Cerrar búsqueda de amigos');pickerHead.append(pickerTitle,pickerClose);search.type='search';search.placeholder='Buscá por nickname';search.setAttribute('aria-label','Buscar personas por nick');search.maxLength=24;
picker.append(pickerHead,el('p','Buscá a tu gente y mandales una solicitud.','friends-picker-description'),search,pickerStatus,directory);document.body.append(picker);let pickerOrigin,pickerAnimation,pickerClosing=false;
function renderPicker(){directory.replaceChildren();const q=search.value.trim().toLocaleLowerCase('es'),taken=new Set([...state.friends,...state.incoming,...state.outgoing].map(r=>r.profileId));const matches=profiles.filter(p=>p.accountComplete!==false && p.id!==user.userId && !(user.username && p.owner===user.username) && !p.owner?.startsWith(user.userId+'::') && !taken.has(p.id) && (q?p.nickname.toLocaleLowerCase('es').includes(q):p.id===target)).slice(0,20);directory.append(...matches.map(p=>person({profileId:p.id},'directory')));pickerStatus.textContent=matches.length?'':q?'No encontramos personas disponibles con ese nick.':'Escribí un nick para encontrar a alguien.';}
async function openPicker(){if(!state || closed || picker.open)return;pickerOrigin=document.activeElement;pickerClosing=false;picker.showModal();enter(picker);search.focus();renderPicker();}
function closePicker(immediate=false){if(!picker.open || pickerClosing)return;pickerClosing=true;pickerAnimation?.cancel();if(immediate || reduced() || !picker.animate){picker.close();return;}pickerAnimation=picker.animate([{opacity:1,transform:'translateY(0) scale(1)'},{opacity:0,transform:'translateY(4px) scale(.985)'}],{duration:110,easing:'cubic-bezier(.23,1,.32,1)'});pickerAnimation.finished.then(()=>picker.close()).catch(()=>{});}
picker.addEventListener('close',()=>{pickerClosing=false;pickerAnimation?.cancel();if(pickerOrigin?.isConnected)pickerOrigin.focus();});picker.addEventListener('cancel',e=>{e.preventDefault();closePicker();});picker.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();closePicker();}});picker.addEventListener('click',e=>{if(e.target===picker){const r=picker.getBoundingClientRect();if(e.clientX<r.left || e.clientX>r.right || e.clientY<r.top || e.clientY>r.bottom)closePicker();}});search.addEventListener('input',renderPicker);
document.addEventListener('pointerdown',e=>panel.querySelectorAll('details[open]').forEach(d=>{if(!d.contains(e.target))d.open=false;}));panel.addEventListener('keydown',e=>{if(e.key==='Escape')panel.querySelectorAll('details[open]').forEach(d=>{d.open=false;d.querySelector('summary').focus();});});
window.addEventListener('resize',()=>moveIndicator());
if('ResizeObserver' in window)new ResizeObserver(()=>moveIndicator()).observe(tabs);
async function refresh(){if(refreshing || closed || !user || document.hidden)return;refreshing=true;const token=epoch;try{const next=await socialAction('STATE');if(token!==epoch)return;const unknown=[...next.friends,...next.incoming,...next.outgoing].some(r=>!profiles.some(p=>p.id===r.profileId));if(unknown){const people=await registeredProfiles();if(token!==epoch)return;profiles=people;}state=next;render();}catch(error){if(token===epoch)say('No pudimos actualizar los amigos. '+(error.message || ''),true);}finally{if(token===epoch)refreshing=false;}}
function skeleton(){const list=el('div','','friends-skeletons');for(let i=0;i<4;i++)list.append(el('div','','friends-skeleton'));root.replaceChildren(list);}
async function initialize(){const token=++epoch;closed=false;refreshing=false;fingerprint='';closePicker(true);state=null;profiles=[];user=null;photos.clear();headingActions.replaceChildren();root.setAttribute('aria-busy','true');skeleton();clearInterval(timer);
 try{if(!await configureAmplify())throw new Error('No pudimos conectar con el club.');const current=await getCurrentUser();if(token!==epoch)return;user=current;const [next,people]=await Promise.all([socialAction('STATE'),registeredProfiles(),loadBadges().catch(()=>{})]);if(token!==epoch)return;state=next;profiles=people;render(true);say('');
  if(target){const friend=state.friends.find(r=>r.profileId===target);if(friend)openChat(friend);else if(state.incoming.some(r=>r.profileId===target))selectTab('incoming');else if(state.outgoing.some(r=>r.profileId===target))selectTab('outgoing');else if(profiles.some(p=>p.id===target))void openPicker();}
  timer=setInterval(()=>{if(!busy)void refresh();},30000);
 }catch(error){if(token!==epoch)return;headingActions.replaceChildren();root.replaceChildren(empty('Tu gente está en el club',error.name==='UserUnAuthenticatedException'?'Ingresá para ver tus amigos y solicitudes.':error.message,[button('Reintentar',()=>void initialize())]));say(error.name==='UserUnAuthenticatedException'?'Ingresá con el botón de arriba para continuar.':'',true);}
 finally{if(token===epoch){root.removeAttribute('aria-busy');window.proveitLoadingDone?.('page');}}
}
Hub.listen('auth',({payload})=>{if(payload.event==='signedOut'){++epoch;closed=true;user=null;state=null;profiles=[];photos.clear();clearInterval(timer);closePicker(true);directory.replaceChildren();search.value='';headingActions.replaceChildren();root.replaceChildren();say('Ingresá para ver tus amigos.');}if(payload.event==='signedIn')void initialize();});
window.addEventListener('proveit:social-updated',()=>{if(!busy)void refresh();});document.addEventListener('visibilitychange',()=>{if(!document.hidden && !busy)void refresh();});
void initialize();
