/* Interacciones pequeñas del prototipo. Los comentarios indican dónde editar el contenido. */

// El título y la descripción se editan en index.html; permanecen iguales al recargar.

// Apertura del modal de acceso; src/auth-ui.js atiende Google y los formularios de email.
const modal = document.getElementById('loginModal');
const showModal = () => { if (modal) { modal.hidden = false; document.body.classList.add('modal-open'); } };
const hideModal = () => { if (modal) { modal.hidden = true; document.body.classList.remove('modal-open'); } };
document.querySelectorAll('[data-login]').forEach(button => button.addEventListener('click', showModal));
document.getElementById('closeLogin')?.addEventListener('click', hideModal);
modal?.addEventListener('click', event => { if (event.target === modal) hideModal(); });
document.addEventListener('keydown', event => { if (event.key === 'Escape') { hideModal(); closeSearchPanel(); } });

// Aviso visible para que quede claro que estos botones todavía son una maqueta.
let toastTimer;
function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('visible'), 2800);
}
// La búsqueda consulta torneos guardados sólo al abrirse, sin cargar datos en el inicio.
let tournamentCatalog;
let searchRequest = 0;
const searchPanel = document.getElementById('searchPanel');
const searchInput = document.getElementById('tournamentSearch');
const searchResults = document.getElementById('searchResults');
// Historial local y descartes de sugerencias: nunca borran torneos de otra persona.
const recentKey='proveit:recent-searches',hiddenKey='proveit:hidden-search-suggestions';
let recentSearches=[],hiddenSuggestions=[];
try {recentSearches=JSON.parse(localStorage.getItem(recentKey)||'[]');hiddenSuggestions=JSON.parse(localStorage.getItem(hiddenKey)||'[]');}catch{}
if(!Array.isArray(recentSearches))recentSearches=[];
recentSearches=recentSearches.filter(x=>x && typeof x.label==='string' && typeof x.query==='string').slice(0,12);
if(!Array.isArray(hiddenSuggestions))hiddenSuggestions=[];
function storeSearches(){try{localStorage.setItem(recentKey,JSON.stringify(recentSearches));localStorage.setItem(hiddenKey,JSON.stringify(hiddenSuggestions.slice(-200)));}catch{}}
function rememberSearch(query,item){
  query=query.trim();if(!query && !item)return;
  const entry={query,label:item?.name || query,id:item?.id || null};
  recentSearches=[entry,...recentSearches.filter(x=>x.id!==entry.id || x.query!==entry.query)].slice(0,12);storeSearches();renderRecentSearches();
}
function renderRecentSearches(){
  const target=document.getElementById('recentSearches');if(!target)return;target.replaceChildren();
  if(!recentSearches.length)return;
  const heading=document.createElement('strong');heading.textContent='Búsquedas recientes';target.append(heading);
  recentSearches.forEach((entry,index)=>{
    const row=document.createElement('div');row.className='search-history-row';
    const open=document.createElement('button');open.type='button';open.textContent=entry.label;
    open.addEventListener('click',()=>{openSearchPanel(entry.query || entry.label);});
    const remove=document.createElement('button');remove.type='button';remove.textContent='×';remove.setAttribute('aria-label','Eliminar búsqueda '+entry.label);
    remove.addEventListener('click',()=>{recentSearches.splice(index,1);storeSearches();renderRecentSearches();});row.append(open,remove);target.append(row);
  });
}
async function renderResults(query = '') {
  if (!searchResults) return;
  const request = ++searchRequest;
  searchResults.textContent = 'Buscando torneos…';
  try {
    if (!tournamentCatalog) {
      tournamentCatalog = import('./src/tournaments-api.js').then(api => api.listClubTournaments());
      tournamentCatalog.catch(() => { tournamentCatalog = undefined; });
    }
    const tournaments = await tournamentCatalog;
    if (request !== searchRequest) return;
    const liveIds=new Set(tournaments.map(t=>t.id));
    recentSearches=recentSearches.filter(entry=>!entry.id || liveIds.has(entry.id));storeSearches();renderRecentSearches();
    const matches = tournaments.filter(item => !hiddenSuggestions.includes(item.id) && (item.name + ' ' + item.activity).toLocaleLowerCase('es').includes(query.toLocaleLowerCase('es')));
    searchResults.replaceChildren();
    for (const item of matches) {
      const link = document.createElement('a'); link.className = 'result-item'; link.href = '/torneo.html?id=' + encodeURIComponent(item.id);
      const name = document.createElement('b'); name.textContent = item.name;
      const activity = document.createElement('small'); activity.textContent = item.activity;
      link.addEventListener('click',()=>rememberSearch(query,item));
      const row=document.createElement('div');row.className='search-suggestion-row';
      const remove=document.createElement('button');remove.type='button';remove.textContent='×';remove.setAttribute('aria-label','Ocultar sugerencia '+item.name);remove.title='Ocultar sugerencia en este navegador';
      remove.addEventListener('click',()=>{hiddenSuggestions.push(item.id);recentSearches=recentSearches.filter(entry=>entry.id!==item.id);storeSearches();renderRecentSearches();void renderResults(searchInput.value);});
      link.append(name,activity);row.append(link,remove);searchResults.append(row);
    }
    if (!matches.length) searchResults.textContent = 'No encontramos torneos con ese nombre.';
  } catch {
    if (request === searchRequest) {
      searchResults.textContent = 'Ingresá con tu cuenta para buscar torneos. ';
      const link = document.createElement('a'); link.href = '/torneos.html'; link.textContent = 'Ver torneos del club'; searchResults.append(link);
    }
  }
}
function openSearchPanel(query = '') {
  if (!searchPanel) return;
  tournamentCatalog=undefined;
  searchPanel.hidden = false;
  renderRecentSearches();
  if (searchInput) { searchInput.value = query; renderResults(query); searchInput.focus(); }
}
function closeSearchPanel() { if (searchPanel) searchPanel.hidden = true; }
document.getElementById('searchToggle')?.addEventListener('click', () => openSearchPanel());
document.getElementById('closeSearch')?.addEventListener('click', closeSearchPanel);
searchInput?.addEventListener('input', event => renderResults(event.target.value));
searchInput?.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();rememberSearch(searchInput.value);}});
document.getElementById('clearRecentSearches')?.addEventListener('click',()=>{recentSearches=[];storeSearches();renderRecentSearches();searchInput.value='';void renderResults('');});
document.getElementById('resetSearchSuggestions')?.addEventListener('click',()=>{hiddenSuggestions=[];storeSearches();void renderResults(searchInput.value);});
window.addEventListener('proveit:tournament-deleted',()=>{tournamentCatalog=undefined;recentSearches=[];storeSearches();renderRecentSearches();if(searchPanel && !searchPanel.hidden)void renderResults(searchInput.value);});
document.querySelectorAll('[data-query]').forEach(button => button.addEventListener('click', () => openSearchPanel(button.dataset.query)));

