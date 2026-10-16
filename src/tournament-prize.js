import { preparePrizeUpload, saveTournamentPrize } from './tournaments-api.js';
const el=(tag,text,cls)=>{const n=document.createElement(tag);n.textContent=text;if(cls)n.className=cls;return n;};
const parse=value=>{try{const data=JSON.parse(value || '[]');return Array.isArray(data)?data:[];}catch{return [];}};
const types=['image/jpeg','image/png','image/webp','video/mp4','video/webm'];
// Adjuntos privados: las URL de lectura son temporales; la ruta se conserva en AWS.
async function showAttachment(item,container){
  if(!/^prize-media\/[a-f0-9-]{36}\//i.test(item.path || ''))return;
  try{
    const {getUrl}=await import('aws-amplify/storage');
    const result=await getUrl({path:item.path,options:{expiresIn:3600}});
    const media=el(item.kind==='video'?'video':'img');
    if(item.kind==='video'){media.controls=true;media.preload='none';media.playsInline=true;media.setAttribute('aria-label',item.name || 'Video del premio');}
    else{media.alt=item.name || 'Imagen del premio';media.loading='lazy';media.decoding='async';}
    media.src=result.url.toString();container.replaceChildren(media);
  }catch{container.textContent='No pudimos cargar este adjunto. Actualizá para reintentar.';}
}
export function prizePanel(t,{canEdit,onSaved}){
  const section=el('section','','prize-showcase');
  section.append(el('p','ESTO ESTÁ EN JUEGO','prize-kicker'),el('h2',t.prizeTitle || 'El premio está por anunciarse'),el('span','PREMIO PROVISIONAL','prize-provisional'));
  if(t.prizeDescription)section.append(el('p',t.prizeDescription,'prize-description'));
  const attachments=parse(t.prizeAttachments),links=parse(t.prizeLinks);
  if(attachments.length){const gallery=el('div','','prize-gallery');for(const item of attachments){const tile=el('div','Cargando adjunto…','prize-media');gallery.append(tile);void showAttachment(item,tile);}section.append(gallery);}
  if(links.length){const list=el('div','','prize-links');for(const raw of links){try{const u=new URL(raw);if(u.protocol!=='https:' || u.username || u.password)continue;const a=el('a','↗ '+u.hostname);a.href=u.href;a.target='_blank';a.rel='noopener noreferrer';list.append(a);}catch{/* No convertir texto inválido en HTML. */}}section.append(list);}
  if(!t.prizeTitle)section.append(el('p',t.arbitrationMode==='ORGANIZER'?'El organizador anunciará qué se lleva el ganador.':'Un juez confirmado anunciará qué se lleva el ganador.','field-help'));
  if(canEdit && !t.winnerProfileId && t.status!=='COMPLETED'){
    const edit=el('button',t.prizeTitle?'Editar premio':'Anunciar premio','primary-button');edit.type='button';
    edit.addEventListener('click',()=>{edit.hidden=true;section.dataset.prizeEditing='true';section.append(prizeForm(t,attachments,{onSaved,onCancel:()=>{section.querySelector('form')?.remove();delete section.dataset.prizeEditing;edit.hidden=false;}}));});section.append(edit);
  }
  return section;
}
function prizeForm(t,attachments,{onSaved,onCancel}){
  const form=el('form','','prize-form');
  const field=(text,input)=>{const label=el('label',text);label.append(input);form.append(label);};
  const title=el('input');title.maxLength=120;title.value=t.prizeTitle || '';field('Nombre del premio',title);
  const description=el('textarea');description.maxLength=1200;description.rows=3;description.value=t.prizeDescription || '';field('Descripción',description);
  const links=el('textarea');links.rows=3;links.value=parse(t.prizeLinks).join('\n');links.placeholder='https://…';field('Enlaces (hasta 5, uno por línea)',links);
  const retained=attachments.map(item=>({...item}));
  for(const item of retained){const label=el('label','','prize-keep');const check=el('input');check.type='checkbox';check.checked=true;check.addEventListener('change',()=>{item.remove=!check.checked;});label.append(check,document.createTextNode('Conservar '+item.name));form.append(label);}
  const files=el('input');files.type='file';files.multiple=true;files.accept=types.join(',');field('Imágenes o videos',files);
  form.append(el('p','Hasta 4 archivos en total. JPG, PNG o WebP: 5 MB cada uno. MP4 o WebM: 20 MB. Podés reemplazar el premio hasta registrar al ganador.','field-help'));
  const actions=el('div','','prize-actions'),save=el('button','Guardar premio','primary-button'),cancel=el('button','Cancelar','format-choice'),message=el('p','','field-help');save.type='submit';cancel.type='button';cancel.addEventListener('click',onCancel);message.setAttribute('role','status');actions.append(save,cancel);form.append(actions,message);
  // Si se reintenta después de un fallo, se reutilizan los archivos ya subidos.
  const uploaded=new Map();
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(save.disabled)return;
    const selected=Array.from(files.files || []),keep=retained.filter(item=>!item.remove).map(({path,name,kind})=>({path,name,kind})),urls=links.value.split('\n').map(v=>v.trim()).filter(Boolean);
    try{
      if(keep.length+selected.length>4 || urls.length>5)throw new Error('Hasta 4 archivos y 5 enlaces.');
      for(const url of urls){let u;try{u=new URL(url);}catch{throw new Error('Usá enlaces completos con https://.');}if(u.protocol!=='https:' || u.username || u.password)throw new Error('Usá enlaces HTTPS sin credenciales.');}
      for(const file of selected){if(!types.includes(file.type) || file.size<1 || file.size>(file.type.startsWith('video/')?20:5)*1024*1024)throw new Error('Revisá los formatos y tamaños de los archivos.');}
      if(!title.value.trim() && (description.value.trim() || urls.length || selected.length || keep.length))throw new Error('Dale un nombre al premio.');
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
        keep.push(uploaded.get(file));
      }
      message.textContent='Guardando premio…';
      const saved=await saveTournamentPrize({tournamentId:t.id,prizeTitle:title.value.trim(),prizeDescription:description.value.trim(),prizeLinks:JSON.stringify(urls),prizeAttachments:JSON.stringify(keep),prizeRevision:t.prizeRevision || 0});
      if(!saved?.id)throw new Error('AWS no confirmó el cambio. Actualizá antes de volver a guardar.');
      delete form.parentElement.dataset.prizeEditing;onSaved(saved);
    }catch(error){message.textContent=error.message;save.disabled=false;cancel.disabled=false;}
  });
  return form;
}
