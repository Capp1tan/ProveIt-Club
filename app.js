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
// Catálogo ficticio de ejemplo para mostrar cómo se comportaría la búsqueda.
const sampleTournaments = [
  { name: 'LoL 1v1 — Round Robin', category: 'Videojuegos', status: 'Inscripciones abiertas' },
  { name: 'Copa de penales del viernes', category: 'Deportes', status: 'Próximamente' },
  { name: 'Trivia relámpago: cultura pop', category: 'Trivia', status: 'Inscripciones abiertas' },
  { name: 'Reto de la hamburguesa', category: 'Retos', status: 'Borrador de ejemplo' }
];
const searchPanel = document.getElementById('searchPanel');
const searchInput = document.getElementById('tournamentSearch');
const searchResults = document.getElementById('searchResults');
function renderResults(query = '') {
  if (!searchResults) return;
  const matches = sampleTournaments.filter(item => `${item.name} ${item.category}`.toLowerCase().includes(query.toLowerCase()));
  searchResults.innerHTML = matches.length
    ? matches.map(item => `<div class="result-item"><span><b>${item.name}</b><small>${item.category}</small></span><em>${item.status}</em></div>`).join('')
    : '<p class="muted">No encontramos torneos con ese nombre.</p>';
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

// En la página de creación, la selección visual se guarda hasta abrir el modal de acceso.
let selectedFormat = 'Round Robin';
document.querySelectorAll('[data-format]').forEach(card => card.addEventListener('click', () => {
  document.querySelectorAll('[data-format]').forEach(item => item.classList.remove('selected'));
  card.classList.add('selected');
  selectedFormat = card.dataset.format;
}));
document.getElementById('continueCreate')?.addEventListener('click', () => {
  const formatName = document.getElementById('selectedFormatName');
  if (formatName) formatName.textContent = selectedFormat;
  showModal();
});

