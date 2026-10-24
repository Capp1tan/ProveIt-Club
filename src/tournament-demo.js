// Laboratorio enteramente local. No importa clientes AWS, pagos, cuentas ni notificaciones.
import { formats } from './tournament-formats.js';

const $ = id => document.getElementById(id);
const el = (tag, text = '', cls) => { const n = document.createElement(tag); n.textContent = text; if (cls) n.className = cls; return n; };
const MAX_PLAYERS = 64;
const bank = Array.from({ length: MAX_PLAYERS }, (_, i) => ({
  id: 'demo-' + (i + 1), name: 'Equipo ' + (i + 1), solo: 'Bot ' + String(i + 1).padStart(2, '0'),
  members: Array.from({ length: MAX_PLAYERS }, (_, j) => 'Bot ' + (i + 1) + '.' + (j + 1)), confirmed: false,
}));
let totalPlayers = 4, count = 4, teamSize = 1, format = 'SINGLE_ELIMINATION', rounds = [], matches = new Map(), order = [];
let started = false, startsAt = Date.now() + 5 * 60 * 1000, hasReset = false;
let custom = false, customSizes = [4, 1], places = 2, confirmedPodium = null, rules = '', lastConfig = null;
let dialogPending = false, audit = [], podiumDraft = [], podiumReason = '';
const active = () => bank.slice(0, count);
const grouped = () => custom || teamSize > 1;
const entrySize = p => custom ? customSizes[bank.indexOf(p)] : teamSize;
const duelLabel = () => custom ? customSizes.join('v') : `${teamSize}v${teamSize}`;
const name = p => p ? grouped() ? p.name : p.solo : 'Pase libre';
const allConfirmed = () => active().every(p => p.confirmed);
const isFinished = () => matches.size > 0 && [...matches.values()].every(m => m.done);
const canPlay = () => allConfirmed() && started && !isFinished() && !confirmedPodium;
const announce = text => { $('demoNotice').textContent = text; };

// Diálogo modal: cancelar es la opción inicial; Escape también cancela. Nunca guarda al seleccionar un nombre.
function confirmAction(title, body, label = 'Confirmar resultado') {
  if (dialogPending) return Promise.resolve(false);
  dialogPending = true;
  $('demoConfirmTitle').textContent = title; $('demoConfirmBody').textContent = body; $('demoAcceptAction').textContent = label;
  const dialog = $('demoConfirmDialog'); dialog.returnValue = '';
  return new Promise(resolve => {
    dialog.addEventListener('close', () => { dialogPending = false; resolve(dialog.returnValue === 'confirmed'); }, { once: true });
    dialog.showModal(); $('demoCancelAction').focus();
  });
}
$('demoCancelAction').addEventListener('click', () => $('demoConfirmDialog').close('cancelled'));
$('demoAcceptAction').addEventListener('click', () => $('demoConfirmDialog').close('confirmed'));
function logResult(text) { audit.push({ text, at: new Date().toLocaleTimeString('es-AR') }); }

const params = new URLSearchParams(location.search);
if (formats.some(f => f.id === params.get('format'))) format = params.get('format');
// «count» mantiene compatibles los enlaces anteriores (individuales).
const fromCount = Number(params.get('total') ?? params.get('count'));
if (Number.isInteger(fromCount) && fromCount >= 2 && fromCount <= MAX_PLAYERS) totalPlayers = fromCount;
const fromTeam = Number(params.get('teamSize'));
if (Number.isInteger(fromTeam) && fromTeam >= 1 && totalPlayers % fromTeam === 0 && totalPlayers / fromTeam >= 2) teamSize = fromTeam;

function syncTeamSizes(requested) {
  const sizes = Array.from({ length: Math.floor(totalPlayers / 2) }, (_, i) => i + 1).filter(size => totalPlayers % size === 0);
  teamSize = sizes.includes(requested) ? requested : 1;
  $('demoTeamSize').replaceChildren();
  for (const size of sizes) {
    const option = el('option', size === 1 ? 'Individual · 1 jugador' : `${size} por equipo · ${totalPlayers / size} equipos · ${size}v${size}`);
    option.value = String(size); $('demoTeamSize').append(option);
  }
  $('demoTeamSize').value = String(teamSize); count = totalPlayers / teamSize;
  return teamSize !== requested;
}
function syncFormats(requested) {
  // El tamaño de la llave depende de equipos (o individuos), nunca del total de integrantes.
  const available = formats.filter(f => f.id === 'DUEL' ? count === 2 : f.id === 'SWISS' || f.id === 'FREE_FOR_ALL' ? count >= 3 : true);
  format = available.some(f => f.id === requested) ? requested : count === 2 ? 'DUEL' : 'SINGLE_ELIMINATION';
  $('demoFormat').replaceChildren();
  for (const f of available) {
    const option = el('option', f.id === 'DUEL' ? `Enfrentamiento directo · ${duelLabel()}` : f.name);
    option.value = f.id; $('demoFormat').append(option);
  }
  $('demoFormat').value = format;
  const units = grouped() ? 'equipos' : 'jugadores individuales';
  $('demoAvailableHelp').textContent = `Formatos para ${count} ${units}. ` + (count === 2 ? 'Un enfrentamiento directo o una final; doble eliminación permite revancha.' : 'Con un número impar, algunas rondas pueden incluir descansos o pases libres.') + ' Suizo y prueba compartida se muestran desde tres rivales.';
}

function ref(id) { return { entryId: id }; }
function source(id, outcome = 'winner') { return { source: id, outcome }; }
function resolve(slot) {
  if (!slot) return null;
  if (slot.entryId) return bank.find(p => p.id === slot.entryId) || null;
  const m = matches.get(slot.source);
  if (!m?.done) return undefined;
  return bank.find(p => p.id === (slot.outcome === 'loser' ? m.loserId : m.winnerId)) || null;
}
function addRound(title, group, items) {
  rounds.push({ title, group, items }); items.forEach(m => matches.set(m.id, m)); return items;
}
function pairs(slots, prefix) {
  const result = [];
  for (let i = 0; i < slots.length; i += 2) result.push({ id: prefix + '-' + (i / 2 + 1), left: slots[i], right: slots[i + 1] || null });
  return result;
}
function matchPlayers(m) {
  return m.entrants ? m.entrants.map(resolve) : [resolve(m.left), resolve(m.right)];
}
function settleByes() {
  // undefined = depende de un resultado; null = descanso real. Nunca son lo mismo.
  for (let pass = 0; pass < matches.size + 1; pass++) {
    let changed = false;
    for (const m of matches.values()) {
      if (m.done || m.entrants) continue;
      const players = matchPlayers(m);
      if (players.some(p => p === undefined)) continue;
      if (players.filter(Boolean).length < 2) {
        m.done = true; m.auto = true; m.winnerId = players.find(Boolean)?.id || null; m.loserId = null; changed = true;
      }
    }
    if (!changed) break;
  }
}
function buildDraw(shuffle = false) {
  rounds = []; matches = new Map(); hasReset = false;
  order = active().map(p => p.id);
  if (shuffle) for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  const players = order.map(ref);
  if (format === 'ROUND_ROBIN') {
    const circle = [...players]; if (circle.length % 2) circle.push(null);
    for (let r = 0; r < circle.length - 1; r++) {
      const items = circle.slice(0, circle.length / 2).map((p, i) => ({ id: 'rr' + (r + 1) + '-' + (i + 1), left: p, right: circle[circle.length - 1 - i] }));
      addRound('Ronda ' + (r + 1), 'Todos contra todos', items); circle.splice(1, 0, circle.pop());
    }
  } else if (format === 'FREE_FOR_ALL') {
    addRound('Prueba compartida', 'Todos participan', [{ id: 'ffa', entrants: players }]);
  } else if (format === 'DUEL' || format === 'SWISS') {
    addRound(format === 'DUEL' ? `Encuentro ${duelLabel()}` : 'Primera ronda', 'Cruces de prueba', pairs(players, 'r1'));
  } else {
    let size = 2; while (size < count) size *= 2;
    const slots = [], byes = size - count; let p = 0;
    for (let i = 0; i < size / 2; i++) slots.push(players[p++], i < byes ? null : players[p++]);
    let current = slots; const upper = [];
    for (let r = 1; current.length > 1; r++) {
      const items = pairs(current, 'w' + r); upper.push(items);
      addRound(current.length === 2 ? 'Final' : 'Ronda ' + r, format === 'DOUBLE_ELIMINATION' ? 'Ganadores' : 'Eliminación directa', items);
      current = items.map(m => source(m.id));
    }
    if (format === 'DOUBLE_ELIMINATION') {
      let lower = [], lowerRound = 1;
      if (upper.length > 1) {
        lower = pairs(upper[0].map(m => source(m.id, 'loser')), 'l' + lowerRound);
        addRound('Ronda ' + lowerRound++, 'Perdedores', lower);
        for (let u = 1; u < upper.length; u++) {
          if (u > 1) {
            lower = pairs(lower.map(m => source(m.id)), 'l' + lowerRound);
            addRound('Ronda ' + lowerRound++, 'Perdedores', lower);
          }
          const losers = upper[u].map(m => source(m.id, 'loser')).reverse();
          lower = lower.map((m, i) => ({ id: 'l' + lowerRound + '-' + (i + 1), left: source(m.id), right: losers[i] }));
          addRound('Ronda ' + lowerRound++, 'Perdedores', lower);
        }
      }
      const final = upper.at(-1)[0];
      addRound('Gran final', 'Final', [{ id: 'gf', left: source(final.id), right: lower.length ? source(lower[0].id) : source(final.id, 'loser') }]);
    } else if (places === 3 && count >= 3) {
      const semis = upper.at(-2);
      addRound('Por el tercer puesto', 'Podio', [{ id: 'bronze', left: source(semis[0].id, 'loser'), right: source(semis[1].id, 'loser') }]);
    }
  }
  settleByes();
}

function renderEditors() {
  $('demoEntrants').replaceChildren();
  for (const [i, entry] of active().entries()) {
    const row = el('section', '', 'demo-entrant'); row.dataset.confirmed = String(entry.confirmed);
    const heading = el('div', '', 'demo-entry-heading'), check = el('input'); check.type = 'checkbox'; check.checked = entry.confirmed;
    check.id = 'demo-confirm-' + i; const label = el('label', (grouped() ? 'Equipo ' : 'Jugador ') + (i + 1)); label.htmlFor = check.id;
    const status = el('span', entry.confirmed ? 'Confirmado' : 'Pendiente', 'demo-status');
    check.addEventListener('change', () => { entry.confirmed = check.checked; row.dataset.confirmed = String(entry.confirmed); status.textContent = entry.confirmed ? 'Confirmado' : 'Pendiente'; render(); });
    heading.append(check, label, status); row.append(heading);
    const input = el('input'); input.maxLength = 40; input.value = name(entry); input.setAttribute('aria-label', (grouped() ? 'Nombre del equipo ' : 'Nombre del jugador ') + (i + 1));
    input.addEventListener('input', () => { const value = input.value.trim().slice(0, 40); if (!grouped()) entry.solo = value || 'Bot ' + (i + 1); else entry.name = value || 'Equipo ' + (i + 1); render(); }); row.append(input);
    if (grouped()) {
      const members = el('details', '', 'demo-member-editor'); members.append(el('summary', 'Editar los ' + entrySize(entry) + ' integrantes'));
      for (let j = 0; j < entrySize(entry); j++) {
        const member = el('input'); member.maxLength = 40; member.value = entry.members[j]; member.id = 'demo-member-' + i + '-' + j;
        const memberLabel = el('label', 'Jugador ' + (j + 1)); memberLabel.htmlFor = member.id;
        member.addEventListener('input', () => { entry.members[j] = member.value.trim().slice(0, 40) || 'Bot ' + (i + 1) + '.' + (j + 1); render(); });
        members.append(memberLabel, member);
      } row.append(members);
    }
    $('demoEntrants').append(row);
  }
}
function pickWinner(m, entry) {
  if (!canPlay() || m.done) return;
  const players = matchPlayers(m);
  if (players.some(p => p === undefined) || !players.some(p => p?.id === entry.id)) return;
  m.done = true; m.winnerId = entry.id; m.loserId = players.find(p => p && p.id !== entry.id)?.id || null;
  // En doble eliminación, una victoria de la llave inferior reinicia la final.
  if (format === 'DOUBLE_ELIMINATION' && m.id === 'gf' && resolve(m.right)?.id === entry.id && !hasReset) {
    hasReset = true; addRound('Final de desempate', 'Reinicio de gran final', [{ id: 'gf-reset', left: source(m.id), right: source(m.id, 'loser') }]);
  }
  settleByes();
}
function impactedBy(id) {
  const affected = new Set([id]); let changed;
  do {
    changed = false;
    for (const m of matches.values()) if (!affected.has(m.id) && [m.left, m.right, ...(m.entrants || [])].some(s => s?.source && affected.has(s.source))) {
      affected.add(m.id); changed = true;
    }
  } while (changed);
  return affected;
}
async function chooseWinner(m, entry) {
  if (!allConfirmed() || !started || m.auto || format === 'FREE_FOR_ALL') return;
  const players = matchPlayers(m);
  if (players.some(p => p === undefined) || !players.some(p => p?.id === entry.id)) return;
  if (m.done && m.winnerId === entry.id) { announce('Ese resultado ya está registrado. Elegí al otro rival para corregirlo.'); return; }
  const affected = impactedBy(m.id);
  const later = [...matches.values()].filter(other => other.id !== m.id && affected.has(other.id) && other.done && !other.auto);
  const body = m.done
    ? `Cambiar ganador de ${m.id}: ${name(bank.find(p => p.id === m.winnerId))} → ${name(entry)}. ` + (later.length ? `Se anularán los resultados dependientes: ${later.map(other => other.id).join(', ')}. ` : 'No hay resultados posteriores jugados que dependan de este encuentro. ') + (confirmedPodium ? 'El podio confirmado se reabrirá. ' : '')
    : `¿Confirmás que ${name(entry)} ganó este encuentro contra ${players.filter(p => p && p.id !== entry.id).map(name).join(', ')}? ` + (m.id === 'bronze' ? 'Este resultado define el tercer puesto.' : 'Se actualizará la llave de este encuentro; no significa necesariamente ganar todo el torneo.');
  if (!await confirmAction(m.done ? 'Corregir resultado' : 'Confirmar ganador del encuentro', body, m.done ? 'Confirmar corrección' : 'Confirmar victoria')) return;
  if (m.done) {
    if (affected.has('gf') && matches.has('gf-reset')) {
      rounds = rounds.filter(round => !round.items.some(other => other.id === 'gf-reset')); matches.delete('gf-reset'); hasReset = false;
    }
    for (const id of affected) {
      const other = matches.get(id); if (!other) continue;
      delete other.done; delete other.auto; delete other.winnerId; delete other.loserId;
    }
  }
  confirmedPodium = null; podiumDraft = []; podiumReason = '';
  pickWinner(m, entry); logResult(`${m.id}: victoria de ${name(entry)}${later.length ? '; anulados: ' + later.map(other => other.id).join(', ') : ''}.`);
  announce('Resultado ficticio confirmado para ' + name(entry) + '.'); render();
}
function slotLabel(slot) {
  if (!slot) return 'Descanso / pase libre';
  const entry = resolve(slot);
  if (entry) return name(entry);
  if (entry === null) return 'Descanso / pase libre';
  return (slot.outcome === 'loser' ? 'Perdedor de ' : 'Ganador de ') + slot.source;
}
function renderBoard() {
  $('demoBoard').replaceChildren();
  // Round Robin completo puede tener 2.016 encuentros: dibujar una ronda evita saturar la página.
  const visibleRounds = format === 'ROUND_ROBIN' ? [rounds[Number($('demoRound').value) || 0]] : rounds;
  for (const round of visibleRounds) {
    const column = el('section', '', 'demo-round'); column.append(el('h3', round.group + ' · ' + round.title));
    const stack = el('div', '', 'demo-matches'); column.append(stack);
    for (const m of round.items) {
      const card = el('article', '', 'demo-match'); card.setAttribute('aria-label', 'Encuentro ' + m.id);
      card.append(el('small', m.id + (m.auto ? ' · Pase libre' : m.done ? ' · Resultado simulado' : '')));
      const slots = m.entrants || [m.left, m.right], players = matchPlayers(m);
      for (const slot of slots) {
        const entry = resolve(slot), button = el('button', '', 'demo-team-slot'); button.type = 'button';
        button.disabled = !allConfirmed() || !started || m.auto || !entry || players.some(p => p === undefined) || format === 'FREE_FOR_ALL' || (!m.done && !canPlay());
        const content = el('span', '', 'demo-team-info'); content.append(el('strong', slotLabel(slot), entry ? '' : 'demo-unknown'));
        if (entry && grouped()) content.append(el('small', `${entrySize(entry)} integrante${entrySize(entry) === 1 ? '' : 's'} · ` + entry.members.slice(0, entrySize(entry)).join(' · ')));
        button.append(content); button.setAttribute('aria-label', `${m.done ? 'Revisar resultado de' : 'Dar victoria ficticia a'} ${slotLabel(slot)} en ${m.id}`);
        if (entry && m.done && m.winnerId === entry.id) { button.dataset.winner = 'true'; button.append(el('span', '✓', 'demo-win-mark')); }
        if (entry) button.addEventListener('click', () => void chooseWinner(m, entry));
        card.append(button);
      } stack.append(card);
    } $('demoBoard').append(column);
  }
}
function scoresSorted() {
  const scores = new Map(active().map(p => [p.id, { p, played: 0, wins: 0, losses: 0 }]));
  for (const m of matches.values()) if (m.done && !m.auto && m.winnerId) {
    for (const p of matchPlayers(m).filter(Boolean)) {
      const row = scores.get(p.id); if (!row) continue; row.played++; if (p.id === m.winnerId) row.wins++; else row.losses++;
    }
  }
  return [...scores.values()].sort((a, b) => b.wins - a.wins || a.losses - b.losses || name(a.p).localeCompare(name(b.p), 'es'));
}
function renderStandings() {
  const sorted = scoresSorted();
  const root = $('demoStandings'); root.replaceChildren();
  if (isFinished()) {
    root.append(el('p', format === 'SWISS' ? 'Primera ronda terminada · no determina el podio del torneo.' : confirmedPodium ? 'Clasificación final confirmada.' : 'Encuentros terminados · revisá y confirmá el podio.', 'demo-champion'));
  }
  root.append(el('h3', 'Resultados de esta prueba'));
  const wrap = el('div', '', 'demo-table-wrap'), table = el('table'), head = el('thead'), row = el('tr');
  for (const text of [grouped() ? 'Equipo' : 'Jugador', 'Jugados', 'Ganados', 'Perdidos']) row.append(el('th', text)); head.append(row); table.append(head);
  const body = el('tbody');
  for (const score of sorted) { const r = el('tr'); [name(score.p), score.played, score.wins, score.losses].forEach(value => r.append(el('td', String(value)))); body.append(r); }
  table.append(body); wrap.append(table); root.append(wrap);
}

// Cada puesto tiene candidatos permitidos por el formato. Nunca se ordena un empate por nombre.
function podiumOptions() {
  if (format === 'SWISS' || !allConfirmed() || !started) return null;
  if (format === 'FREE_FOR_ALL') return Array.from({ length: places }, () => active());
  if (!isFinished()) return null;
  if (format === 'ROUND_ROBIN') {
    const sorted = scoresSorted();
    return Array.from({ length: places }, (_, i) => sorted.filter(row => row.wins === sorted[i].wins).map(row => row.p));
  }
  const finalId = format === 'DUEL' ? 'r1-1' : format === 'DOUBLE_ELIMINATION' ? hasReset ? 'gf-reset' : 'gf' : `w${Math.ceil(Math.log2(count))}-1`;
  const final = matches.get(finalId);
  const ids = [final.winnerId, final.loserId];
  if (places === 3) {
    const bronze = matches.get('bronze');
    const lowerFinal = rounds.filter(round => round.group === 'Perdedores').at(-1)?.items[0];
    ids.push(bronze?.winnerId || lowerFinal?.loserId);
  }
  return ids.slice(0, places).map(id => active().filter(p => p.id === id));
}
function renderPodium() {
  const root = $('demoPodiumContent'); root.replaceChildren();
  if (confirmedPodium) {
    const list = el('ol', '', 'demo-podium-list');
    confirmedPodium.forEach((id, i) => list.append(el('li', `${['🥇', '🥈', '🥉'][i]} ${i + 1}. ${name(bank.find(p => p.id === id))}`)));
    root.append(list, el('p', 'Puestos confirmados para esta prueba. No asignan premios ni puntos reales.', 'editorial-help'));
    if (podiumReason) root.append(el('p', 'Criterio de desempate: ' + podiumReason, 'editorial-help'));
    const reopen = el('button', 'Reabrir clasificación', 'editorial-secondary'); reopen.type = 'button';
    reopen.addEventListener('click', async () => {
      if (await confirmAction('Reabrir clasificación', 'El podio dejará de estar confirmado hasta que vuelvas a revisarlo. Los encuentros se conservan.', 'Reabrir')) {
        podiumDraft = [...confirmedPodium]; confirmedPodium = null; logResult('Se reabrió la clasificación.'); render();
      }
    }); root.append(reopen); return;
  }
  if (format === 'SWISS') { root.append(el('p', 'Esta demo sólo simula la primera ronda del suizo; no permite declarar el podio de todo el torneo.', 'editorial-help')); return; }
  const choices = podiumOptions();
  if (!choices) { root.append(el('p', 'El podio se habilita al terminar los encuentros. En una prueba compartida, confirmá a todos e iniciá para elegir las posiciones.', 'editorial-help')); return; }
  const tied = format === 'ROUND_ROBIN' && choices.some(options => options.length > 1);
  root.append(el('p', format === 'FREE_FOR_ALL' ? 'Elegí los puestos según las reglas de la prueba. No podés repetir participantes.' : tied ? 'Hay un empate. Elegí el orden entre los empatados y explicá el criterio acordado; no se resuelve automáticamente.' : 'Estas posiciones se derivan de los resultados. Revisalas antes de confirmar.', 'editorial-help'));
  choices.forEach((options, i) => {
    const id = 'demo-place-' + i, label = el('label', `${i + 1}.º puesto`); label.htmlFor = id;
    const select = el('select'); select.id = id;
    const placeholder = el('option', 'Seleccionar…'); placeholder.value = ''; select.append(placeholder);
    for (const p of options) { const option = el('option', name(p)); option.value = p.id; select.append(option); }
    select.value = options.length === 1 ? options[0].id : podiumDraft[i] || '';
    select.addEventListener('change', () => { podiumDraft[i] = select.value; }); root.append(label, select);
  });
  if (tied) {
    const label = el('label', 'Criterio de desempate'); label.htmlFor = 'demoTieReason';
    const input = el('textarea'); input.id = 'demoTieReason'; input.maxLength = 240; input.value = podiumReason;
    input.addEventListener('input', () => { podiumReason = input.value; }); root.append(label, input);
  }
  const confirm = el('button', 'Revisar y confirmar podio', 'editorial-primary'); confirm.type = 'button';
  confirm.addEventListener('click', async () => {
    const ids = choices.map((options, i) => $('demo-place-' + i).value);
    if (ids.some((id, i) => !choices[i].some(p => p.id === id)) || new Set(ids).size !== ids.length) { announce('Completá todos los puestos con rivales distintos.'); return; }
    if (tied && !podiumReason.trim()) { announce('Indicá el criterio usado para resolver el empate.'); return; }
    const body = ids.map((id, i) => `${i + 1}.º: ${name(bank.find(p => p.id === id))}`).join('\n') + (tied ? '\nDesempate: ' + podiumReason.trim() : '') + '\nEstos puestos no implican premios reales.';
    if (!await confirmAction('Confirmar clasificación final', body, 'Confirmar clasificación')) return;
    if (format === 'FREE_FOR_ALL') { const m = matches.get('ffa'); m.done = true; m.winnerId = ids[0]; }
    confirmedPodium = ids; logResult('Podio confirmado: ' + ids.map((id, i) => `${i + 1}.º ${name(bank.find(p => p.id === id))}`).join('; ')); render();
  }); root.append(confirm);
}
function updateClock() {
  if (confirmedPodium) $('demoClock').textContent = 'Podio confirmado';
  else if (isFinished()) $('demoClock').textContent = format === 'SWISS' ? 'Primera ronda terminada' : 'Encuentros terminados · falta confirmar podio';
  else if (started) $('demoClock').textContent = 'Simulación en curso';
  else {
    const seconds = Math.max(0, Math.ceil((startsAt - Date.now()) / 1000));
    $('demoClock').textContent = seconds ? `Inicio de ejemplo en ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}` : 'Horario de ejemplo alcanzado · iniciá cuando quieras';
  }
}
function render() {
  const confirmed = active().filter(p => p.confirmed).length;
  $('demoCapacity').textContent = custom ? `${totalPlayers} jugadores en ${count} equipos personalizados (${customSizes.join(' + ')}).${count === 2 ? ' Cruce ' + duelLabel() + '.' : ''} No se compensan automáticamente las diferencias de tamaño.` + (rules ? ' Reglas: ' + rules : '') : teamSize === 1 ? `${count} jugadores ficticios.` : `${count} equipos de ${teamSize} · ${count * teamSize} jugadores ficticios. Cada cruce es ${teamSize}v${teamSize}.`;
  $('demoConfirmations').textContent = `${confirmed} de ${count} ${grouped() ? 'equipos' : 'jugadores'} confirmados en esta simulación.`;
  $('demoProgress').setAttribute('aria-valuenow', String(confirmed)); $('demoProgress').setAttribute('aria-valuemax', String(count)); $('demoProgress').firstElementChild.style.width = (confirmed / count * 100) + '%';
  $('demoPhase').textContent = isFinished() ? 'Resultados ficticios completos' : !allConfirmed() ? 'Esperando confirmaciones' : started ? 'Prueba en curso' : 'Todos listos';
  $('demoConfirmNext').disabled = allConfirmed(); $('demoConfirmAll').disabled = allConfirmed(); $('demoStart').disabled = !allConfirmed() || started;
  $('demoNextResult').disabled = !canPlay() || format === 'FREE_FOR_ALL'; $('demoFinish').disabled = !canPlay() || format === 'FREE_FOR_ALL';
  $('demoBoardTitle').textContent = (custom ? count === 2 ? `Desafío personalizado · ${duelLabel()}` : 'Llaves con equipos personalizados' : teamSize === 1 ? 'Llaves individuales' : `Llaves por equipos · ${teamSize}v${teamSize}`) + ' · demostración';
  $('demoFormatHelp').textContent = format === 'SWISS' ? 'Se simula sólo la primera ronda del suizo. La publicación actual todavía no automatiza las rondas siguientes por puntaje.' : format === 'FREE_FOR_ALL' ? 'Confirmá a todos e iniciá la prueba; después elegí los puestos en Clasificación final. No se puede repetir un rival.' : format === 'DOUBLE_ELIMINATION' ? 'Primera derrota: llave inferior. Segunda derrota: eliminación. Si gana el finalista de la llave inferior, aparece una final de desempate. El tercero, si se muestra, es quien pierde la final de la llave inferior.' : 'Confirmá a los bots e iniciá la prueba. Tocá un nombre para revisar y confirmar su victoria. En un encuentro terminado, elegí al otro rival para corregirlo.';
  renderBoard(); renderStandings(); renderPodium(); updateClock();
  $('demoAudit').replaceChildren();
  for (const event of audit.slice(-100).reverse()) $('demoAudit').append(el('li', event.at + ' · ' + event.text));
  if (audit.length > 100) $('demoAudit').append(el('li', `Se muestran los últimos 100 de ${audit.length} eventos de esta prueba.`));
}
function restoreControls() {
  if (!lastConfig) return;
  $('demoCount').value = String(totalPlayers); $('demoTeamMode').value = custom ? 'custom' : 'equal';
  $('demoCustomSetup').hidden = !custom; $('demoCustomSizes').value = customSizes.join(', '); $('demoCustomRules').value = rules;
  $('demoTeamSize').hidden = custom; $('demoTeamSize').previousElementSibling.hidden = custom;
  if (!custom) syncTeamSizes(teamSize); syncFormats(format); $('demoPlaces').value = String(places);
}
async function configure(shuffle = false) {
  const requestedFormat = $('demoFormat').value || format;
  const requestedTeamSize = Number($('demoTeamSize').value) || teamSize;
  const value = Number($('demoCount').value);
  if (!Number.isInteger(value) || value < 2 || value > MAX_PLAYERS) {
    restoreControls(); announce('Elegí un total entre 2 y 64 jugadores. Se conservó la configuración anterior.'); return;
  }
  const requestedCustom = $('demoTeamMode').value === 'custom';
  const sizesText = $('demoCustomSizes').value.trim();
  const sizes = sizesText.split(',').map(s => Number(s.trim()));
  if (requestedCustom && (!/^\d+(\s*,\s*\d+)+$/.test(sizesText) || sizes.length > MAX_PLAYERS || sizes.some(size => !Number.isInteger(size) || size < 1) || sizes.reduce((sum, size) => sum + size, 0) !== value)) {
    announce('Distribución inválida: escribí al menos dos tamaños enteros positivos separados por comas, cuya suma sea ' + value + '. La prueba actual no cambió.'); return;
  }
  const recorded = [...matches.values()].filter(m => m.done && !m.auto);
  if (recorded.length || confirmedPodium) {
    if (!await confirmAction('Reiniciar esta prueba', `Cambiar la configuración o reiniciar borrará ${recorded.length} resultados ficticios y el podio de esta prueba. Los nombres se conservan. No se modifica ningún torneo real.`, 'Reiniciar prueba')) { restoreControls(); return; }
  }
  totalPlayers = value; custom = requestedCustom;
  let adjusted = false;
  if (custom) { customSizes = sizes; count = sizes.length; }
  else adjusted = syncTeamSizes(requestedTeamSize);
  syncFormats(requestedFormat);
  places = Math.min(Number($('demoPlaces').value) || 2, count, 3);
  if (format === 'SWISS') places = 1;
  rules = $('demoCustomRules').value.trim().slice(0, 800);
  $('demoPlaces').value = String(places); $('demoPlaces').disabled = format === 'SWISS';
  $('demoPlaces').querySelector('option[value="3"]').disabled = count < 3;
  $('demoPodiumHelp').textContent = format === 'SWISS' ? 'Primera ronda de demostración; no determina puestos finales.' : count < 3 ? 'Con dos rivales sólo puede haber primer y segundo puesto.' : format === 'SINGLE_ELIMINATION' && places === 3 ? 'Se agrega un encuentro por el tercer puesto entre los perdedores de las semifinales; si uno tiene pase libre, se resuelve automáticamente.' : 'Los puestos no asignan premios. En Round Robin los empates necesitan una decisión explícita.';
  $('demoCustomSetup').hidden = !custom; $('demoTeamSize').hidden = custom; $('demoTeamSize').previousElementSibling.hidden = custom;
  confirmedPodium = null; podiumDraft = []; podiumReason = ''; audit = [];
  started = false; startsAt = Date.now() + 5 * 60 * 1000; bank.forEach(p => { p.confirmed = false; });
  buildDraw(shuffle);
  $('demoRoundPicker').hidden = format !== 'ROUND_ROBIN'; $('demoRound').replaceChildren();
  if (format === 'ROUND_ROBIN') rounds.forEach((round, i) => { const option = el('option', round.title); option.value = String(i); $('demoRound').append(option); });
  renderEditors(); render();
  lastConfig = { totalPlayers, custom, teamSize, format, places };
  announce((adjusted ? 'El total no se divide en equipos del tamaño anterior: se pasó a individual. Elegí otra división disponible. ' : '') + 'Prueba preparada. Podés cambiar todos los nombres sin invitar a nadie.');
}
$('demoFormat').addEventListener('change', () => configure());
$('demoRound').addEventListener('change', renderBoard);
$('demoPlaces').addEventListener('change', () => configure());
$('demoTeamSize').addEventListener('change', () => configure());
$('demoCount').addEventListener('change', () => { if ($('demoTeamMode').value === 'custom') announce('Ajustá la distribución para que sume el nuevo total y presioná Aplicar distribución. La prueba actual sigue intacta.'); else void configure(); });
$('demoTeamMode').addEventListener('change', () => {
  if ($('demoTeamMode').value === 'custom' && !custom) $('demoCustomSizes').value = `${Math.max(1, Number($('demoCount').value) - 1)}, 1`;
  $('demoCustomSetup').hidden = $('demoTeamMode').value !== 'custom'; void configure();
});
$('demoApplyCustom').addEventListener('click', () => void configure());
$('demoShuffle').addEventListener('click', () => configure(true));
$('demoReset').addEventListener('click', () => configure());
$('demoConfirmNext').addEventListener('click', () => { const entry = active().find(p => !p.confirmed); if (entry) entry.confirmed = true; renderEditors(); render(); });
$('demoConfirmAll').addEventListener('click', () => { active().forEach(p => { p.confirmed = true; }); renderEditors(); render(); announce('Todos los bots confirmaron. Podés iniciar ahora sin esperar al reloj.'); });
$('demoStart').addEventListener('click', () => { if (!allConfirmed()) return; started = true; render(); announce('Prueba iniciada. Elegí ganadores tocando los nombres o simulá resultados.'); });
function nextResult() {
  if (!canPlay()) return false;
  const m = [...matches.values()].find(m => !m.done && matchPlayers(m).every(p => p !== undefined) && matchPlayers(m).filter(Boolean).length > 1);
  if (!m) return false;
  const entries = matchPlayers(m).filter(Boolean); pickWinner(m, entries[Math.floor(Math.random() * entries.length)]); return true;
}
$('demoNextResult').addEventListener('click', () => {
  const m = [...matches.values()].find(m => !m.done && matchPlayers(m).every(p => p !== undefined) && matchPlayers(m).filter(Boolean).length > 1);
  if (!m || !canPlay()) return;
  const entries = matchPlayers(m).filter(Boolean); void chooseWinner(m, entries[Math.floor(Math.random() * entries.length)]);
});
$('demoFinish').addEventListener('click', async () => {
  if (!canPlay() || !await confirmAction('Completar encuentros al azar', 'Se elegirán ganadores ficticios al azar para los encuentros pendientes. Después tendrás que revisar y confirmar el podio por separado.', 'Simular encuentros pendientes')) return;
  let guard = 0; while (guard++ < MAX_PLAYERS * (MAX_PLAYERS - 1) / 2 + MAX_PLAYERS && nextResult()) { /* Número máximo acotado, sin llamadas remotas. */ }
  logResult('Se completaron los encuentros pendientes con resultados al azar.');
  announce('Encuentros simulados. Revisá y confirmá el podio antes de dar la prueba por finalizada.'); render();
});
for (const button of document.querySelectorAll('[data-preset]')) button.addEventListener('click', () => {
  // Cada ejemplo declara formato, integrantes por equipo y TOTAL de jugadores.
  const settings = { duel: ['DUEL', 1, 2], uneven: ['DUEL', 1, 5], four: ['DUEL', 4, 8], ten: ['DUEL', 10, 20], five: ['DUEL', 5, 10], cup: ['SINGLE_ELIMINATION', 5, 20], league: ['ROUND_ROBIN', 1, 8] }[button.dataset.preset];
  $('demoCount').value = String(settings[2]); $('demoTeamMode').value = button.dataset.preset === 'uneven' ? 'custom' : 'equal';
  if (button.dataset.preset === 'uneven') $('demoCustomSizes').value = '4, 1';
  // Opciones temporales permiten preparar otro ejemplo sin mutar el estado antes de su confirmación.
  for (const [id, value] of [['demoTeamSize', settings[1]], ['demoFormat', settings[0]]]) {
    if (![...$(id).options].some(option => option.value === String(value))) { const option = el('option', String(value)); option.value = String(value); $(id).append(option); }
    $(id).value = String(value);
  }
  $('demoPlaces').value = button.dataset.preset === 'cup' ? '3' : '2'; void configure();
});
$('demoCount').value = String(totalPlayers); syncTeamSizes(teamSize); syncFormats(format);
configure(); setInterval(updateClock, 1000);
