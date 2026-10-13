/* Interacciones pequeñas del prototipo. Los comentarios indican dónde editar el contenido. */

// Cambiá o sumá textos aquí: cada visita muestra uno al azar en el hero de inicio.
const heroMessages = [
  { title: 'Un desafío.<br><span>Todo por demostrar.</span>', text: 'La próxima gran historia puede empezar con una partida, un reto o una apuesta entre amigos. Prepará tu mejor versión: hay algo en juego.' },
  { title: 'Venís a jugar.<br><span>Te vas con una historia.</span>', text: 'Juntá a tu gente, elegí el desafío y descubrí quién tiene lo necesario para llevarse el primer puesto.' },
  { title: 'La gloria no se regala.<br><span>Se gana en la ronda.</span>', text: 'De una partida de LoL a cualquier reto entre amigos: armá la competencia y que hablen los resultados.' },
  { title: 'Un pique amistoso.<br><span>Una victoria para recordar.</span>', text: 'Elegí cómo competir, invitá a tus amigos y poné a prueba quién se lleva el derecho a presumir.' }
];
const title = document.getElementById('heroTitle');
if (title) {
  const message = heroMessages[Math.floor(Math.random() * heroMessages.length)];
  title.innerHTML = message.title;
  document.getElementById('heroText').textContent = message.text;
}

// Modal de acceso de muestra. Aquí se conectará Google, Discord o el registro real.
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
document.querySelectorAll('[data-demo-auth]').forEach(button => button.addEventListener('click', () => showToast('El acceso real se conecta en la siguiente etapa.')));

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
