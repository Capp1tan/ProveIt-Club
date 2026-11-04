import {Hub} from 'aws-amplify/utils';
import {configureAmplify,getCurrentUser,avatarUrl} from './auth-client.js';
import {listClubTournaments} from './tournaments-api.js';
import {viewClubProfile} from './community-api.js';
import {homeActivity,latestChampion} from '../shared/home-activity.ts';
import '../home-activity.css';

const root=document.querySelector('[data-home-community]');
const node=(tag,text='',cls='')=>{const n=document.createElement(tag);n.textContent=text;if(cls)n.className=cls;return n;};
const trophy=()=>{const n=node('span','','community-trophy');n.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3h8v7a4 4 0 0 1-8 0ZM8 5H4v3a4 4 0 0 0 4 4m8-7h4v3a4 4 0 0 1-4 4M12 14v6m-5 1h10"/></svg>';return n;};
if(root){
  const ticker=root.querySelector('[data-activity-ticker]'),hall=root.querySelector('[data-hall-card]');
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let user='',epoch=0,busy=false,timer,visible=false,lastFingerprint='',rows=[],hallObserver;
  function empty(mode='empty'){
    ticker.hidden=true;hallObserver?.disconnect();hall.replaceChildren();
    hall.append(trophy(),node('h3',mode==='guest'?'Tu próxima victoria puede quedar acá':mode==='error'?'No pudimos cargar al último campeón':'El salón está vacío'));
    hall.append(node('p',mode==='guest'?'Ingresá para conocer a los campeones del club.':mode==='error'?'Intentá nuevamente en unos momentos.':'El primero que gane un torneo queda acá. ¿Vas a ser vos?'));
    const action=node(mode==='error'?'button':'a',mode==='guest'?'Ingresar':mode==='error'?'Reintentar':'Crear torneo','community-action');
    if(action.tagName==='A')action.href='/crear-torneo.html';else{action.type='button';action.addEventListener('click',()=>void refresh());}
    if(mode==='guest')action.addEventListener('click',event=>{const login=document.querySelector('[data-login]');if(login){event.preventDefault();login.click();}});
    hall.append(action);hall.className='hall-champion hall-empty';
  }
  function renderTicker(items){
    ticker.replaceChildren();ticker.hidden=!items.length;if(!items.length)return;
    const viewport=node('div','','community-marquee');viewport.tabIndex=0;viewport.setAttribute('aria-label','Novedades del club. La animación se detiene al interactuar.');
    const track=node('div','','community-marquee-track');track.style.setProperty('--marquee-duration',Math.max(24,items.length*6)+'s');
    const row=copy=>{const ul=node('ul','','community-marquee-row');if(copy){ul.setAttribute('aria-hidden','true');ul.inert=true;}
      for(const item of items){const li=node('li','','community-news');li.dataset.tone=item.tone;const mark=item.tone==='gold'?trophy():node('span','','community-news-dot');mark.setAttribute('aria-hidden','true');const a=node('a',item.text);a.href=item.href;if(copy)a.tabIndex=-1;li.append(mark,a);ul.append(li);}return ul;};
    track.append(row(false),row(true));viewport.append(track);ticker.append(viewport);
    if(items.length<2)ticker.classList.add('is-static');else ticker.classList.remove('is-static');
  }
  async function renderHall(winner,token){
    if(!winner){empty();return;}hallObserver?.disconnect();hall.className='hall-champion';hall.replaceChildren();
    const head=node('div','','hall-champion-top');head.append(node('span','Último campeón'),trophy());
    const identity=node('a','','hall-champion-identity'),avatar=node('span',Array.from(winner.winnerName)[0] || '?','hall-champion-avatar'),name=node('strong',winner.winnerName);
    identity.href=winner.participantIds?.includes(winner.winnerProfileId)?'/perfil.html?id='+encodeURIComponent(winner.winnerProfileId):'/torneos.html';identity.append(avatar,name);
    const detail=node('p','','hall-champion-event');detail.append(document.createTextNode('Ganó '));const title=node('strong',winner.name);detail.append(title);
    const when=Date.parse(winner.decidedAt);if(Number.isFinite(when)){const time=node('time',new Intl.DateTimeFormat('es-AR',{day:'numeric',month:'short',year:'numeric'}).format(when));time.dateTime=winner.decidedAt;detail.append(document.createTextNode(' · '),time);}
    hall.append(head,identity,detail);
    if(!reduced.matches && 'IntersectionObserver' in window){hallObserver=new IntersectionObserver(([entry])=>{if(entry.isIntersecting){hall.classList.add('has-sheen');hallObserver.disconnect();}},{threshold:.3});hallObserver.observe(hall);}
    if(!winner.participantIds?.includes(winner.winnerProfileId))return;
    try{const profile=await viewClubProfile(winner.winnerProfileId);if(token!==epoch || !avatar.isConnected)return;if(profile?.avatarPath){const url=await avatarUrl(profile.avatarPath,{profileId:profile.id});if(token!==epoch || !avatar.isConnected || !url)return;const img=node('img');img.src=url;img.alt='';img.width=56;img.height=56;img.decoding='async';img.addEventListener('error',()=>{avatar.textContent=Array.from(winner.winnerName)[0] || '?';},{once:true});avatar.replaceChildren(img);}}catch{/* El resultado guardado sigue visible si la foto no está disponible. */}
  }
  function render(){const items=homeActivity(rows),winner=latestChampion(rows),fingerprint=JSON.stringify({items,winner});if(fingerprint===lastFingerprint)return;lastFingerprint=fingerprint;renderTicker(items);if(winner)void renderHall(winner,epoch);else{const hadItems=items.length;empty();if(hadItems)renderTicker(items);}}
  function schedule(){clearTimeout(timer);if(user && visible && !document.hidden)timer=setTimeout(()=>void refresh(),60000);}
  async function refresh(){if(!user || busy || document.hidden || !visible)return;busy=true;const token=epoch;try{const next=await listClubTournaments();if(token!==epoch)return;rows=next;render();}catch{if(token===epoch && !rows.length)empty('error');}finally{if(token===epoch)busy=false;schedule();}}
  async function session(){const token=++epoch;busy=false;rows=[];lastFingerprint='';clearTimeout(timer);try{if(!await configureAmplify())throw new Error('unavailable');const me=await getCurrentUser();if(token!==epoch)return;user=me.userId;hall.setAttribute('aria-busy','true');void refresh().finally(()=>{if(token===epoch)hall.removeAttribute('aria-busy');});}catch{if(token===epoch){user='';empty('guest');}}}
  Hub.listen('auth',({payload})=>{if(['signedIn','signedOut'].includes(payload.event)){if(payload.event==='signedOut'){++epoch;user='';rows=[];busy=false;lastFingerprint='';clearTimeout(timer);empty('guest');}else void session();}});
  window.addEventListener('proveit:tournament-deleted',()=>{lastFingerprint='';void refresh();});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)void refresh();schedule();});
  if('IntersectionObserver' in window)new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;if(visible)void refresh();schedule();},{rootMargin:'160px'}).observe(root);else visible=true;
  void session();
}
