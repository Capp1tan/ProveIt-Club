// Una única suscripción por página para bandeja y salas. Sólo recibe una señal;
// el historial siempre se consulta con autorización actual en el servidor.
import {Hub} from 'aws-amplify/utils';
import {configureAmplify,profileClient,getCurrentUser} from './auth-client.js';
let subscription,starting=false,generation=0,retry,connected=false;
export const chatRealtimeReady=()=>connected;
function status(value){if(connected===value)return;connected=value;window.dispatchEvent(new Event('proveit:chat-connection'));}
function stop(){generation++;clearTimeout(retry);subscription?.unsubscribe();subscription=undefined;starting=false;status(false);}
export async function startChatRealtime(){
 if(subscription || starting || document.hidden)return;starting=true;const version=generation;
 try{
  if(!await configureAmplify())throw new Error('Sin configuración');
  await getCurrentUser();const api=await profileClient();if(version!==generation)return;
  subscription=api.subscriptions.onClubChat().subscribe({
   next:()=>{if(version===generation)window.dispatchEvent(new Event('proveit:chat-signal'));},
   error:()=>{if(version!==generation)return;stop();retry=setTimeout(()=>void startChatRealtime(),15000);}
  });
 }catch{if(version===generation){status(false);retry=setTimeout(()=>void startChatRealtime(),15000);}}
 finally{if(version===generation)starting=false;}
}
Hub.listen('api',({payload})=>{if(payload.event==='ConnectionStateChange'){
 const up=payload.data?.connectionState==='Connected';status(up);
 if(up)window.dispatchEvent(new Event('proveit:chat-signal'));
}});
Hub.listen('auth',({payload})=>{if(payload.event==='signedOut')stop();if(payload.event==='signedIn'){stop();void startChatRealtime();}});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)void startChatRealtime();});
window.addEventListener('online',()=>void startChatRealtime());
