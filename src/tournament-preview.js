import { formats } from './tournament-formats.js';

const el = (tag, text, className) => { const n = document.createElement(tag); n.textContent = text; if (className) n.className = className; return n; };

// Modelo sin sorteo: no modifica el torneo ni consume azar del servidor.
export function renderTournamentPreview(root, { format, count, names = [], awaitingDraw = false }) {
  root.replaceChildren();
  const info = formats.find(f => f.id === format);
  const heading = el('div', '', 'model-heading');
  heading.append(el('h3', info.name));
  root.append(heading, el('p', awaitingDraw ? 'Tocá un encuentro para explorar el formato. Los cruces se definirán en el sorteo.' : 'Tocá un encuentro para ver su lugar en la competencia. Los nombres y cruces son ilustrativos hasta que todos confirmen.', 'editorial-help'));
  const players = Array.from({ length: count }, (_, i) => names[i] || `Participante ${i + 1}`);
  const columns = [], model = el('div', '', 'model-board');
  model.tabIndex = 0; model.setAttribute('role', 'region'); model.setAttribute('aria-label', 'Modelo de llaves desplazable');
  const output = el('p', 'Seleccioná un encuentro del modelo.', 'model-inspector');
  output.setAttribute('role', 'status');
  function column(title, matches) {
    const col = el('section', '', 'model-round'); col.append(el('h4', title));
    for (const [i, pair] of matches.entries()) {
      const button = el('button', '', 'model-match'); button.type = 'button'; button.setAttribute('aria-pressed', 'false');
      const label = `${title} · encuentro ${i + 1}: ${pair.join(' contra ')}`;
      button.setAttribute('aria-label', label);
      pair.forEach(name => button.append(el('span', name)));
      button.addEventListener('click', () => {
        model.querySelectorAll('[aria-pressed]').forEach(n => n.setAttribute('aria-pressed', 'false'));
        button.setAttribute('aria-pressed', 'true'); output.textContent = label + '. Los cruces definitivos se guardan al completar el sorteo.';
      }); col.append(button);
    } columns.push(col);
  }
  let encounters = 1;
  if (format === 'ROUND_ROBIN') {
    const circle = [...players]; if (circle.length % 2) circle.push('Descanso');
    const totalRounds = circle.length - 1;
    for (let r = 0; r < Math.min(totalRounds, 5); r++) {
      column('Ronda ' + (r + 1), circle.slice(0, circle.length / 2).map((p, i) => [p, circle[circle.length - 1 - i]]));
      circle.splice(1, 0, circle.pop());
    }
    encounters = count * (count - 1) / 2;
    if (totalRounds > 5) root.append(el('p', `Vista reducida: 5 de ${totalRounds} rondas. El calendario definitivo incluirá todas.`, 'editorial-help'));
  } else if (format === 'FREE_FOR_ALL') {
    column('Prueba compartida', [players]);
  } else if (format === 'DUEL' || format === 'SWISS') {
    column(format === 'DUEL' ? 'Duelo' : 'Primera ronda', players.filter((_, i) => i % 2 === 0).map((p, i) => [p, players[i * 2 + 1] || 'Descanso']));
    encounters = Math.floor(count / 2);
    if (format === 'SWISS') root.append(el('p', 'El sistema actual sortea la primera ronda; las siguientes rondas por puntaje todavía requieren gestión manual.', 'editorial-help'));
  } else {
    let size = 2; while (size < count) size *= 2;
    const byes = size - count, first = []; let p = 0;
    for (let i = 0; i < size / 2; i++) first.push([players[p++], i < byes ? 'Pase libre' : players[p++]]);
    let matches = first, round = 1;
    while (matches.length) {
      column(matches.length === 1 ? 'Final' : 'Ronda ' + round, matches);
      if (matches.length === 1) break;
      matches = Array.from({ length: matches.length / 2 }, (_, i) => [`Ganador ${round}.${i * 2 + 1}`, `Ganador ${round}.${i * 2 + 2}`]); round++;
    }
    encounters = count - 1;
    if (format === 'DOUBLE_ELIMINATION') {
      column('Segunda oportunidad', [['Perdedores de la llave principal', 'Avanzan hasta la final inferior']]);
      column('Gran final', [['Ganador de llave principal', 'Ganador de llave inferior']]);
      root.append(el('p', 'La llave inferior se muestra resumida en este modelo. La regla de reinicio de la gran final debe acordarse en las reglas.', 'editorial-help'));
    }
  }
  model.append(...columns); root.append(model, output);
  root.append(el('p', `${count} participantes · ${format === 'DOUBLE_ELIMINATION' ? 'Llaves de ganadores y perdedores' : format === 'SWISS' ? encounters + ' encuentros en la primera ronda' : encounters + ' encuentros'}`, 'model-total'));
}
