// Vista de sala independiente del motor: recibe datos y callbacks, sin AWS ni cuentas reales.
const node = (tag, text = '', cls = '') => { const n = document.createElement(tag); n.textContent = text; if (cls) n.className = cls; return n; };
const statusLabels = { confirmed: 'Confirmado', pending: 'Pendiente', declined: 'No asiste' };
function icon(kind) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('fill', 'none'); svg.setAttribute('stroke', 'currentColor'); svg.setAttribute('stroke-width', '1.7'); svg.setAttribute('stroke-linecap', 'round'); svg.setAttribute('stroke-linejoin', 'round'); svg.setAttribute('aria-hidden', 'true');
  const paths = { trophy: ['M8 3h8v6a4 4 0 0 1-8 0V3Z', 'M8 5H4v2a4 4 0 0 0 4 4m8-6h4v2a4 4 0 0 1-4 4', 'M12 13v6m-4 2h8'], clock: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z', 'M12 7v5l3 2'], shield: ['m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z', 'm8 12 3 3 5-6'], check: ['m5 12 4 4L19 6'], cross: ['m6 6 12 12M18 6 6 18'], users: ['M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z', 'M2 21v-3a7 7 0 0 1 14 0v3m0-17a4 4 0 0 1 0 8m3 9v-3a7 7 0 0 0-2-5'], edit: ['m16 3 5 5-12 12-6 1 1-6L16 3Z', 'm14 5 5 5'], bracket: ['M3 4h5v5h8m-13 11h5v-5h8M16 6v12m0-6h5'] };
  for (const d of paths[kind] || paths.users) { const path = document.createElementNS(svg.namespaceURI, 'path'); path.setAttribute('d', d); svg.append(path); }
  return svg;
}
function button(text, cls, handler, key) {
  const b = node('button', text, cls); b.type = 'button'; b.addEventListener('click', handler); if (key) b.dataset.focus = key; return b;
}
function avatar(label, seed, cls = '') {
  const a = node('span', label.trim().slice(0, 2).toUpperCase(), 'wr-avatar ' + cls); a.setAttribute('aria-hidden', 'true'); a.style.setProperty('--avatar-hue', String((seed * 57 + 185) % 360)); return a;
}
export function createWaitingRoom(root, actions) {
  let state, filter = 'all', viewer = '', toolsOpen = false, stateControls = false;
  const meta = { title: 'Copa ProveIt', reward: '', provider: '', judge: '' };
  function updateMeta() {
    // Actualizar sólo texto evita perder foco o clics al editar las opciones de la sala.
    const values = { title: meta.title || 'Copa ProveIt', reward: meta.reward || 'Sin premio definido', rewardCaption: meta.reward ? 'Premio de ejemplo' + (meta.provider ? ' · ' + meta.provider : '') : 'Podés agregar uno en las opciones de la sala', judge: meta.judge || 'Sin juez asignado', judgeCaption: meta.judge ? 'Nombre ficticio · simulación' : 'Organización de ejemplo' };
    for (const [key, value] of Object.entries(values)) { const target = root.querySelector(`[data-room-meta="${key}"]`); if (target) target.textContent = value; }
  }
  const players = () => state.groups.flatMap(group => group.players);
  const me = () => players().find(p => p.key === viewer) || players()[0];
  function updateClock() {
    const target = root.querySelector('[data-room-clock]'); if (!target || !state) return;
    const seconds = Math.max(0, Math.ceil((state.startsAt - Date.now()) / 1000));
    target.textContent = state.pending ? '—:—' : state.finished ? 'Finalizado' : state.started ? 'En curso' : `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
    const copy = root.querySelector('[data-clock-caption]');
    if (copy) copy.textContent = state.finished ? state.podiumConfirmed ? 'Podio confirmado' : 'Falta confirmar clasificación' : state.started ? 'Simulación iniciada' : seconds ? 'Inicio previsto · ejemplo' : 'Hora alcanzada · esperando confirmaciones';
  }
  function render(model) {
    state = model;
    const focus = root.contains(document.activeElement) ? document.activeElement.dataset.focus : '';
    const previousTools = root.querySelector('.wr-tools'); if (previousTools) toolsOpen = previousTools.open;
    root.replaceChildren();
    const roster = players(), self = me(); if (!self) return; viewer = self.key;
    const counts = { all: roster.length, confirmed: roster.filter(p => p.status === 'confirmed').length, pending: roster.filter(p => p.status === 'pending').length, declined: roster.filter(p => p.status === 'declined').length };
    const locked = state.pending || state.started;

    const top = node('div', '', 'wr-overview');
    const tournament = node('section', '', 'wr-glass wr-event');
    const eventIcon = node('span', '', 'wr-event-icon'); eventIcon.append(icon('trophy'));
    const eventText = node('div'), eventTitle = node('h2', meta.title || 'Copa ProveIt'); eventTitle.dataset.roomMeta = 'title'; eventText.append(eventTitle, node('p', `${state.formatName} · ${roster.length} jugadores${state.grouped ? ' · ' + state.groups.length + ' equipos' : ' · Individual'}`));
    tournament.append(eventIcon, eventText); top.append(tournament);
    const clock = node('section', '', 'wr-glass wr-clock'); clock.append(icon('clock'));
    const clockText = node('div'), digits = node('strong'); digits.dataset.roomClock = ''; digits.setAttribute('role', 'timer'); digits.setAttribute('aria-live', 'off'); const caption = node('span'); caption.dataset.clockCaption = ''; clockText.append(digits, caption); clock.append(clockText); top.append(clock);
    const prize = node('section', '', 'wr-glass wr-reward'); prize.append(icon('trophy'));
    const prizeText = node('div'), rewardValue = node('strong'), rewardCaption = node('span'); rewardValue.dataset.roomMeta = 'reward'; rewardCaption.dataset.roomMeta = 'rewardCaption'; prizeText.append(rewardValue, rewardCaption);
    prize.append(prizeText); top.append(prize); root.append(top);

    const hero = node('section', '', 'wr-glass wr-hero'); hero.setAttribute('aria-labelledby', 'waitingRoomTitle');
    const heroCopy = node('div', '', 'wr-hero-copy'); heroCopy.append(node('p', state.pending ? 'CONFIGURACIÓN PENDIENTE' : state.started ? 'SIMULACIÓN EN CURSO' : 'FASE DE CONFIRMACIÓN', 'wr-eyebrow'));
    const title = node('h1', 'Sala de espera'); title.id = 'waitingRoomTitle'; heroCopy.append(title, node('p', state.pending ? 'Aplicá una configuración válida para ver los equipos y confirmar la asistencia.' : state.finished ? 'Los encuentros terminaron. Revisá los resultados y la clasificación final.' : state.started ? 'El encuentro de ejemplo ya comenzó. Podés continuar con las llaves y los resultados.' : 'Confirmá tu asistencia para preparar el próximo desafío.'));
    if (!state.started && !state.pending) heroCopy.append(node('small', 'El reloj es orientativo en esta demo; no expulsa jugadores ni inicia automáticamente.'));
    hero.append(heroCopy);
    const ring = node('div', '', 'wr-ring'); ring.style.setProperty('--ready', `${state.pending ? 0 : counts.confirmed / Math.max(1, counts.all) * 100}%`); ring.setAttribute('role', 'img'); ring.setAttribute('aria-label', `${counts.confirmed} de ${counts.all} jugadores confirmados`);
    const ringInner = node('div'); ringInner.append(node('strong', `${state.pending ? '—' : counts.confirmed} de ${counts.all}`), node('span', 'confirmados')); ring.append(ringInner); hero.append(ring);
    const judge = node('div', '', 'wr-judge'), judgeName = node('strong'), judgeCaption = node('small'); judgeName.dataset.roomMeta = 'judge'; judgeCaption.dataset.roomMeta = 'judgeCaption'; judge.append(icon('shield'), node('span', 'Juez del torneo'), judgeName, judgeCaption); hero.append(judge); root.append(hero);

    const toolbar = node('section', '', 'wr-glass wr-toolbar'), filters = node('div', '', 'wr-filters'); filters.setAttribute('role', 'group'); filters.setAttribute('aria-label', 'Filtrar asistencia');
    for (const [key, label] of [['all', 'Todos'], ['confirmed', 'Listos'], ['pending', 'Pendientes'], ['declined', 'No asiste']]) {
      const b = button('', 'wr-filter', () => { filter = key; render(state); }, 'filter-' + key); b.setAttribute('aria-pressed', String(filter === key)); b.dataset.status = key;
      b.append(node('span', '', 'wr-dot'), node('span', label), node('b', String(counts[key]))); filters.append(b);
    } toolbar.append(filters);
    const cta = button(self.status === 'confirmed' ? 'Asistencia confirmada' : state.started ? 'Encuentro iniciado' : 'Confirmar mi asistencia', 'wr-primary wr-attend', () => actions.onStatus(viewer, 'confirmed'), 'confirm-self');
    cta.disabled = locked || self.status === 'confirmed'; cta.prepend(icon('check')); toolbar.append(cta); root.append(toolbar);

    const identity = node('div', '', 'wr-identity'); identity.append(avatar(self.name, self.index), node('span', 'Vista de jugador simulado:'), node('strong', self.name));
    if (!locked && self.status !== 'declined') identity.append(button('No podré asistir', 'wr-text-button', () => actions.onDecline(viewer), 'decline-self'));
    root.append(identity);
    if (state.pending) { const notice = node('p', 'Hay cambios pendientes. Volvé a la configuración para aplicarlos; la asistencia está bloqueada.', 'wr-warning'); notice.setAttribute('role', 'status'); notice.append(button('Revisar configuración', 'wr-text-button', actions.onConfigure)); root.append(notice); }
    if (state.notice && !state.pending) { const notice = node('p', state.notice, 'wr-notice'); notice.setAttribute('role', 'status'); root.append(notice); }

    const grid = node('section', '', 'wr-team-grid'); grid.setAttribute('aria-label', 'Equipos y participantes');
    let visible = 0;
    if (!state.pending) for (const group of state.groups) {
      const entries = group.players.filter(p => filter === 'all' || p.status === filter); if (!entries.length) continue; visible += entries.length;
      const card = node('section', '', 'wr-glass wr-team');
      const heading = node('header', '', 'wr-team-heading'); heading.append(icon('users'));
      const teamTitle = node('h2', group.name); heading.append(teamTitle);
      if (state.grouped) { const edit = button('', 'wr-icon-button', () => actions.onEditTeam(group.id), 'edit-' + group.id); edit.append(icon('edit')); edit.setAttribute('aria-label', 'Editar nombre de ' + group.name); heading.append(edit); }
      heading.append(node('span', `${group.players.filter(p => p.status === 'confirmed').length}/${group.players.length} confirmados`, 'wr-team-count')); card.append(heading);
      const list = node('ul', '', state.grouped ? 'wr-roster' : 'wr-roster wr-individual-roster');
      for (const player of entries) {
        const row = node('li', '', 'wr-player'); row.dataset.status = player.status;
        row.append(avatar(player.name, player.index, player.key === viewer ? 'wr-avatar-self' : ''));
        const info = node('div', '', 'wr-player-info'), nameLine = node('div', '', 'wr-player-name'); nameLine.append(node('strong', player.name));
        if (player.key === viewer) nameLine.append(node('span', 'Vos', 'wr-you'));
        info.append(nameLine, node('small', 'Jugador ficticio · Sin liga')); row.append(info);
        if (stateControls) {
          const select = node('select', '', 'wr-status-select'); select.dataset.focus = 'status-' + player.key; select.setAttribute('aria-label', 'Estado simulado de ' + player.name); select.dataset.status = player.status;
          for (const [value, label] of Object.entries(statusLabels)) { const option = node('option', label); option.value = value; select.append(option); } select.value = player.status; select.disabled = locked;
          select.addEventListener('change', () => actions.onStatus(player.key, select.value)); row.append(select);
        } else {
          const status = node('span', '', 'wr-status'); status.dataset.status = player.status; status.append(icon(player.status === 'confirmed' ? 'check' : player.status === 'declined' ? 'cross' : 'clock'), node('span', statusLabels[player.status])); row.append(status);
        }
        list.append(row);
      } card.append(list); grid.append(card);
    }
    if (!visible && !state.pending) grid.append(node('p', 'No hay jugadores con ese estado.', 'wr-glass wr-empty'));
    root.append(grid);

    const next = node('section', '', 'wr-glass wr-next'); next.append(icon('bracket'));
    const nextText = node('div'); nextText.append(node('strong', state.started ? 'El desafío ya está en marcha' : counts.confirmed === counts.all ? 'Todos listos para el próximo desafío' : 'Las confirmaciones preparan el encuentro'), node('p', state.started ? 'Continuá con las llaves para registrar y confirmar los resultados ficticios.' : 'Los nombres de los equipos también aparecen en las llaves. Iniciar requiere que todos confirmen.')); next.append(nextText);
    const bracket = button(state.started ? 'Ver llaves y resultados ↗' : 'Ver modelo de llaves ↗', 'wr-secondary', actions.onResults, 'results'); bracket.disabled = state.pending; next.append(bracket); root.append(next);

    const tools = node('details', '', 'wr-glass wr-tools'); tools.open = toolsOpen; tools.append(node('summary', 'Opciones de la sala y controles de simulación'));
    const controls = node('div', '', 'wr-tools-content'); controls.append(node('p', 'Estos controles sólo cambian esta prueba local. No envían invitaciones, no crean cuentas y no hay premios reales.', 'wr-tools-copy'));
    const fields = node('div', '', 'wr-meta-fields');
    for (const [key, label, placeholder] of [['title', 'Nombre del torneo de ejemplo', 'Copa ProveIt'], ['reward', 'Premio de ejemplo (opcional)', '$50.000 ARS'], ['provider', 'Quién lo aportaría (opcional)', 'Nombre del patrocinador'], ['judge', 'Nombre de juez ficticio (opcional)', 'Sin juez asignado']]) {
      const field = node('label', label); const input = node('input'); input.type = 'text'; input.maxLength = 100; input.value = meta[key]; input.placeholder = placeholder; input.dataset.focus = 'meta-' + key;
      input.addEventListener('input', () => { meta[key] = input.value.trim().slice(0, 100); updateMeta(); }); field.append(input); fields.append(field);
    } controls.append(fields);
    const viewerField = node('label', 'Jugador desde el que mirás la sala'); const viewSelect = node('select'); viewSelect.dataset.focus = 'viewer';
    for (const group of state.groups) for (const player of group.players) { const option = node('option', player.name + (state.grouped ? ' · ' + group.name : '')); option.value = player.key; viewSelect.append(option); }
    viewSelect.value = viewer; viewSelect.addEventListener('change', () => { viewer = viewSelect.value; render(state); }); viewerField.append(viewSelect); controls.append(viewerField);
    const controlLabel = node('label', '', 'wr-check-label'), check = node('input'); check.type = 'checkbox'; check.checked = stateControls; check.dataset.focus = 'state-controls';
    check.addEventListener('change', () => { stateControls = check.checked; render(state); }); controlLabel.append(check, node('span', 'Mostrar selector de estado en cada jugador')); controls.append(controlLabel);
    const buttons = node('div', '', 'wr-tool-actions');
    for (const [label, action, disabled] of [['Confirmar siguiente jugador', actions.onConfirmNext, locked || counts.pending === 0], ['Confirmar a todos', actions.onConfirmAll, locked || counts.confirmed === counts.all], ['Iniciar simulación ↗', actions.onStart, locked || counts.confirmed !== counts.all], ['Editar equipos y formato', actions.onConfigure, false]]) {
      const b = button(label, label.startsWith('Iniciar') ? 'wr-primary' : 'wr-secondary', action); b.disabled = disabled; buttons.append(b);
    } controls.append(buttons); tools.append(controls); root.append(tools);
    root.append(node('p', 'SIMULACIÓN LOCAL · Las cuentas, los premios y los cambios de esta sala no son reales. Los datos se pierden al recargar.', 'wr-footnote'));
    updateMeta(); updateClock();
    if (focus) { const target = [...root.querySelectorAll('[data-focus]')].find(n => n.dataset.focus === focus); target?.focus({ preventScroll: true }); }
  }
  return { render, updateClock };
}
