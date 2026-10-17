import '../social.css';
import { configureAmplify,getCurrentUser,avatarUrl } from './auth-client.js';
import { registeredProfiles } from './tournaments-api.js';
import { loadBadges,badgeElements,decorateAvatar } from './badges.js';
import { socialAction } from './social-api.js';
import { mountChat } from './chat-ui.js';
import { Hub } from 'aws-amplify/utils';
const root=document.getElementById('friendsApp'),notice=document.getElementById('friendsNotice');
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;};
let user,state,profiles=[],chatStop,activeId='',busy=false,closed=false,refreshing=false,timer;
// Bloquear también las respuestas que lleguen después de cerrar la sesión.
Hub.listen('auth',({payload})=>{if(payload.event==='signedOut'){closed=true;chatStop?.();clearInterval(timer);root.replaceChildren();notice.textContent='Ingresá para ver tus amigos.';}if(payload.event==='signedIn' && !user)location.reload();});
const target=new URLSearchParams(location.search).get('persona');
const counter=el('p','','social-help'),search=el('input'),directory=el('div','','social-people'),incoming=el('div','','social-people'),outgoing=el('div','','social-people'),friends=el('div','','social-people');
search.type='search';search.placeholder='Buscar personas por nick';search.setAttribute('aria-label','Buscar personas por nick');search.maxLength=24;
const sidebar=el('div','','social-sidebar'),conversation=el('section','','social-conversation');conversation.append(el('h2','Tus conversaciones'),el('p','Elegí un amigo para abrir un chat privado.','social-help'));
function section(title,content){const s=el('section','','social-section');s.append(el('h2',title),content);return s;}
const directorySection=section('Encontrar personas',directory);directorySection.insertBefore(search,directory);
sidebar.append(counter,section('Solicitudes recibidas',incoming),section('Solicitudes enviadas',outgoing),section('Mis amigos',friends),directorySection);
const layout=el('div','','social-layout');layout.append(sidebar,conversation);
const find=id=>profiles.find(p=>p.id===id);
const photos=new Map();
function button(label,action){const b=el('button',label,'social-button');b.type='button';b.disabled=busy;b.addEventListener('click',action);return b;}
function person(ref,actions){const p=find(ref.profileId),name=p?.nickname || 'Cuenta no disponible',row=el('article','','social-person'),photo=el('span',Array.from(name)[0],'person-avatar social-avatar');
 decorateAvatar(photo,p?.owner?.split('::')[0]);if(p?.avatarPath){if(!photos.has(p.avatarPath))photos.set(p.avatarPath,avatarUrl(p.avatarPath).catch(()=>''));void photos.get(p.avatarPath).then(url=>{if(closed || !url)return;const img=el('img');img.alt='';img.width=36;img.height=36;img.loading='lazy';img.src=url;photo.replaceChildren(img);});}
 const label=el('div','','social-person-name');label.append(el('strong',name),badgeElements(p?.owner?.split('::')[0]));
 const controls=el('div','','social-person-actions');for(const [title,fn] of actions)controls.append(button(title,fn));row.append(photo,label,controls);return row;
}
async function act(action,id){if(busy)return;busy=true;render();notice.textContent='Guardando…';
 try{await socialAction(action,{targetProfileId:id});if(closed)return;await refresh();notice.textContent=action==='REQUEST'?'Solicitud enviada.':action==='ACCEPT'?'Ahora son amigos. Ya pueden chatear.':'Cambio guardado.';window.dispatchEvent(new Event('proveit:social-updated'));}
 catch(error){notice.textContent=error.message;}finally{busy=false;if(!closed)render();}}
function openChat(ref){activeId=ref.profileId;chatStop?.();chatStop=mountChat(conversation,{roomType:'DIRECT',targetProfileId:ref.profileId,title:find(ref.profileId)?.nickname || 'Chat privado'});}
function render(){if(!state || closed)return;
 counter.textContent=state.friends.length+' amigos · '+(state.limit===null?'sin límite para tu cuenta':state.limit+' como máximo');
 incoming.replaceChildren(...state.incoming.map(r=>person(r,[['Aceptar',()=>void act('ACCEPT',r.profileId)],['Rechazar',()=>void act('DECLINE',r.profileId)]])));
 outgoing.replaceChildren(...state.outgoing.map(r=>person(r,[['Cancelar solicitud',()=>void act('CANCEL',r.profileId)]])));
 friends.replaceChildren(...state.friends.map(r=>person(r,[['Chatear',()=>openChat(r)],['Eliminar amigo',()=>{if(confirm('¿Eliminar esta amistad? El chat privado quedará inaccesible hasta que vuelvan a ser amigos.'))void act('REMOVE',r.profileId);}]])));
 for(const [node,text] of [[incoming,'No tenés solicitudes recibidas.'],[outgoing,'No tenés solicitudes enviadas.'],[friends,'Todavía no agregaste amigos.']])if(!node.childElementCount)node.append(el('p',text,'social-help'));
 const q=search.value.trim().toLocaleLowerCase('es');
 const existing=new Set([...state.friends,...state.incoming,...state.outgoing].map(r=>r.profileId));
 const matches=profiles.filter(p=>p.id!==user.userId && p.owner!==user.username && !p.owner.startsWith(user.userId+'::') && !existing.has(p.id) && (q?p.nickname.toLocaleLowerCase('es').includes(q):p.id===target)).slice(0,20);
 directory.replaceChildren(...matches.map(p=>person({profileId:p.id},[['Agregar amigo',()=>void act('REQUEST',p.id)]])));
 if(!matches.length)directory.append(el('p',q?'No encontramos personas disponibles con ese nick.':'Buscá un nick para enviar una solicitud.','social-help'));
 if(activeId && !state.friends.some(r=>r.profileId===activeId)){chatStop?.();chatStop=null;activeId='';conversation.replaceChildren(el('p','La amistad terminó. El chat privado ya no está disponible.','social-help'));}
}
async function refresh(){if(refreshing || closed)return;refreshing=true;try{const next=await socialAction('STATE');if(closed)return;state=next;render();}finally{refreshing=false;}}
search.addEventListener('input',render);
try{
 if(!await configureAmplify())throw new Error('No pudimos conectar con el club.');user=await getCurrentUser();
 await Promise.all([registeredProfiles().then(p=>profiles=p),loadBadges().catch(()=>{})]);
 if(closed)throw new Error('Sesión cerrada.');root.append(layout);await refresh();notice.textContent='Las solicitudes requieren aceptación. Los chats se actualizan mientras estás en el sitio.';
 if(target){const friend=state.friends.find(r=>r.profileId===target);if(friend)openChat(friend);}
}catch(error){notice.textContent=error.message || 'Ingresá para ver tus amigos.';}
finally{window.proveitLoadingDone?.('page');}
if(!closed)timer=setInterval(()=>{if(!document.hidden && !busy && user)void refresh().catch(error=>notice.textContent=error.message);},30000);
