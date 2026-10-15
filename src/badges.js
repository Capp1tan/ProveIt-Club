import { profileClient } from './auth-client.js';
let badges = [];
let accessPromise;
function data(result) {
  if (result.errors?.length) throw new Error(result.errors.map(error => error.message).join(' '));
  return result.data;
}
export function initializeAccess() {
  if (!accessPromise) accessPromise = profileClient().then(client => client.mutations.initializeClubAccess()).then(data).catch(error => { accessPromise = undefined; throw error; });
  return accessPromise;
}
export async function loadBadges() {
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
    const text = { CREATOR: '★ Creador', BETA_TESTER: '✦ Betatester' }[badge.code];
    if (!text) continue;
    const node = document.createElement('span'); node.className = 'club-badge'; node.dataset.code = badge.code; node.textContent = text;
    wrapper.append(node);
  }
  return wrapper;
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
      row.append(name, badgeElements(sub), button); people.append(row);
    }
    if (!people.childElementCount) people.textContent = 'No hay perfiles con ese nick.';
  }
  search.addEventListener('input', render); section.hidden = false; render();
}
