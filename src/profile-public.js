import {viewClubProfile} from './community-api.js';
import {reputationPanel,socialLinks} from './profile-components.js';
import {avatarUrl,getCurrentUser,signOut} from './auth-client.js';
import {loadBadges,badgeElements,decorateAvatar} from './badges.js';
export async function mountPublicProfile(id){
 document.getElementById('signOutButton')?.addEventListener('click',async()=>{await signOut();location.href='/';});
 const main=document.querySelector('main');main.replaceChildren();
 const el=(tag,text,cls)=>{const n=document.createElement(tag);n.textContent=text;if(cls)n.className=cls;return n;};
 const status=el('p','Cargando perfil…');status.setAttribute('role','status');main.append(status);
 try{
  const user=await getCurrentUser();const [p]=await Promise.all([viewClubProfile(id),loadBadges()]);
  if(!p)throw new Error('Este perfil no está disponible.');
  if(p.owner?.split('::')[0]===user.userId){location.replace('/perfil.html');return;}
  const card=el('section','','profile-card'),avatar=el('div',p.nickname[0],'avatar-preview');decorateAvatar(avatar,p.owner?.split('::')[0]);
  if(p.avatarPath){const url=await avatarUrl(p.avatarPath);if(url){const image=el('img','');image.src=url;image.alt='Foto de '+p.nickname;avatar.replaceChildren(image);}}
  card.append(avatar,el('h1',p.nickname),badgeElements(p.owner?.split('::')[0]));
  if(p.canView)card.append(el('p',p.bio || 'Todavía no agregó una biografía.'),socialLinks(p));
  else card.append(el('p','Perfil privado. La biografía, la foto y las redes sólo están disponibles para sus amigos.'));
  const friendship=el('a','Amistad y mensajes ↗','primary-button');friendship.href='/amigos.html?persona='+encodeURIComponent(id);card.append(friendship);
  main.replaceChildren(card,reputationPanel(p.reputation,p.judgeEnabled));document.title=p.nickname+' — ProveIt Club';
 }catch(e){status.textContent=e.message || 'No pudimos cargar el perfil.';}
 finally{window.proveitLoadingDone?.('page');}
}
