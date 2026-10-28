import {communityAction} from './community-api.js';
import {avatarUrl} from './auth-client.js';
import {badgeElements,decorateAvatar} from './badges.js';
import {socialLinks} from './profile-components.js';
import '../leagues.css';

const node=(tag,text='',cls='')=>{const el=document.createElement(tag);el.textContent=text;if(cls)el.className=cls;return el;};
const date=value=>new Intl.DateTimeFormat('es',{day:'numeric',month:'short',year:'numeric'}).format(new Date(value));

// El encabezado usa exclusivamente el perfil ya filtrado por el servidor.
export function profileIdentity(profile){
 const card=node('section','','league-identity league-panel');
 const avatar=node('div',profile.nickname?.slice(0,1).toUpperCase() || '?','avatar-preview league-avatar');
 decorateAvatar(avatar,profile.owner?.split('::')[0]);
 if(profile.avatarPath)void avatarUrl(profile.avatarPath).then(url=>{
  if(!url)return;const image=node('img');image.src=url;image.alt='Foto de '+profile.nickname;image.width=112;image.height=112;avatar.replaceChildren(image);
 }).catch(()=>{});
 const copy=node('div','','league-identity-copy'),title=node('h1','','profile-name-line');
 title.append(node('span',profile.nickname),badgeElements(profile.owner?.split('::')[0]));copy.append(title);
 copy.append(node('p',profile.canView?(profile.bio || 'Siempre hay una nueva competencia.'):'Perfil privado · sólo amigos'));
 card.append(avatar,copy);
 if(profile.canView)card.append(socialLinks(profile));
 return card;
}

function symbol(rank){
 const el=node('span','','league-symbol');el.setAttribute('aria-hidden','true');
 el.style.backgroundPosition=((rank%4)*100/3)+'% '+(rank<4?'0%':'100%');return el;
}
function messagePanel(title,copy){const card=node('section','','league-panel');card.append(node('h2',title),node('p',copy));return card;}

/** Carga secundaria: un error del progreso no impide ver o editar el perfil.
 * No se calcula XP en el cliente ni se guarda en localStorage. Recargar no suma.
 */
export function profileProgress(profile){
 const root=node('div','','league-progress-root');root.setAttribute('aria-busy','true');
 const pending=messagePanel('Liga y participaciones','Cargando tu recorrido en el club…');root.append(pending);
 if(!profile.canView){root.replaceChildren(messagePanel('Recorrido privado','Las ligas, participaciones y logros de este perfil sólo están disponibles para sus amigos.'));root.removeAttribute('aria-busy');return root;}
 const load=async()=>{
  root.setAttribute('aria-busy','true');
  try{
   const data=await communityAction('PROGRESS',{targetProfileId:profile.id});
   if(data.hidden){root.replaceChildren(messagePanel('Recorrido privado','Este perfil sólo comparte su recorrido con amigos.'));return;}
   if(!Array.isArray(data.history) || !Array.isArray(data.achievements) || !Number.isFinite(data.xp))throw new Error('La actualización de ligas todavía no está disponible.');
   const card=node('section','','league-current league-panel'),identity=node('div','','league-current-identity');
   if(data.rank)identity.append(symbol(data.rank.index));
   else{const empty=node('span','◇','league-unranked');empty.setAttribute('aria-hidden','true');identity.append(empty);}
   const label=node('div');label.append(node('p',data.rank?'LIGA ACTUAL':'TU RECORRIDO EMPIEZA ACÁ','league-eyebrow'),node('h2',data.rank?.name || 'Sin liga'));identity.append(label);card.append(identity);
   const experience=node('div','','league-experience');
   if(!data.rank){
    experience.append(node('p','Competí para desbloquear ligas y recompensas.'),node('small','Completá tu primer torneo válido para obtener tu primera liga. Los logros son la primera recompensa; los premios reales se anunciarán por separado.'));
    const explore=node('a','Buscar torneos ↗','league-action');explore.href='/torneos.html';experience.append(explore);
   }else{
    experience.append(node('h3','Experiencia'));
    const meter=node('progress');meter.max=data.nextMinimum || Math.max(1,data.xp);meter.value=data.xp;meter.setAttribute('aria-label','Experiencia acumulada');
    experience.append(meter,node('p',data.nextMinimum?data.xp.toLocaleString('es')+' / '+data.nextMinimum.toLocaleString('es')+' XP':data.xp.toLocaleString('es')+' XP · Liga máxima'),node('small','La experiencia reconoce tu recorrido en el club. No representa un saldo de dinero.'));
   }card.append(experience);
   const columns=node('div','','league-histories'),history=messagePanel('Historial de participaciones',''),achievements=messagePanel('Historial de logros','');
   history.lastElementChild.remove();achievements.lastElementChild.remove();
   if(!data.history.length)history.append(node('p','Todavía no hay participaciones confirmadas. Tu próximo desafío puede ser el primero.'));
   else{
    const labels=node('div','','league-history-labels');labels.setAttribute('aria-hidden','true');labels.append(node('span','TORNEO'),node('span','FECHA'),node('span','RESULTADO'));history.append(labels);
    const list=node('ul','','league-event-list');
    for(const event of data.history){const li=node('li'),closed=event.roomClosed || (event.roomClosesAt && Date.now()>=event.roomClosesAt),link=node(closed?'article':'a','','league-event');
     if(!closed)link.href='/torneo.html?id='+encodeURIComponent(event.id);
     const identity=node('div','','league-event-identity'),image=node('img');image.className='league-event-image';image.loading='lazy';image.decoding='async';image.width=112;image.height=68;
     const fallback='/tournaments/'+(event.status==='COMPLETED'?'trophy':'arena')+'.svg';image.src=event.coverUrl || fallback;image.alt=event.coverUrl?'Portada de '+event.name:'';image.addEventListener('error',()=>{image.src=fallback;image.alt='';},{once:true});
     const copy=node('div');copy.append(node('strong',event.name),node('small',event.activity+' · '+event.role));if(closed)copy.append(node('small','Sala cerrada','league-room-closed'));identity.append(image,copy);
     const when=node('time',date(event.date),'league-event-date');when.dateTime=event.date;
     const result=node('span',event.result,'league-result');result.dataset.tone=['gold','silver','bronze'].includes(event.resultTone)?event.resultTone:'neutral';
     link.append(identity,when,result);li.append(link);list.append(li);
    }history.append(list);
    if(data.history.length===20)history.append(node('small','Se muestran las últimas 20 participaciones.'));
   }
   if(!data.achievements.length)achievements.append(node('p','Tus primeros logros aparecerán al completar torneos válidos.'));
   else{const list=node('ul','','league-achievements');for(const item of data.achievements){const li=node('li'),mark=node('span',item.kind==='victory'?'★':'✦','league-achievement-mark'),copy=node('div');mark.setAttribute('aria-hidden','true');copy.append(node('strong',item.title),node('small',date(item.date)));li.append(mark,copy);list.append(li);}achievements.append(list);}
   columns.append(history,achievements);
   const rules=node('details','','league-rules');rules.append(node('summary','Cómo se obtiene experiencia'),node('p','25 XP por torneo completado y 10 XP adicionales por victoria. Sólo cuentan eventos creados y terminados desde el lanzamiento de ligas, con al menos dos participantes confirmados y resultado definitivo. Máximo tres eventos por día UTC y uno por el mismo grupo de rivales al día. Invitaciones pendientes, cancelaciones, pagos revertidos y resultados por sanción no suman. Los torneos anteriores se conservan en el historial sin otorgar XP retroactiva.'));
   root.replaceChildren(card,columns,rules);
  }catch(error){const retry=messagePanel('No pudimos cargar el recorrido',error.message || 'Intentá otra vez en unos momentos.');const button=node('button','Reintentar','league-action');button.type='button';button.addEventListener('click',()=>{root.replaceChildren(pending);void load();},{once:true});retry.append(button);root.replaceChildren(retry);}
  finally{root.removeAttribute('aria-busy');}
 };void load();return root;
}
