import {resolveBracket} from '../shared/tournament-bracket.ts';
import {connectBracket} from './bracket-lines.js';
const element=(tag,text='',className='')=>{const node=document.createElement(tag);node.textContent=text;node.className=className;return node;};
export function drawBoard(draw,{winnerId,playerButton,selfPlayer,preview=false,roundLimit}={}) {
  const section=element('section','','tournament-panel'); if(!preview)section.id='tournamentDraw';
  const header=element('header','','bracket-reveal-header');
  const status=element('h2',preview?'Vista previa de la llave':winnerId?'Torneo finalizado':'Cruces sorteados','bracket-reveal-status');
  status.setAttribute('aria-live','polite');
  header.append(status);
  section.append(header);
  const players=new Map(draw.order.map(player=>[player.id,player]));
  const board=element('div','','draw-board');
  board.setAttribute('role','region');board.setAttribute('aria-label',preview?'Vista previa desplazable de la llave':'Llave del torneo. Los nombres abren una vista previa de perfil.');board.tabIndex=0;
  const canvas=element('div','','draw-canvas');board.append(canvas);
  const links=[];
  const resolved=draw.format==='DOUBLE_ELIMINATION'?resolveBracket(draw):new Map();
  const slotNode=(slot,matchId,index)=>{
    const row=element('div','','draw-player');
    row.dataset.slot=String(index);
    if(slot?.source){
      links.push({source:slot.source,target:matchId,slot:index,outcome:slot.outcome});
      const id=resolved.get(slot.source)?.[slot.outcome];
      if(id!==undefined)slot=id?{playerId:id}:null;
    }
    if(!slot) {row.dataset.playerLabel='Pase libre';row.append(element('span','Descanso / pase libre'));return row;}
    const player=slot.playerId?players.get(slot.playerId):slot.name?slot:null;
    if(player) {
      row.dataset.playerLabel=player.name;
      row.dataset.playerId=player.id;
      row.append(playerButton?.(player.id,player.name) || element('span',player.name));
      if(selfPlayer?.(player.id)){row.classList.add('draw-self-slot');row.append(element('small','Vos','draw-self'));}
      if((draw.format==='DOUBLE_ELIMINATION'?draw.results?.[matchId]?.winnerId:winnerId)===player.id) { row.dataset.winner='true'; row.append(element('strong','Ganador','winner-tag')); }
    }
    else {row.append(element('span',(slot.outcome==='loser'?'Perdedor de ':'Ganador de ')+slot.source,'draw-placeholder'));}
    return row;
  };
  draw.rounds.slice(0,roundLimit).forEach(round=>{
    const column=element('section','','draw-round');
    column.append(element('h3',round.group==='Perdedores' || round.group==='Ganadores'?'Llave de '+round.group.toLowerCase()+' · '+round.name:round.name));
    const matches=element('div','','round-matches');column.append(matches);
    round.matches.forEach(match=>{
      const card=element('article','','draw-match');
      card.dataset.matchId=match.id;card.setAttribute('aria-label','Encuentro '+match.id);
      if(match.entrants) match.entrants.forEach((player,index)=>card.append(slotNode(player,match.id,index)));
      else card.append(slotNode(match.left,match.id,0),slotNode(match.right,match.id,1));
      matches.append(card);
    });canvas.append(column);
  });
  const winner=players.get(winnerId);
  const finalMatch=draw.format==='DUEL' && draw.rounds.length===1 && draw.rounds[0].matches.length===1
    ? draw.rounds[0].matches[0] : null;
  if(finalMatch){
    const column=element('section','','draw-round draw-winner-round');
    column.append(element('h3','Ganador del duelo'));
    const matches=element('div','','round-matches');
    const card=element('article','','draw-match');
    card.dataset.matchId='duel-winner';
    const result=winner
      ? slotNode({playerId:winner.id},card.dataset.matchId,0)
      : element('div','Por definir','draw-player draw-placeholder');
    result.dataset.slot='0';
    if(winner){
      result.classList.add('bracket-champion');
      result.prepend(element('span','🏆','bracket-trophy'));
    }
    card.append(result);
    matches.append(card);
    column.append(matches);
    canvas.append(column);
    links.push({source:finalMatch.id,target:card.dataset.matchId,slot:0,outcome:'winner',joinPlayers:true});
  }
  section.append(board);
  if(winner && !finalMatch){
    const champion=element('p','','bracket-champion');
    const trophy=element('span','🏆','bracket-trophy');
    trophy.setAttribute('aria-hidden','true');
    champion.append(trophy,element('strong','Ganador: '+winner.name));
    section.append(champion);
  }
  if(draw.format==='SWISS')section.append(element('p','Se sorteó la primera ronda. Las siguientes requieren resultados y emparejamientos por puntaje, que todavía no están implementados.','tournament-notice'));
  if(draw.format==='DOUBLE_ELIMINATION' && winnerId && !draw.results)section.append(element('p','Este torneo guardó solo el resultado general.','field-help'));
  return {section,cleanup:connectBracket(canvas,links)};
}
