import '../social.css';
import { socialAction } from './social-api.js';
import { getCurrentUser } from './auth-client.js';
import { Hub } from 'aws-amplify/utils';
const el=(tag,text,cls)=>{const e=document.createElement(tag);if(text)e.textContent=text;if(cls)e.className=cls;return e;};
// Chat de texto, paginado y actualizado sólo con la pestaña visible.
export function mountChat(root,room) {
 let stopped=false,fetching=false,sending=false,cursor=null,me='',attempt=null,first=true,latestReceived=0,lastMarked=0,marking=false;
 const messages=new Map();root.classList.add('club-chat');
 const heading=el('h2',room.title || 'Chat del torneo');
 const help=el('p',room.roomType==='DIRECT'?'Conversación privada entre amigos.':'Sólo el organizador y los integrantes confirmados pueden leer y escribir.','social-help');
 const older=el('button','Ver mensajes anteriores','social-button');older.type='button';older.hidden=true;
 const list=el('div','','chat-messages');list.setAttribute('role','log');list.setAttribute('aria-label','Mensajes');list.setAttribute('aria-live','polite');list.setAttribute('aria-relevant','additions');
 const notice=el('p','Conectando…','social-notice');notice.setAttribute('role','status');
 const form=el('form','','chat-composer'),label=el('label','Tu mensaje'),input=el('textarea');
 input.maxLength=1000;input.rows=2;input.required=true;input.placeholder='Escribí un mensaje…';input.disabled=true;label.append(input);
 const send=el('button','Enviar','primary-button');send.type='submit';send.disabled=true;
 form.append(label,send);root.replaceChildren(heading,help,older,list,notice,form);
 const args={roomType:room.roomType,...(room.roomId?{roomId:room.roomId}:{}),...(room.targetProfileId?{targetProfileId:room.targetProfileId}:{})};
 const active=()=>!stopped && !document.hidden && (!room.isActive || room.isActive());
 async function markRead(){
  if(room.roomType!=='DIRECT' || !active() || !document.hasFocus() || marking || latestReceived<=lastMarked || list.scrollHeight-list.scrollTop-list.clientHeight>70)return;
  marking=true;const seenCount=latestReceived;
  try{await socialAction('READ',{...args,seenCount});if(stopped)return;lastMarked=Math.max(lastMarked,seenCount);window.dispatchEvent(new Event('proveit:chat-read'));}
  catch{/* Si falla, conservamos el contador y reintentamos al actualizar. */}finally{marking=false;}
 }
 list.addEventListener('scroll',()=>void markRead());
 function render(){
  const bottom=list.scrollHeight-list.scrollTop-list.clientHeight<70;
  for(const m of [...messages.values()].sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id))){
   if(list.querySelector('[data-message-id="'+m.id+'"]'))continue;
   const card=el('article','','chat-message');card.dataset.messageId=m.id;card.dataset.mine=String(m.senderSub===me);
   const name=el('strong',m.senderName),body=el('p',m.body),time=el('time',new Date(m.createdAt).toLocaleString('es',{dateStyle:'short',timeStyle:'short'}));time.dateTime=m.createdAt;
   card.append(name,body,time);const after=[...list.children].find(e=>e.dataset.sentAt>m.createdAt);card.dataset.sentAt=m.createdAt;list.insertBefore(card,after || null);
  }
  if(bottom)list.scrollTop=list.scrollHeight;
 }
 async function refresh(previous=false){
  if(!active() || fetching)return;fetching=true;
  try{
   const page=await socialAction('MESSAGES',{...args,...(previous && cursor?{cursor}:{})});if(stopped)return;
   for(const m of page.messages)messages.set(m.id,m);
   if(!previous)latestReceived=page.receivedCount || 0;
   if(previous || first || (!cursor && page.cursor)){cursor=page.cursor;first=false;}
   older.hidden=!cursor;input.disabled=sending;send.disabled=sending;notice.textContent=messages.size?'':'Todavía no hay mensajes. Rompé el hielo.';render();void markRead();
  }catch(error){if(!stopped){messages.clear();list.replaceChildren();input.disabled=true;send.disabled=true;notice.textContent=error.message;}}
  finally{fetching=false;}
 }
 older.addEventListener('click',()=>void refresh(true));
 form.addEventListener('submit',async event=>{
  event.preventDefault();const body=input.value.trim();if(sending || !body || input.disabled)return;
  sending=true;send.disabled=true;input.disabled=true;notice.textContent='Enviando…';
  if(!attempt || attempt.body!==body)attempt={body,id:crypto.randomUUID()};
  try{await socialAction('SEND',{...args,body,messageId:attempt.id});if(stopped)return;input.value='';attempt=null;notice.textContent='';window.dispatchEvent(new Event('proveit:chat-sent'));}
  catch(error){if(!stopped)notice.textContent=error.message;}
  finally{sending=false;if(!stopped){input.disabled=false;send.disabled=false;input.focus();}}
  if(!stopped && !input.value)void refresh();
 });
 const timer=setInterval(()=>{if(!sending)void refresh();},5000);
 const visible=()=>{if(active())void refresh();};document.addEventListener('visibilitychange',visible);window.addEventListener('focus',visible);
 const off=Hub.listen('auth',({payload})=>{if(payload.event==='signedOut')stop();});
 function stop(){stopped=true;clearInterval(timer);document.removeEventListener('visibilitychange',visible);window.removeEventListener('focus',visible);off();messages.clear();root.replaceChildren();}
 stop.refresh=()=>void refresh();
 void getCurrentUser().then(user=>{if(!stopped){me=user.userId;void refresh();}}).catch(()=>{notice.textContent='Ingresá a tu cuenta para usar el chat.';});
 return stop;
}
