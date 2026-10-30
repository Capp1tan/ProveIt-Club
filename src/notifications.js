import {notificationSoundEnabled,watchNotificationSound} from './notification-preferences.js';
import {notificationItems} from './notification-items.js';
import {communityAction} from './community-api.js';
import {pendingInvitations} from './tournaments-api.js';
import {configureAmplify,getCurrentUser,avatarUrl} from './auth-client.js';
import {Hub} from 'aws-amplify/utils';
import '../notifications.css';
const nav=document.querySelector('header nav');
if(nav){
 const el=(tag,text='',cls='')=>{const n=document.createElement(tag);n.textContent=text;n.className=cls;return n;};
 const root=el('div','','club-notifications');root.hidden=true;
 const bell=el('button','','notification-bell');bell.type='button';bell.setAttribute('aria-label','Notificaciones');bell.setAttribute('aria-expanded','false');bell.setAttribute('aria-controls','clubNotificationsPanel');
 bell.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 17h14l-2-3V9a5 5 0 0 0-10 0v5zM10 20h4"/></svg>';
 const badge=el('span','','notification-count');badge.hidden=true;badge.setAttribute('aria-hidden','true');bell.append(badge);
 const panel=el('section','','notification-panel');panel.id='clubNotificationsPanel';panel.hidden=true;panel.setAttribute('aria-label','Notificaciones');
 const title=el('h2','Notificaciones'),list=el('div','','notification-list'),announcement=el('span','','notification-sr');announcement.setAttribute('role','status');announcement.setAttribute('aria-live','polite');
 panel.append(title,list,announcement);root.append(bell,panel);nav.prepend(root);
 let userId='',generation=0,busy=false,items=[],invitations=[],feed={},fingerprint='',failure=false,readIds=new Set();
 const photos=new Map();let audio,queuedSound=false,soundEnabled=notificationSoundEnabled();
 watchNotificationSound(()=>{soundEnabled=notificationSoundEnabled();if(!soundEnabled)queuedSound=false;});
 function chime(){
  if(!soundEnabled){queuedSound=false;return;}if(!audio || audio.state!=='running'){queuedSound=true;return;}queuedSound=false;
  for(const [offset,frequency] of [[0,660],[.16,880]]){const o=audio.createOscillator(),g=audio.createGain(),start=audio.currentTime+offset;o.frequency.value=frequency;g.gain.setValueAtTime(0,start);g.gain.linearRampToValueAtTime(.09,start+.015);g.gain.exponentialRampToValueAtTime(.001,start+.2);o.connect(g);g.connect(audio.destination);o.start(start);o.stop(start+.22);}
 }
 async function unlockAudio(){if(!soundEnabled || !userId)return;try{const Audio=window.AudioContext || window.webkitAudioContext;if(!Audio)return;audio ||= new Audio();await audio.resume();if(queuedSound)chime();}catch{}}
 document.addEventListener('pointerdown',unlockAudio);document.addEventListener('keydown',unlockAudio);
 function readSaved(key){try{const a=JSON.parse(localStorage.getItem(key) || '[]');return Array.isArray(a)?a.filter(x=>typeof x==='string'):[];}catch{return [];}}
 function save(key,value){try{localStorage.setItem(key,JSON.stringify(value.slice(-300)));}catch{}}
 function updateCount(){const n=items.filter(i=>!readIds.has(i.id)).length;badge.hidden=!n;badge.textContent=n>99?'99+':String(n);bell.setAttribute('aria-label',n?'Notificaciones: '+n+' sin leer':'Notificaciones');}
 function markRead(){if(panel.hidden || !userId)return;items.forEach(i=>readIds.add(i.id));save('proveit:read-notifications:'+userId,[...readIds]);updateCount();}
 function rememberNew(){const key='proveit:seen-notifications:'+userId,seen=new Set(readSaved(key)),added=items.filter(i=>!seen.has(i.id)).length;items.forEach(i=>seen.add(i.id));save(key,[...seen]);return added;}
 function render(force=false){
  updateCount();const version=JSON.stringify(items)+failure;if(!force && version===fingerprint)return;fingerprint=version;list.replaceChildren();
  if(!items.length){list.append(el('p',failure?'No pudimos cargar las notificaciones.':'No tenés notificaciones.','notification-empty'));return;}
  for(const item of items){
   const row=el(item.href?'a':'div','','notification-item');if(item.href)row.href=item.href;
   const icon=el('span',({friend:'＋',judge:'⚖',tournament:'↗',site:'·'})[item.icon] || '·','notification-mini-icon');icon.setAttribute('aria-hidden','true');
   row.append(icon,el('span',item.text,'notification-copy'));list.append(row);
   if(!panel.hidden && item.avatarPath){const key=item.profileId+':'+item.avatarPath;if(!photos.has(key) || photos.get(key).expires<Date.now())photos.set(key,{expires:Date.now()+50000,promise:avatarUrl(item.avatarPath,{profileId:item.profileId}).catch(()=>null)});const epoch=generation;
    void photos.get(key).promise.then(url=>{if(!url || epoch!==generation || !row.isConnected)return;const img=el('img');img.width=32;img.height=32;img.alt='';img.loading='lazy';img.src=url;img.onerror=()=>{icon.textContent='＋';};icon.replaceChildren(img);});
   }
  }
 }
 async function refresh(){
  if(!userId || busy || document.hidden)return;busy=true;const epoch=generation;
  try{const [invites,other]=await Promise.allSettled([pendingInvitations(),communityAction('NOTIFICATIONS')]);if(epoch!==generation)return;
   if(invites.status==='fulfilled')invitations=invites.value;if(other.status==='fulfilled')feed=other.value;
   failure=invites.status==='rejected' || other.status==='rejected';items=notificationItems(invitations,feed);const added=rememberNew();render();markRead();if(added){announcement.textContent=added===1?'Nueva notificación.':'Nuevas notificaciones.';chime();}
  }finally{if(epoch===generation)busy=false;}
 }
 function close(){panel.hidden=true;bell.setAttribute('aria-expanded','false');}
 bell.addEventListener('click',()=>{panel.hidden=!panel.hidden;bell.setAttribute('aria-expanded',String(!panel.hidden));if(!panel.hidden){render(true);markRead();void refresh();}});
 document.addEventListener('click',e=>{if(!root.contains(e.target))close();});root.addEventListener('keydown',e=>{if(e.key==='Escape'){close();bell.focus();}});
 async function connect(){const epoch=++generation;userId='';busy=false;items=[];invitations=[];feed={};readIds=new Set();photos.clear();queuedSound=false;root.hidden=true;close();render(true);
  try{if(!await configureAmplify())return;const user=await getCurrentUser();if(epoch!==generation)return;userId=user.userId;readIds=new Set(readSaved('proveit:read-notifications:'+userId));root.hidden=false;await refresh();}catch{}}
 Hub.listen('auth',({payload})=>{if(['signedIn','signedOut'].includes(payload.event))void connect();});
 for(const event of ['proveit:tournament-deleted','proveit:invitation-updated','proveit:social-updated'])window.addEventListener(event,()=>void refresh());
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)void refresh();});setInterval(()=>void refresh(),20000);void connect();
}
