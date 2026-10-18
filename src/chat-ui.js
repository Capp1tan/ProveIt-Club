import {badgeElements,loadBadges} from './badges.js';
import '../social.css';
import { socialAction } from './social-api.js';
import { getCurrentUser } from './auth-client.js';
import { Hub } from 'aws-amplify/utils';
import { playMessageSound } from './chat-sound.js';
let composerNumber=0;
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;};
// El mensaje aparece pendiente al instante y sólo se confirma con la respuesta de AWS.
// No se descarta un envío fallido: conserva su ID para reintentar sin duplicarlo.
export function mountChat(root,room){
 let stopped=false,fetching=false,queued=false,sending=false,cursor=null,after=null,me='',first=true,latestReceived=0,lastMarked=0,marking=false,historyReady=false,authorized=false,lastFull=0,failures=0,deltaIncoming=0,catchingUp=false;
 const messages=new Map(),nodes=new Map(),dirty=new Set();root.classList.add('club-chat');
 const heading=el('h2',room.title || 'Chat del torneo'),help=el('p',room.roomType==='DIRECT'?'Conversación privada entre amigos.':'Sólo el organizador y los integrantes confirmados pueden leer y escribir.','social-help');
 const older=el('button','Ver mensajes anteriores','social-button');older.type='button';older.hidden=true;
 const list=el('div','','chat-messages');list.setAttribute('role','log');list.setAttribute('aria-label','Mensajes');list.setAttribute('aria-live','polite');list.setAttribute('aria-relevant','additions');
 const notice=el('p','Conectando…','social-notice');notice.setAttribute('role','status');
 const form=el('form','','chat-composer'),label=el('label','Tu mensaje'),input=el('textarea');input.maxLength=1000;input.rows=2;input.required=true;input.placeholder='Escribí un mensaje…';input.disabled=true;input.enterKeyHint='send';label.append(input);
 const send=el('button','Enviar','primary-button');send.type='submit';send.disabled=true;
 const keyboardHelp=el('p','Enter para enviar · Shift + Enter para otra línea','chat-keyboard-help');keyboardHelp.id='chatKeyboardHelp-'+(++composerNumber);input.setAttribute('aria-describedby',keyboardHelp.id);
 input.addEventListener('keydown',e=>{if(e.key!=='Enter' || e.shiftKey || e.isComposing)return;e.preventDefault();if(e.repeat || sending || input.disabled || !input.value.trim())return;form.requestSubmit(send);});
 form.append(label,send);root.replaceChildren(heading,help,older,list,notice,form,keyboardHelp);
 const args={roomType:room.roomType,...(room.roomId?{roomId:room.roomId}:{}),...(room.targetProfileId?{targetProfileId:room.targetProfileId}:{})};
 const active=()=>!stopped && !document.hidden && (!room.isActive || room.isActive());
 const networkError=e=>/network|fetch|timeout|offline|connection|socket/i.test(e.message || '');
 function upsert(message){const old=messages.get(message.id);if(old && JSON.stringify(old)===JSON.stringify(message))return;messages.set(message.id,message);dirty.add(message.id);}
 function render(){
  const bottom=list.scrollHeight-list.scrollTop-list.clientHeight<70;
  for(const m of [...dirty].map(id=>messages.get(id)).sort((a,b)=>(a.createdAt+'#'+a.id).localeCompare(b.createdAt+'#'+b.id))){
   let card=nodes.get(m.id);if(!card){card=el('article','','chat-message');nodes.set(m.id,card);card.dataset.messageId=m.id;}
   card.dataset.mine=String(m.senderSub===me);card.dataset.delivery=m.delivery || 'sent';
   const time=el('time',new Date(m.createdAt).toLocaleString('es',{dateStyle:'short',timeStyle:'short'}));time.dateTime=m.createdAt;
   const sender=el('strong',m.senderName,'profile-name-line');sender.append(badgeElements(m.senderSub));card.replaceChildren(sender,el('p',m.body),time);
   if(m.delivery==='pending')card.append(el('small','Enviando…','chat-delivery'));
   if(m.delivery==='failed'){const retry=el('button','No enviado · Reintentar','chat-retry');retry.type='button';retry.disabled=sending;retry.addEventListener('click',()=>void deliver(m));card.append(retry);}
   const key=m.createdAt+'#'+m.id;if(card.dataset.sortKey!==key || !card.isConnected){card.dataset.sortKey=key;card.remove();const last=list.lastElementChild;if(!last || last.dataset.sortKey<=key)list.append(card);else{const next=[...list.children].find(n=>n.dataset.sortKey>key);list.insertBefore(card,next || null);}}
  }
  dirty.clear();if(bottom)list.scrollTop=list.scrollHeight;
 }
 async function markRead(){
  if(room.roomType!=='DIRECT' || !active() || !document.hasFocus() || marking || latestReceived<=lastMarked || list.scrollHeight-list.scrollTop-list.clientHeight>70)return;
  marking=true;const seenCount=latestReceived;
  try{await socialAction('READ',{...args,seenCount});if(stopped)return;lastMarked=Math.max(lastMarked,seenCount);window.dispatchEvent(new Event('proveit:chat-read'));}catch{}finally{marking=false;}
 }
 list.addEventListener('scroll',()=>void markRead());
 async function refresh(previous=false){
  if(!active())return;if(fetching){if(!previous)queued=true;return;}fetching=true;
  const full=!catchingUp && (!after || Date.now()-lastFull>20000);
  try{
   const page=await socialAction('MESSAGES',{...args,...(previous && cursor?{cursor}:!full && after?{after}:{})});if(stopped)return;
   const incoming=page.messages.filter(m=>m.senderSub!==me && !messages.has(m.id)).length;
   if(!previous){if(full)deltaIncoming=0;else deltaIncoming+=incoming;}
   if(room.roomType==='TOURNAMENT' && historyReady && !previous && page.messages.some(m=>m.senderSub!==me && !messages.has(m.id)))playMessageSound();
   for(const m of page.messages)upsert(m);historyReady=true;authorized=true;failures=0;
   // Si un envío terminó de guardarse fuera del orden temporal, el contador
   // fuerza una reconciliación antes de marcar mensajes que aún no mostramos.
   const needsFull=!previous && !full && !page.hasMore && (page.receivedCount || 0)>latestReceived+deltaIncoming;
   if(!previous){catchingUp=Boolean(page.hasMore);after=page.after || after;if(full)lastFull=Date.now();if(needsFull){lastFull=0;queued=true;}else if(!page.hasMore){latestReceived=page.receivedCount || 0;deltaIncoming=0;}}
   if(previous || first){cursor=page.cursor;first=false;}
   older.hidden=!cursor;input.disabled=false;send.disabled=sending;notice.textContent=messages.size?'':'Todavía no hay mensajes. Rompé el hielo.';render();if(!page.hasMore && !needsFull)void markRead();else queued=true;
  }catch(error){if(!stopped){failures++;if(!networkError(error)){authorized=false;messages.clear();nodes.clear();dirty.clear();list.replaceChildren();historyReady=false;after=null;input.disabled=true;send.disabled=true;}notice.textContent=networkError(error)?'Reconectando… Tu texto se conserva.':error.message;}}
  finally{fetching=false;if(queued && !stopped){queued=false;setTimeout(()=>void refresh(),failures?Math.min(1000*2**failures,15000):0);}}
 }
 async function deliver(message){
  if(sending || !authorized || stopped)return;sending=true;send.disabled=true;upsert({...message,delivery:'pending'});render();notice.textContent='';
  try{const result=await socialAction('SEND',{...args,body:message.body,messageId:message.id});if(stopped)return;upsert(result.message || {...message,delivery:'sent'});render();window.dispatchEvent(new Event('proveit:chat-sent'));void refresh();}
  catch(error){if(!stopped){const known=messages.get(message.id);if(!known || known.delivery==='pending' || known.delivery==='failed'){upsert({...message,delivery:'failed'});render();notice.textContent=error.message;}}}
  finally{sending=false;if(!stopped){send.disabled=!authorized;list.querySelectorAll('.chat-retry').forEach(b=>b.disabled=false);}}
 }
 form.addEventListener('submit',event=>{event.preventDefault();const body=input.value.trim();if(sending || !body || !authorized)return;const message={id:crypto.randomUUID(),body,createdAt:new Date().toISOString(),senderSub:me,senderName:'Vos'};input.value='';void deliver(message);});
 older.addEventListener('click',()=>void refresh(true));
 // El privado se despierta con el buzón compartido. El intervalo lento es de respaldo.
 // Las salas sin buzón consultan deltas cada 1,5 s, con retroceso ante errores.
 let timer;
 function schedulePoll(){clearTimeout(timer);if(stopped || document.hidden)return;const base=room.roomType==='DIRECT'?15000:1500;timer=setTimeout(async()=>{if(!sending)await refresh();schedulePoll();},Math.min(30000,base*2**Math.min(failures,4)));}
 schedulePoll();
 const inbox=event=>{if(event.detail?.profileId===room.targetProfileId)void refresh();};window.addEventListener('proveit:chat-arrived',inbox);
 const visible=()=>{if(active())void refresh();schedulePoll();};document.addEventListener('visibilitychange',visible);window.addEventListener('focus',visible);
 void loadBadges().then(()=>{if(stopped)return;for(const id of messages.keys())dirty.add(id);render();}).catch(()=>{});
 const off=Hub.listen('auth',({payload})=>{if(payload.event==='signedOut')stop();});
 function stop(){stopped=true;clearTimeout(timer);window.removeEventListener('proveit:chat-arrived',inbox);document.removeEventListener('visibilitychange',visible);window.removeEventListener('focus',visible);off();messages.clear();nodes.clear();root.replaceChildren();}
 stop.refresh=()=>void refresh();
 void getCurrentUser().then(user=>{if(!stopped){me=user.userId;void refresh();}}).catch(()=>{notice.textContent='Ingresá a tu cuenta para usar el chat.';});
 return stop;
}
