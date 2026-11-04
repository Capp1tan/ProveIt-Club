import {initializeAccess} from './badges.js';
import './chat-dock.js';import './site-search.js';import '../social.css';
import {Hub} from 'aws-amplify/utils';import {configureAmplify,getCurrentUser} from './auth-client.js';
const header=document.querySelector('header'),brand=header?.querySelector('.brand');
if(header && brand){const admin=document.createElement('a');admin.href='/admin.html';admin.textContent='Administración';admin.className='admin-shortcut';admin.hidden=true;(header.querySelector('.club-primary-nav') || brand).after(admin);let epoch=0;
 async function update(){const e=epoch;try{if(!await configureAmplify())return;await getCurrentUser();const access=await initializeAccess();if(e===epoch)admin.hidden=!access.isCreator;}catch{if(e===epoch)admin.hidden=true;}}
 Hub.listen('auth',({payload})=>{if(['signedIn','signedOut'].includes(payload.event)){epoch++;admin.hidden=true;if(payload.event==='signedIn')void update();}});void update();}
