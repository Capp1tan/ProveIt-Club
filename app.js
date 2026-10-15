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
    const matches = tournaments.filter(item => (item.name + ' ' + item.activity).toLocaleLowerCase('es').includes(query.toLocaleLowerCase('es')));
    searchResults.replaceChildren();
    for (const item of matches) {
      const link = document.createElement('a'); link.className = 'result-item'; link.href = '/torneo.html?id=' + encodeURIComponent(item.id);
      const name = document.createElement('b'); name.textContent = item.name;
      const activity = document.createElement('small'); activity.textContent = item.activity;
      link.append(name,activity); searchResults.append(link);
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
  searchPanel.hidden = false;
  if (searchInput) { searchInput.value = query; renderResults(query); searchInput.focus(); }
}
function closeSearchPanel() { if (searchPanel) searchPanel.hidden = true; }
document.getElementById('searchToggle')?.addEventListener('click', () => openSearchPanel());
document.getElementById('closeSearch')?.addEventListener('click', closeSearchPanel);
searchInput?.addEventListener('input', event => renderResults(event.target.value));
document.querySelectorAll('[data-query]').forEach(button => button.addEventListener('click', () => openSearchPanel(button.dataset.query)));


