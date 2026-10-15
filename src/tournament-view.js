import { formats, formatImage } from './tournament-formats.js';
import { listClubTournaments, getClubTournament } from './tournaments-api.js';
const notice = document.getElementById('tournamentsNotice');
const detail = document.getElementById('tournamentDetail');
const list = document.getElementById('tournamentsList');
const element = (tag, text, className) => { const node = document.createElement(tag); node.textContent = text; if (className) node.className = className; return node; };
function roster(title, names) {
  const section = element('section','', 'tournament-panel'); section.append(element('h2',title));
  const ul = element('ul','', 'roster'); names.forEach(name => ul.append(element('li',name))); section.append(ul); return section;
}
try {
  if (detail) {
    const id = new URLSearchParams(location.search).get('id');
    if (!id) throw new Error('El enlace no incluye un torneo. Volvé al listado del club.');
    const tournament = await getClubTournament(id);
    if (!tournament) throw new Error('No encontramos ese torneo. Revisá el enlace.');
    const format = formats.find(item => item.id === tournament.format);
    detail.append(element('p','TORNEO CREADO · EN PREPARACIÓN','eyebrow'), element('h1',tournament.name),element('p',tournament.activity));
    const info = element('section','', 'tournament-panel');
    info.append(element('h2',format?.name || tournament.format));
    if (format) { const image = document.createElement('div'); image.className = 'format-preview'; image.innerHTML = formatImage(format.id); image.append(element('p',format.description)); info.append(image); }
    const description = element('p',tournament.description || 'El organizador todavía no agregó reglas.'); description.style.whiteSpace = 'pre-wrap'; info.append(description);
    detail.append(info, roster(`Participantes · ${tournament.participantNames.length}`,tournament.participantNames),roster(`Jueces · ${tournament.judgeNames.length}`,tournament.judgeNames),roster('Tesorero',tournament.treasurerName ? [tournament.treasurerName] : ['Sin tesorero']));
    detail.append(element('p','La ficha está guardada. La generación de cruces, carga de resultados y gestión del dinero todavía no están disponibles.','tournament-notice'));
    const copy = element('button','Copiar enlace','primary-button'); copy.type = 'button';
    copy.addEventListener('click',async()=>{try { await navigator.clipboard.writeText(location.href); copy.textContent='Enlace copiado'; } catch { notice.textContent='Copiá la dirección desde la barra del navegador.'; notice.hidden=false; }}); detail.append(copy);
  } else {
    const tournaments = await listClubTournaments();
    if (!tournaments.length) list.append(element('p','Todavía no hay torneos. Creá el primer desafío del club.','tournament-empty'));
    tournaments.forEach(tournament=>{
      const card = element('a','', 'tournament-panel tournament-card'); card.href=`/torneo.html?id=${encodeURIComponent(tournament.id)}`;
      card.append(element('small',`${formats.find(format=>format.id===tournament.format)?.name || tournament.format} · EN PREPARACIÓN`),element('h2',tournament.name),element('p',`${tournament.activity} · ${tournament.participantIds.length} participantes · ${tournament.judgeIds.length} jueces`)); list.append(card);
    });
  }
  notice.hidden = true;
} catch (error) {
  notice.dataset.error='true'; notice.textContent = error.name === 'UserUnAuthenticatedException' ? 'Ingresá con tu cuenta para consultar los torneos y recargá esta página.' : error.message;
}

