// Laboratorio enteramente local. No importa clientes AWS, pagos, cuentas ni notificaciones.
import { formats } from './tournament-formats.js';

const $ = id => document.getElementById(id);
const el = (tag, text = '', cls) => { const n = document.createElement(tag); n.textContent = text; if (cls) n.className = cls; return n; };
const bank = Array.from({ length: 16 }, (_, i) => ({
  id: 'demo-' + (i + 1), name: 'Equipo ' + (i + 1), solo: 'Bot ' + String(i + 1).padStart(2, '0'),
  members: Array.from({ length: 5 }, (_, j) => 'Bot ' + (i + 1) + '.' + (j + 1)), confirmed: false,
}));
let count = 4, teamSize = 1, format = 'SINGLE_ELIMINATION', rounds = [], matches = new Map(), order = [];
let started = false, startsAt = Date.now() + 5 * 60 * 1000, hasReset = false;
const active = () => bank.slice(0, count);
const name = p => p ? teamSize === 1 ? p.solo : p.name : 'Pase libre';
const allConfirmed = () => active().every(p => p.confirmed);
const isFinished = () => matches.size > 0 && [...matches.values()].every(m => m.done);
const canPlay = () => allConfirmed() && started && !isFinished();
const announce = text => { $('demoNotice').textContent = text; };

for (const f of formats) {
  const option = el('option', f.id === 'DUEL' ? 'Enfrentamiento directo' : f.name); option.value = f.id; $('demoFormat').append(option);
}
const params = new URLSearchParams(location.search);
if (formats.some(f => f.id === params.get('format'))) format = params.get('format');
const fromCount = Number(params.get('count'));
if (Number.isInteger(fromCount) && fromCount >= 2 && fromCount <= 16) count = fromCount;
if (format === 'DUEL' && count !== 2) format = 'SINGLE_ELIMINATION';

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
    addRound(format === 'DUEL' ? `Encuentro ${teamSize}v${teamSize}` : 'Primera ronda', 'Cruces de prueba', pairs(players, 'r1'));
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
    }
  }
  settleByes();
}

function renderEditors() {
  $('demoEntrants').replaceChildren();
  for (const [i, entry] of active().entries()) {
    const row = el('section', '', 'demo-entrant'); row.dataset.confirmed = String(entry.confirmed);
    const heading = el('div', '', 'demo-entry-heading'), check = el('input'); check.type = 'checkbox'; check.checked = entry.confirmed;
    check.id = 'demo-confirm-' + i; const label = el('label', (teamSize === 1 ? 'Jugador ' : 'Equipo ') + (i + 1)); label.htmlFor = check.id;
    const status = el('span', entry.confirmed ? 'Confirmado' : 'Pendiente', 'demo-status');
    check.addEventListener('change', () => { entry.confirmed = check.checked; row.dataset.confirmed = String(entry.confirmed); status.textContent = entry.confirmed ? 'Confirmado' : 'Pendiente'; render(); });
    heading.append(check, label, status); row.append(heading);
    const input = el('input'); input.maxLength = 40; input.value = name(entry); input.setAttribute('aria-label', (teamSize === 1 ? 'Nombre del jugador ' : 'Nombre del equipo ') + (i + 1));
    input.addEventListener('input', () => { const value = input.value.trim().slice(0, 40); if (teamSize === 1) entry.solo = value || 'Bot ' + (i + 1); else entry.name = value || 'Equipo ' + (i + 1); render(); }); row.append(input);
    if (teamSize > 1) {
      const members = el('details', '', 'demo-member-editor'); members.append(el('summary', 'Editar los ' + teamSize + ' jugadores'));
      for (let j = 0; j < teamSize; j++) {
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
function slotLabel(slot) {
  if (!slot) return 'Descanso / pase libre';
  const entry = resolve(slot);
  if (entry) return name(entry);
  if (entry === null) return 'Descanso / pase libre';
  return (slot.outcome === 'loser' ? 'Perdedor de ' : 'Ganador de ') + slot.source;
}
function renderBoard() {
  $('demoBoard').replaceChildren();
  for (const round of rounds) {
    const column = el('section', '', 'demo-round'); column.append(el('h3', round.group + ' · ' + round.title));
    const stack = el('div', '', 'demo-matches'); column.append(stack);
    for (const m of round.items) {
      const card = el('article', '', 'demo-match'); card.setAttribute('aria-label', 'Encuentro ' + m.id);
      card.append(el('small', m.id + (m.auto ? ' · Pase libre' : m.done ? ' · Resultado simulado' : '')));
      const slots = m.entrants || [m.left, m.right], players = matchPlayers(m);
      for (const slot of slots) {
        const entry = resolve(slot), button = el('button', '', 'demo-team-slot'); button.type = 'button';
        button.disabled = !canPlay() || m.done || !entry || players.some(p => p === undefined);
        const content = el('span', '', 'demo-team-info'); content.append(el('strong', slotLabel(slot), entry ? '' : 'demo-unknown'));
        if (entry && teamSize > 1) content.append(el('small', entry.members.slice(0, teamSize).join(' · ')));
        button.append(content); button.setAttribute('aria-label', `Dar victoria ficticia a ${slotLabel(slot)} en ${m.id}`);
        if (entry && m.done && m.winnerId === entry.id) { button.dataset.winner = 'true'; button.append(el('span', '✓', 'demo-win-mark')); }
        if (entry) button.addEventListener('click', () => { pickWinner(m, entry); announce('Resultado ficticio guardado para ' + name(entry) + '.'); render(); });
        card.append(button);
      } stack.append(card);
    } $('demoBoard').append(column);
  }
}
function renderStandings() {
  const scores = new Map(active().map(p => [p.id, { p, played: 0, wins: 0, losses: 0 }]));
  for (const m of matches.values()) if (m.done && !m.auto && m.winnerId) {
    for (const p of matchPlayers(m).filter(Boolean)) {
      const row = scores.get(p.id); if (!row) continue; row.played++; if (p.id === m.winnerId) row.wins++; else row.losses++;
    }
  }
  const sorted = [...scores.values()].sort((a, b) => b.wins - a.wins || a.losses - b.losses || name(a.p).localeCompare(name(b.p), 'es'));
  const root = $('demoStandings'); root.replaceChildren();
  if (isFinished()) {
    const leaders = format === 'ROUND_ROBIN' || format === 'SWISS' ? sorted.filter(r => r.wins === sorted[0].wins).map(r => name(r.p)) : [name(resolve(source(rounds.at(-1).items[0].id)))];
    root.append(el('p', (format === 'SWISS' ? 'Primera ronda terminada · ' : leaders.length > 1 ? 'Empate de prueba · ' : 'Ganador de prueba · ') + leaders.join(' / '), 'demo-champion'));
    if (leaders.length > 1 && format === 'ROUND_ROBIN') root.append(el('p', 'Las reglas del torneo deben definir el desempate. La simulación no inventa un campeón.', 'editorial-help'));
  }
  root.append(el('h3', 'Resultados de esta prueba'));
  const wrap = el('div', '', 'demo-table-wrap'), table = el('table'), head = el('thead'), row = el('tr');
  for (const text of [teamSize === 1 ? 'Jugador' : 'Equipo', 'Jugados', 'Ganados', 'Perdidos']) row.append(el('th', text)); head.append(row); table.append(head);
  const body = el('tbody');
  for (const score of sorted) { const r = el('tr'); [name(score.p), score.played, score.wins, score.losses].forEach(value => r.append(el('td', String(value)))); body.append(r); }
  table.append(body); wrap.append(table); root.append(wrap);
}
function updateClock() {
  if (isFinished()) $('demoClock').textContent = 'Simulación terminada';
  else if (started) $('demoClock').textContent = 'Simulación en curso';
  else {
    const seconds = Math.max(0, Math.ceil((startsAt - Date.now()) / 1000));
    $('demoClock').textContent = seconds ? `Inicio de ejemplo en ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}` : 'Horario de ejemplo alcanzado · iniciá cuando quieras';
  }
}
function render() {
  const confirmed = active().filter(p => p.confirmed).length;
  $('demoCountLabel').textContent = teamSize === 1 ? 'Número de jugadores' : 'Número de equipos';
  $('demoCapacity').textContent = teamSize === 1 ? `${count} jugadores ficticios.` : `${count} equipos de ${teamSize} · ${count * teamSize} jugadores ficticios. Cada cruce es ${teamSize}v${teamSize}.`;
  $('demoConfirmations').textContent = `${confirmed} de ${count} ${teamSize === 1 ? 'jugadores' : 'equipos'} confirmados en esta simulación.`;
  $('demoProgress').setAttribute('aria-valuenow', String(confirmed)); $('demoProgress').setAttribute('aria-valuemax', String(count)); $('demoProgress').firstElementChild.style.width = (confirmed / count * 100) + '%';
  $('demoPhase').textContent = isFinished() ? 'Resultados ficticios completos' : !allConfirmed() ? 'Esperando confirmaciones' : started ? 'Prueba en curso' : 'Todos listos';
  $('demoConfirmNext').disabled = allConfirmed(); $('demoConfirmAll').disabled = allConfirmed(); $('demoStart').disabled = !allConfirmed() || started;
  $('demoNextResult').disabled = !canPlay(); $('demoFinish').disabled = !canPlay();
  $('demoBoardTitle').textContent = (teamSize === 1 ? 'Llaves individuales' : `Llaves por equipos · ${teamSize}v${teamSize}`) + ' · demostración';
  $('demoFormatHelp').textContent = format === 'SWISS' ? 'Se simula sólo la primera ronda del suizo. La publicación actual todavía no automatiza las rondas siguientes por puntaje.' : format === 'DOUBLE_ELIMINATION' ? 'Primera derrota: llave inferior. Segunda derrota: eliminación. Si gana el finalista de la llave inferior, aparece una final de desempate.' : 'Confirmá a los bots e iniciá la prueba. Después tocá un nombre para darle una victoria ficticia y ver cómo avanza.';
  renderBoard(); renderStandings(); updateClock();
}
function configure(shuffle = false) {
  format = $('demoFormat').value;
  teamSize = Number($('demoTeamSize').value);
  const value = Number($('demoCount').value);
  if (!Number.isInteger(value) || value < 2 || value > 16) { announce('Elegí entre 2 y 16 jugadores o equipos.'); return; }
  count = value;
  if (format === 'DUEL' && count !== 2) { format = 'SINGLE_ELIMINATION'; $('demoFormat').value = format; }
  started = false; startsAt = Date.now() + 5 * 60 * 1000; bank.forEach(p => { p.confirmed = false; });
  buildDraw(shuffle); renderEditors(); render(); announce('Prueba preparada. Podés cambiar todos los nombres sin invitar a nadie.');
}
$('demoFormat').addEventListener('change', () => { if ($('demoFormat').value === 'DUEL') $('demoCount').value = '2'; configure(); });
$('demoTeamSize').addEventListener('change', () => configure()); $('demoCount').addEventListener('change', () => configure());
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
$('demoNextResult').addEventListener('click', () => { if (nextResult()) announce('Se simuló un resultado al azar. No se modifican puntos, ligas ni torneos reales.'); render(); });
$('demoFinish').addEventListener('click', () => {
  let guard = 0; while (guard++ < 300 && nextResult()) { /* Número máximo acotado, sin llamadas remotas. */ }
  announce('Simulación completada. Podés reiniciar los resultados o elegir otra modalidad.'); render();
});
for (const button of document.querySelectorAll('[data-preset]')) button.addEventListener('click', () => {
  const settings = { duel: ['DUEL', 1, 2], four: ['DUEL', 4, 2], five: ['DUEL', 5, 2], cup: ['SINGLE_ELIMINATION', 5, 4], league: ['ROUND_ROBIN', 1, 8] }[button.dataset.preset];
  $('demoFormat').value = settings[0]; $('demoTeamSize').value = String(settings[1]); $('demoCount').value = String(settings[2]); configure();
});
$('demoFormat').value = format; $('demoTeamSize').value = String(teamSize); $('demoCount').value = String(count);
configure(); setInterval(updateClock, 1000);
