// Un cliente compartido y lecturas simultáneas deduplicadas. AppSync sigue
// validando el token y la función vuelve a comprobar permisos en cada operación.
import { configureAmplify,loadProfile,profileClient } from './auth-client.js';
import { Hub } from 'aws-amplify/utils';
let clientPromise,profilePromise,epoch=0;const reads=new Map();
Hub.listen('auth',({payload})=>{if(['signedOut','signedIn'].includes(payload.event)){epoch++;profilePromise=undefined;reads.clear();}});
function client(){if(!clientPromise)clientPromise=configureAmplify().then(ready=>{if(!ready)throw new Error('No pudimos conectar con el club.');return profileClient();}).catch(e=>{clientPromise=undefined;throw e;});return clientPromise;}
export function socialAction(action,args={}){
 const read=['STATE','INBOX','MESSAGES'].includes(action),key=action+JSON.stringify(args);if(read && reads.has(key))return reads.get(key);
 const current=epoch;
 const work=(async()=>{const api=await client();let selfProfileId;
  if(!['STATE','INBOX'].includes(action)){if(!profilePromise)profilePromise=loadProfile().then(({profile})=>{if(!profile)throw new Error('Guardá tu perfil antes de usar amigos y chats.');return profile.id;}).catch(e=>{profilePromise=undefined;throw e;});selfProfileId=await profilePromise;}
  if(current!==epoch)throw new Error('Tu sesión cambió.');
  const values={...args,...(selfProfileId?{selfProfileId}:{})};
  const result=action==='SEND'?await api.mutations.clubChatSend(values):await api.mutations.clubSocial({action,...values});
  if(current!==epoch)throw new Error('Tu sesión cambió.');
  if(result.errors?.length)throw new Error(result.errors.map(e=>e.message).join(' '));if(!result.data)throw new Error('AWS no confirmó la respuesta. Volvé a intentar.');return action==='SEND'?{ok:true}:JSON.parse(result.data);
 })();
 if(read){reads.set(key,work);work.then(()=>{if(reads.get(key)===work)reads.delete(key);},()=>{if(reads.get(key)===work)reads.delete(key);});}return work;
}
