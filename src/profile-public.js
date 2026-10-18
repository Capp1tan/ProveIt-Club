import {viewClubProfile} from './community-api.js';
import {reputationPanel} from './profile-components.js';
import {getCurrentUser,signOut} from './auth-client.js';
import {loadBadges} from './badges.js';
import {profileIdentity,profileProgress} from './profile-leagues.js';
export async function mountPublicProfile(id){
 document.getElementById('signOutButton')?.addEventListener('click',async()=>{await signOut();location.href='/';});
 const main=document.querySelector('main');main.replaceChildren();
 const el=(tag,text,cls)=>{const n=document.createElement(tag);n.textContent=text;if(cls)n.className=cls;return n;};
 const status=el('p','Cargando perfil…');status.setAttribute('role','status');main.append(status);
 try{
  const user=await getCurrentUser();const [p]=await Promise.all([viewClubProfile(id),loadBadges()]);
  if(!p)throw new Error('Este perfil no está disponible.');
  if(p.owner?.split('::')[0]===user.userId){location.replace('/perfil.html');return;}
  const card=profileIdentity(p);
  const friendship=el('a','Amistad y mensajes ↗','league-action');friendship.href='/amigos.html?persona='+encodeURIComponent(id);
  main.replaceChildren(card,profileProgress(p),friendship,reputationPanel(p.reputation,p.judgeEnabled));document.title=p.nickname+' — ProveIt Club';
 }catch(e){status.textContent=e.message || 'No pudimos cargar el perfil.';}
 finally{window.proveitLoadingDone?.('page');}
}
