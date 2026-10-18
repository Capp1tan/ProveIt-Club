import {initializeAccess} from './badges.js';
import './chat-dock.js';
import '../social.css';
import { Hub } from 'aws-amplify/utils';
import { configureAmplify,getCurrentUser } from './auth-client.js';
import { socialAction } from './social-api.js';
// No carga directorio ni mensajes al entrar al inicio.
const nav=document.querySelector('header nav');
if(nav){
 const admin=document.createElement('a');admin.href='/admin.html';admin.textContent='Administrar';admin.className='social-nav-link';admin.hidden=true;nav.prepend(admin);
 const link=document.createElement('a');link.href='/amigos.html';link.className='social-nav-link';link.textContent='Amigos';link.hidden=true;nav.prepend(link);
 let busy=false,epoch=0;
 async function update(){if(busy || document.hidden)return;busy=true;const current=epoch;
  try{if(!await configureAmplify())return;await getCurrentUser();if(current!==epoch)return;link.hidden=false;void initializeAccess().then(access=>{if(current===epoch)admin.hidden=!access.isCreator;}).catch(()=>{admin.hidden=true;});
   const state=await socialAction('STATE');if(current!==epoch)return;const n=state.incoming.length;
   link.textContent=n?'Amigos ('+n+')':'Amigos';link.setAttribute('aria-label',n?'Amigos: '+n+' solicitudes pendientes':'Amigos y mensajes');
  }catch{if(current===epoch)link.hidden=true;admin.hidden=true;}finally{busy=false;}}
 Hub.listen('auth',({payload})=>{if(payload.event==='signedOut'){epoch++;link.hidden=true;admin.hidden=true;}if(payload.event==='signedIn'){epoch++;void update();}});
 window.addEventListener('proveit:social-updated',()=>void update());
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)void update();});setInterval(()=>void update(),60000);void update();
}
