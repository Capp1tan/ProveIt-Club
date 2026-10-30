import { profileClient } from './auth-client.js';
import {Hub} from 'aws-amplify/utils';
let badges = [];
let accessPromise,badgePromise,badgeEpoch=0;
Hub.listen('auth',({payload})=>{if(['signedOut','signedIn'].includes(payload.event)){badgeEpoch++;badges=[];accessPromise=undefined;badgePromise=undefined;}});
function data(result) {
  if (result.errors?.length) throw new Error(result.errors.map(error => error.message).join(' '));
  return result.data;
}
export function initializeAccess() {
  if (!accessPromise) accessPromise = profileClient().then(client => client.mutations.initializeClubAccess()).then(data).catch(error => { accessPromise = undefined; throw error; });
  return accessPromise;
}
export function loadBadges() {
  if(!badgePromise)badgePromise=readBadges().finally(()=>{badgePromise=undefined;});
  return badgePromise;
}
async function readBadges(){const current=badgeEpoch;const {communityAction}=await import('./community-api.js');const rows=(await communityAction('BADGES')).badges;if(current===badgeEpoch)badges=rows;}
export function badgeElements(sub) {
  const wrapper = document.createElement('span'); wrapper.className = 'club-badges';
  if (!sub) return wrapper;
  for (const badge of badges.filter(item => item.accountSub === sub || item.accountUsername === sub)) {
    const text = badge.code.startsWith('CUSTOM_') ? badge.label : { CREATOR: '★ Fundador', BETA_TESTER: '✦ Betatester', VERIFIED:'✓ Verificado' }[badge.code];
    if (!text) continue;
    const node = document.createElement('span'); node.className = 'club-badge'; node.dataset.code = badge.code;
    if (badge.code === 'VERIFIED') {
      // Roseta azul con tilde: el nombre accesible reemplaza la etiqueta visible.
      node.classList.add('verified-icon');
      node.setAttribute('role', 'img'); node.setAttribute('aria-label', 'Cuenta verificada'); node.title = 'Cuenta verificada';
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('aria-hidden', 'true');
      const seal = document.createElementNS(svg.namespaceURI, 'path');
      seal.setAttribute('fill', 'currentColor');
      seal.setAttribute('d', 'M12 1.5 15 3l3.4.2 1.4 3.1 2.4 2.4-.8 3.3.8 3.3-2.4 2.4-1.4 3.1L15 21l-3 1.5L9 21l-3.4-.2-1.4-3.1-2.4-2.4.8-3.3-.8-3.3 2.4-2.4 1.4-3.1L9 3Z');
      const check = document.createElementNS(svg.namespaceURI, 'path');
      check.setAttribute('d', 'm7.3 12 3.1 3.1 6.3-6.3'); check.setAttribute('fill', 'none'); check.setAttribute('stroke', '#fff'); check.setAttribute('stroke-width', '2.2'); check.setAttribute('stroke-linecap', 'round'); check.setAttribute('stroke-linejoin', 'round');
      svg.append(seal, check); node.append(svg);
    } else {node.textContent = text;if(badge.code.startsWith('CUSTOM_')){node.classList.add('custom-badge');if(/^#[a-f0-9]{6}$/i.test(badge.color || ''))node.style.setProperty('--badge-color',badge.color);node.dataset.effect=['GLOW','SHIMMER'].includes(badge.effect)?badge.effect:'NONE';node.title=text;}} 
    wrapper.append(node);
  }
  return wrapper;
}
// La identidad de AWS y las insignias guardadas deciden el aro, nunca el nick editable.
export function decorateAvatar(node, sub) {
  if (!node) return;
  const codes = badges.filter(item => sub && (item.accountSub === sub || item.accountUsername === sub)).map(item => item.code);
  const accent = codes.includes('CREATOR') ? 'creator' : codes.includes('VERIFIED') ? 'verified' : '';
  if (accent) node.dataset.accountAccent = accent;
  else delete node.dataset.accountAccent;
}
// Administración exclusiva: el servidor vuelve a comprobar al Creador en cada cambio.
export async function mountBadgeAdmin(host){
 const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
 const root=el('section'),title=el('h3','Emblemas del club'),status=el('p'),search=el('input'),list=el('div');root.className='badge-management';search.type='search';search.placeholder='Buscar cuenta por nick';search.setAttribute('aria-label','Buscar cuenta para emblemas');root.append(title,el('p','El verificado usa el mismo tilde en todo el sitio. Los emblemas personalizados aparecen junto al nombre.'),search,list,status);host.append(root);
 const client=await profileClient(),{clubDirectory}=await import('./community-api.js');const profiles=await clubDirectory();await loadBadges();
 const form=el('form');form.className='community-form';const target=el('select'),name=el('input'),color=el('input'),effect=el('select'),save=el('button','Otorgar emblema personalizado'),cancel=el('button','Cancelar edición');let editing=null;
 target.required=true;for(const p of profiles){const o=el('option',p.nickname);o.value=p.id;target.append(o);}name.required=true;name.minLength=2;name.maxLength=24;name.placeholder='Ejemplo: Fundador';color.type='color';color.value='#c1f36b';for(const [v,t] of [['NONE','Sin animación'],['GLOW','Brillo suave'],['SHIMMER','Destello lento']]){const o=el('option',t);o.value=v;effect.append(o);}for(const [text,input] of [['Cuenta',target],['Nombre del emblema',name],['Color',color],['Efecto',effect]]){const l=el('label',text);l.append(input);form.append(l);}save.type='submit';cancel.type='button';cancel.hidden=true;form.append(save,cancel);root.insertBefore(form,search);
 const reset=()=>{editing=null;save.textContent='Otorgar emblema personalizado';cancel.hidden=true;};cancel.addEventListener('click',reset);target.addEventListener('change',reset);
 async function change(args){data(await client.mutations.manageClubBadge(args));await loadBadges();render();window.dispatchEvent(new Event('proveit:badges-updated'));status.textContent='Emblemas actualizados.';}
 form.addEventListener('submit',async e=>{e.preventDefault();save.disabled=true;try{await change({profileId:target.value,code:editing || 'CUSTOM_'+crypto.randomUUID(),enabled:true,label:name.value.trim(),color:color.value,effect:effect.value});reset();name.value='';}catch(e){status.textContent=e.message;}finally{save.disabled=false;}});
 function action(label,run){const b=el('button',label);b.type='button';b.className='social-button';b.addEventListener('click',async()=>{b.disabled=true;try{await run();}catch(e){status.textContent=e.message;b.disabled=false;}});return b;}
 function render(){list.replaceChildren();for(const p of profiles.filter(p=>p.nickname.toLocaleLowerCase('es').includes(search.value.trim().toLocaleLowerCase('es')))){
  const sub=p.owner.split('::')[0],row=el('article');row.className='badge-admin-person';const heading=el('strong',p.nickname);heading.append(badgeElements(sub));row.append(heading);
  for(const [code,label] of [['VERIFIED','verificado'],['BETA_TESTER','Betatester']]){const enabled=badges.some(b=>b.accountSub===sub && b.code===code);row.append(action((enabled?'Quitar ':'Dar ')+label,()=>change({profileId:p.id,code,enabled:!enabled})));}
  for(const b of badges.filter(b=>b.accountSub===sub && b.code.startsWith('CUSTOM_'))){row.append(action('Editar '+b.label,async()=>{target.value=p.id;name.value=b.label;color.value=b.color || '#c1f36b';effect.value=b.effect || 'NONE';editing=b.code;save.textContent='Guardar cambios del emblema';cancel.hidden=false;name.focus();}),action('Quitar '+b.label,()=>change({profileId:p.id,code:b.code,enabled:false})));}
  row.append(action('Permitir sin teléfono',async()=>{data(await client.mutations.setClubPhoneOptional({profileId:p.id,phoneOptional:true}));status.textContent=p.nickname+': excepción de teléfono habilitada.';}));list.append(row);
 }}search.addEventListener('input',render);render();
}
