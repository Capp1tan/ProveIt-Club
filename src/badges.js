import { profileClient } from './auth-client.js';
let badges = [];
let accessPromise,badgePromise;
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
async function readBadges() {
  const client = await profileClient();
  const items = []; let nextToken;
  do {
    const result = await client.models.ClubBadge.list({ limit: 100, nextToken });
    items.push(...(data(result) || [])); nextToken = result.nextToken;
  } while (nextToken);
  badges = items;
}
export function badgeElements(sub) {
  const wrapper = document.createElement('span'); wrapper.className = 'club-badges';
  if (!sub) return wrapper;
  for (const badge of badges.filter(item => item.accountSub === sub || item.accountUsername === sub)) {
    const text = { CREATOR: '★ Creador', BETA_TESTER: '✦ Betatester', VERIFIED:'✓ Verificado' }[badge.code];
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
    } else node.textContent = text;
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
export async function mountBadgeAdmin() {
  const section = document.getElementById('badgeAdmin'), people = document.getElementById('badgePeople'), search = document.getElementById('badgeSearch'), notice = document.getElementById('badgeNotice');
  const client = await profileClient(); let nextToken; const profiles = [];
  do {
    const result = await client.models.Profile.list({ limit: 100, nextToken });
    profiles.push(...(data(result) || [])); nextToken = result.nextToken;
  } while (nextToken);
  function render() {
    people.replaceChildren();
    const query = search.value.trim().toLocaleLowerCase('es');
    const unique = new Map(profiles.filter(p => p.owner && p.nickname).map(p => [p.owner.split('::')[0], p]));
    for (const [sub, profile] of [...unique].sort((a,b) => a[1].nickname.localeCompare(b[1].nickname, 'es'))) {
      if (!profile.nickname.toLocaleLowerCase('es').includes(query)) continue;
      const row = document.createElement('div'); row.className = 'badge-admin-person';
      const name = document.createElement('strong'); name.textContent = profile.nickname;
      const enabled = badges.some(item => (item.accountSub === sub || item.accountUsername === sub) && item.code === 'BETA_TESTER');
      const button = document.createElement('button'); button.type = 'button'; button.textContent = enabled ? 'Quitar Betatester' : 'Dar Betatester'; button.setAttribute('aria-pressed', String(enabled));
      button.addEventListener('click', async () => {
        button.disabled = true; notice.textContent = 'Guardando insignia…';
        try {
          data(await client.mutations.manageClubBadge({ profileId: profile.id, code: 'BETA_TESTER', enabled: !enabled }));
          await loadBadges(); render(); notice.textContent = 'Insignias actualizadas.';
          const { getCurrentUser } = await import('./auth-client.js');
          document.getElementById('profileBadges').replaceChildren(badgeElements((await getCurrentUser()).userId));
        } catch (error) { notice.textContent = error.message; button.disabled = false; }
      });
      const verified=badges.some(b=>(b.accountSub===sub || b.accountUsername===sub) && b.code==='VERIFIED');
      const verify=document.createElement('button');verify.type='button';verify.textContent=verified?'Quitar verificado':'Dar verificado';
      verify.addEventListener('click',async()=>{verify.disabled=true;try{data(await client.mutations.manageClubBadge({profileId:profile.id,code:'VERIFIED',enabled:!verified}));await loadBadges();render();notice.textContent='Verificado actualizado.';}catch(error){notice.textContent=error.message;verify.disabled=false;}});
      const phone=document.createElement('button');phone.type='button';phone.textContent='Permitir sin teléfono';
      phone.addEventListener('click',async()=>{phone.disabled=true;try{data(await client.mutations.setClubPhoneOptional({profileId:profile.id,phoneOptional:true}));notice.textContent=profile.nickname+': teléfono opcional habilitado.';phone.textContent='Excepción habilitada';}catch(error){notice.textContent=error.message;phone.disabled=false;}});
      row.append(name,badgeElements(sub),button,verify,phone);people.append(row);
    }
    if (!people.childElementCount) people.textContent = 'No hay perfiles con ese nick.';
  }
  search.addEventListener('input', render); section.hidden = false; render();
}
