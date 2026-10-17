// Bandeja común: vive fuera del contenido de cada página. Sólo guarda en sesión
// el ID abierto y si está minimizada; los mensajes permanecen en AWS.
import '../social.css';
import { Hub } from 'aws-amplify/utils';
import { configureAmplify,getCurrentUser } from './auth-client.js';
import { socialAction } from './social-api.js';
import { mountChat } from './chat-ui.js';
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;};
const root=el('aside','','chat-dock');root.hidden=true;root.setAttribute('aria-label','Bandeja de mensajes');
const launcher=el('button','','chat-dock-launcher');launcher.type='button';launcher.setAttribute('aria-expanded','false');launcher.setAttribute('aria-controls','chatDockPanel');
const launcherText=el('span','Mensajes'),totalBadge=el('span','','chat-unread'),symbol=el('span','','chat-dock-symbol');
symbol.setAttribute('aria-hidden','true');symbol.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 4h16v12H9l-5 4V4Z" stroke-linejoin="round"/><path d="M8 8h8M8 12h5" stroke-linecap="round"/></svg>';
totalBadge.hidden=true;totalBadge.setAttribute('aria-live','polite');launcher.append(symbol,launcherText,totalBadge);
const panel=el('section','','chat-dock-panel');panel.id='chatDockPanel';panel.hidden=true;
const header=el('div','','chat-dock-header'),back=el('button','←','chat-dock-back'),title=el('strong','Conversaciones'),minimize=el('button','—','chat-dock-minimize');
back.type=minimize.type='button';back.setAttribute('aria-label','Ver conversaciones');minimize.setAttribute('aria-label','Minimizar chat');back.hidden=true;header.append(back,title,minimize);
const list=el('div','','chat-dock-list'),chat=el('div','','chat-dock-body'),status=el('p','','chat-dock-status');status.setAttribute('role','status');chat.hidden=true;
panel.append(header,list,chat,status);root.append(panel,launcher);document.body.append(root);
let sub='',epoch=0,loading=false,conversations=[],selected=null,stopChat,key='',queued=null,ready=false;
const drafts=new Map();
function save(){if(!key)return;try{sessionStorage.setItem(key,JSON.stringify({selected:selected?{profileId:selected.profileId,name:selected.name}:null,minimized:panel.hidden}));}catch{}}
function rememberDraft(){const input=chat.querySelector('textarea');if(selected && input)drafts.set(selected.profileId,input.value);}
function renderList(){
 list.replaceChildren();
 for(const c of conversations){const row=el('button','','chat-dock-contact');row.type='button';row.append(el('span',c.name || 'Amigo'));
  const badge=el('span',String(c.unread || 0),'chat-unread');badge.hidden=!c.unread;row.append(badge);row.setAttribute('aria-label',(c.name || 'Amigo')+(c.unread?', '+c.unread+' mensajes sin leer':''));row.addEventListener('click',()=>select(c));list.append(row);}
 if(!conversations.length)list.append(el('p','Todavía no hay conversaciones. Elegí Chatear desde Amigos.','social-help'));
 const friends=el('a','Ir a Amigos ↗','chat-dock-friends');friends.href='/amigos.html';list.append(friends);
 const n=conversations.reduce((sum,c)=>sum+(c.unread || 0),0);totalBadge.textContent=String(n);totalBadge.hidden=!n;launcher.dataset.unread=String(n>0);launcher.setAttribute('aria-label',n?'Mensajes: '+n+' sin leer':'Abrir bandeja de mensajes');
}
function expand(){panel.hidden=false;launcher.setAttribute('aria-expanded','true');save();stopChat?.refresh?.();}
function collapse(){rememberDraft();panel.hidden=true;launcher.setAttribute('aria-expanded','false');save();}
function showList(){rememberDraft();stopChat?.();stopChat=null;selected=null;chat.hidden=true;list.hidden=false;back.hidden=true;title.textContent='Conversaciones';save();renderList();}
function select(person,open=true){
 if(selected?.profileId!==person.profileId || !stopChat){
  rememberDraft();stopChat?.();selected={profileId:person.profileId,name:person.name || 'Chat privado'};
  if(!conversations.some(c=>c.profileId===person.profileId))conversations.unshift({...selected,unread:0});
  chat.hidden=false;list.hidden=true;back.hidden=false;title.textContent=selected.name;
  stopChat=mountChat(chat,{roomType:'DIRECT',targetProfileId:person.profileId,title:selected.name,isActive:()=>!root.hidden && !panel.hidden && !chat.hidden});
  const input=chat.querySelector('textarea');if(input)input.value=drafts.get(person.profileId) || '';
 }
 if(open)expand();save();renderList();
}
async function refresh(){
 if(loading || !sub || document.hidden)return;loading=true;const current=epoch;
 try{const result=await socialAction('INBOX');if(current!==epoch)return;conversations=result.conversations;status.textContent='';renderList();
  if(selected && !conversations.some(c=>c.profileId===selected.profileId)){
   // Un chat recién abierto todavía no tiene metadatos; comprobar amistad antes de cerrarlo.
   const state=await socialAction('STATE');if(current!==epoch)return;
   if(!state.friends.some(p=>p.profileId===selected?.profileId))showList();
   else{conversations.unshift({...selected,unread:0});renderList();}
  }
 }catch{if(current===epoch)status.textContent='No pudimos actualizar los mensajes. Reintentando…';}finally{loading=false;}
}
function reset(){epoch++;ready=false;sub='';key='';rememberDraft();stopChat?.();stopChat=null;selected=null;queued=null;drafts.clear();conversations=[];root.hidden=true;panel.hidden=true;list.hidden=false;chat.hidden=true;chat.replaceChildren();list.replaceChildren();status.textContent='';}
async function initialize(){const current=++epoch;
 try{if(!await configureAmplify())return;const user=await getCurrentUser();if(current!==epoch)return;sub=user.userId;key='proveit:chat-dock:'+sub;root.hidden=false;
  let saved;try{saved=JSON.parse(sessionStorage.getItem(key) || 'null');}catch{}
  await refresh();if(current!==epoch)return;ready=true;
  if(queued){const person=queued;queued=null;select(person);}else if(saved?.selected && typeof saved.selected.profileId==='string'){
   const state=await socialAction('STATE');if(current!==epoch)return;
   if(!selected && state.friends.some(p=>p.profileId===saved.selected.profileId))select(saved.selected,!saved.minimized);
  }else if(saved?.minimized===false)expand();
 }catch{if(current===epoch)root.hidden=true;}
}
export function openDirectChat(person){const ref={profileId:person.profileId,name:person.name || 'Chat privado'};if(!ready){queued=ref;return;}select(ref);}
launcher.addEventListener('click',()=>panel.hidden?expand():collapse());minimize.addEventListener('click',()=>{collapse();launcher.focus();});back.addEventListener('click',showList);
root.addEventListener('keydown',event=>{if(event.key==='Escape'){collapse();launcher.focus();}});
const tick=()=>{if(!document.hidden)void refresh();};setInterval(tick,6000);document.addEventListener('visibilitychange',tick);window.addEventListener('focus',tick);
for(const event of ['proveit:chat-read','proveit:chat-sent','proveit:social-updated'])window.addEventListener(event,tick);
Hub.listen('auth',({payload})=>{if(payload.event==='signedOut')reset();if(payload.event==='signedIn')void initialize();});
void initialize();
