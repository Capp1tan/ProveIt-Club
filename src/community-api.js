import {configureAmplify,profileClient} from './auth-client.js';
// No cacheamos perfiles ajenos: cada lectura vuelve a aplicar amistad y privacidad.
export async function communityAction(action,args={}){
 if(!await configureAmplify())throw new Error('No pudimos conectar con el club.');
 const api=await profileClient(),r=await api.mutations.clubCommunity({action:'COMMUNITY_'+action,...args});
 if(r.errors?.length)throw new Error(r.errors.map(e=>e.message).join(' '));
 if(!r.data)throw new Error('El servidor no confirmó la respuesta.');return JSON.parse(r.data);
}
export async function clubDirectory(){const profiles=[];let cursor;do{const r=await communityAction('DIRECTORY',{cursor});profiles.push(...r.profiles);cursor=r.cursor;}while(cursor);return profiles.sort((a,b)=>a.nickname.localeCompare(b.nickname,'es'));}
export async function viewClubProfile(id){return (await communityAction('PROFILE',{targetProfileId:id})).profile;}

