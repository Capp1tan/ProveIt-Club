import {competitionHasBegun} from '../shared/competition.ts';
import {communityAction} from './community-api.js';
import { prizeTypes, prizeIcon } from './prize-types.js';
import { preparePrizeUpload, saveTournamentPrize } from './tournaments-api.js';
const el=(tag,text,cls)=>{const n=document.createElement(tag);n.textContent=text;if(cls)n.className=cls;return n;};
const parse=value=>{try{const data=JSON.parse(value || '[]');return Array.isArray(data)?data:[];}catch{return [];}};
const types=['image/jpeg','image/png','image/webp'];
// Adjuntos privados: las URL de lectura son temporales; la ruta se conserva en AWS.
async function showAttachment(item,container){
  if(!/^prize-media\/[a-f0-9-]{36}\//i.test(item.path || '')){container.remove();return;}
  try{
    const {getUrl}=await import('aws-amplify/storage');
    const result=await getUrl({path:item.path,options:{expiresIn:3600}});
    const media=el(item.kind==='video'?'video':'img');
    if(item.kind==='video'){media.controls=true;media.preload='none';media.playsInline=true;media.setAttribute('aria-label',item.name || 'Video del premio');}
    else{media.alt=item.name || 'Imagen del premio';media.loading='lazy';media.decoding='async';}
    media.src=result.url.toString();container.replaceChildren(media);
  }catch{if(container.classList.contains('prize-feature-media'))container.remove();else container.textContent='No pudimos cargar este adjunto. Actualizá para reintentar.';}
}
export function prizePanel(t,{canEdit,onSaved}){
  const section=el('section','','prize-showcase');
  const card=el('div','','prize-feature');
  const copy=el('div','','prize-feature-copy');
  const attachments=parse(t.prizeAttachments),links=parse(t.prizeLinks);
  const featured=!t.prizeImagePath && attachments.find(item=>item.kind==='image');
  if(t.prizeTitle && (t.prizeImagePath || featured)){
    const frame=el('div','','prize-feature-media');
    card.append(frame);
    if(t.prizeImagePath){
      const photo=el('img');photo.alt='Foto del premio';photo.loading='lazy';photo.decoding='async';
      photo.addEventListener('error',()=>frame.remove(),{once:true});
      frame.append(photo);
      void communityAction('PRIZE_IMAGE_URL',{tournamentId:t.id}).then(result=>{photo.src=result.url;}).catch(()=>frame.remove());
    }else{
      void showAttachment(featured,frame);
    }
  }
  const glyph=prizeIcon(t.prizeType);glyph.classList.add('prize-category-icon');
  const kicker=el('p','','prize-kicker');
  kicker.append(glyph,document.createTextNode(t.prizeTitle?'ESTO ESTÁ EN JUEGO':'PREMIO POR ANUNCIAR'));
  copy.append(kicker,el('h2',t.prizeTitle || 'El premio está por anunciarse'));
  if(t.prizeTitle)copy.append(el('p','Entrega: '+(t.prizeHolder || 'Sin declarar'),'prize-responsible'));
  if(t.prizeDescription)copy.append(el('p',t.prizeDescription,'prize-description'));
  card.append(copy);section.append(card);
  if(t.prizeTitle)section.append(el('p','La entrega del premio se gestiona fuera de ProveIt.','prize-disclosure field-help'));
  const otherAttachments=attachments.filter(item=>item!==featured);
  if(otherAttachments.length){const gallery=el('div','','prize-gallery');for(const item of otherAttachments){const tile=el('div','Cargando adjunto…','prize-media');gallery.append(tile);void showAttachment(item,tile);}section.append(gallery);}
  if(links.length){const list=el('div','','prize-links');for(const raw of links){try{const u=new URL(raw);if(u.protocol!=='https:' || u.username || u.password)continue;const a=el('a','↗ '+u.hostname);a.href=u.href;a.target='_blank';a.rel='noopener noreferrer';list.append(a);}catch{/* No convertir texto inválido en HTML. */}}section.append(list);}
  if(!t.prizeTitle)section.append(el('p',t.arbitrationMode==='ORGANIZER'?'El organizador anunciará qué se lleva el ganador.':'Un juez confirmado anunciará qué se lleva el ganador.','field-help'));
  if(canEdit && !t.winnerProfileId && t.status!=='COMPLETED' && !competitionHasBegun(t)){
    const edit=el('button',t.prizeTitle?'Editar premio':'Anunciar premio','primary-button');edit.type='button';
    edit.addEventListener('click',()=>{edit.hidden=true;section.dataset.prizeEditing='true';section.append(prizeForm(t,attachments,links,{onSaved,onCancel:()=>{section.querySelector('form')?.remove();delete section.dataset.prizeEditing;edit.hidden=false;}}));});section.append(edit);
  }
  return section;
}
function prizeForm(t,attachments,links,{onSaved,onCancel}){
  const form=el('form','','prize-form');
  const field=(text,input)=>{const label=el('label',text);label.append(input);form.append(label);};
  const title=el('input');title.required=true;title.maxLength=120;title.value=t.prizeTitle || '';field('Nombre del premio',title);
  const holder=el('input');holder.maxLength=120;holder.value=t.prizeHolder || '';holder.required=true;field('Quién posee o entregará el premio',holder);
  const retained=attachments.map(item=>({...item}));
  for(const item of retained){const label=el('label','','prize-keep');const check=el('input');check.type='checkbox';check.checked=true;check.addEventListener('change',()=>{item.remove=!check.checked;});label.append(check,document.createTextNode('Conservar '+item.name));form.append(label);}
  const files=el('input');files.type='file';files.multiple=false;files.accept=types.join(',');field('Foto del premio (opcional)',files);
  form.append(el('p','Una nueva foto JPG, PNG o WebP de hasta 5 MB. El premio puede cambiarse antes de comenzar; todos deberán aceptar las nuevas condiciones.','field-help'));
  const actions=el('div','','prize-actions'),save=el('button','Guardar premio','primary-button'),cancel=el('button','Cancelar','format-choice'),message=el('p','','field-help');save.type='submit';cancel.type='button';cancel.addEventListener('click',onCancel);message.setAttribute('role','status');actions.append(save,cancel);form.append(actions,message);
  // Si se reintenta después de un fallo, se reutilizan los archivos ya subidos.
  const uploaded=new Map();
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(save.disabled)return;
    const selected=Array.from(files.files || []),keep=retained.filter(item=>!item.remove).map(({path,name,kind})=>({path,name,kind})),urls=links;
    try{
      if(keep.length+selected.length>4 || urls.length>5)throw new Error('Hasta 4 archivos y 5 enlaces.');
      for(const url of urls){let u;try{u=new URL(url);}catch{throw new Error('Usá enlaces completos con https://.');}if(u.protocol!=='https:' || u.username || u.password)throw new Error('Usá enlaces HTTPS sin credenciales.');}
      for(const file of selected){if(!types.includes(file.type) || file.size<1 || file.size>(file.type.startsWith('video/')?20:5)*1024*1024)throw new Error('Revisá los formatos y tamaños de los archivos.');}
      if(!title.value.trim())throw new Error('Dale un nombre al premio.');
      save.disabled=true;cancel.disabled=true;message.textContent='Preparando premio…';
      for(const [index,file] of selected.entries()){
        if(!uploaded.has(file)){
          message.textContent=`Subiendo archivo ${index+1} de ${selected.length}…`;
          const grant=await preparePrizeUpload({tournamentId:t.id,uploadContentType:file.type,uploadSize:file.size});
          if(!grant?.url || !grant.path)throw new Error('AWS no confirmó la carga.');
          const result=await fetch(grant.url,{method:'PUT',headers:{'Content-Type':file.type},body:file,signal:AbortSignal.timeout(120000)});
          if(!result.ok)throw new Error('No pudimos subir el archivo. Revisá tu conexión y reintentá.');
          uploaded.set(file,{path:grant.path,name:file.name.slice(0,120),kind:file.type.startsWith('video/')?'video':'image'});
        }
        keep.unshift(uploaded.get(file));
      }
      message.textContent='Guardando premio…';
      const saved=await saveTournamentPrize({tournamentId:t.id,prizeType:'OTHER',prizeTitle:title.value.trim(),prizeDescription:t.prizeDescription || '',prizeLinks:JSON.stringify(urls),prizeAttachments:JSON.stringify(keep),prizeRevision:t.prizeRevision || 0,prizeHolder:holder.value.trim(),prizeFunder:t.prizeFunder || '',prizeFundingStatus:'CONFIRMED'});
      if(!saved?.id)throw new Error('AWS no confirmó el cambio. Actualizá antes de volver a guardar.');
      delete form.parentElement.dataset.prizeEditing;onSaved(saved);
    }catch(error){message.textContent=error.message;save.disabled=false;cancel.disabled=false;}
  });
  return form;
}
