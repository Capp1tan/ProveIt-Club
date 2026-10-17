import { tournamentClient } from './tournaments-api.js';
import { getCurrentUser,loadProfile } from './auth-client.js';
import { Hub } from 'aws-amplify/utils';
let identitySub='',profilePromise;
Hub.listen('auth',({payload})=>{if(payload.event==='signedOut'){identitySub='';profilePromise=undefined;}});
// AWS comprueba identidad, amistad, cupos y pertenencia a cada sala.
export async function socialAction(action,args={}) {
 const client=await tournamentClient();let selfProfileId;
 if(!['STATE','INBOX'].includes(action)){
  const user=await getCurrentUser();
  if(identitySub!==user.userId){identitySub=user.userId;profilePromise=undefined;}
  if(!profilePromise)profilePromise=loadProfile().then(({profile})=>{if(!profile)throw new Error('Guardá tu perfil antes de usar amigos y chats.');return profile.id;}).catch(error=>{profilePromise=undefined;throw error;});
  selfProfileId=await profilePromise;
 }
 const result=await client.mutations.clubSocial({action,...args,...(selfProfileId?{selfProfileId}:{})});
 if(result.errors?.length)throw new Error(result.errors.map(e=>e.message).join(' '));
 if(!result.data)throw new Error('AWS no confirmó la respuesta. Volvé a intentar.');
 return JSON.parse(result.data);
}
