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
  board.dataset.format=draw.format;
  board.setAttribute('role','region');board.setAttribute('aria-label',preview?'Vista previa desplazable de la llave':'Llave del torneo. Los nombres abren una vista previa de perfil.');board.tabIndex=0;
  const canvas=element('div','','draw-canvas'+(draw.format==='DUEL'?' draw-canvas-duel':draw.format==='FREE_FOR_ALL'?' draw-canvas-ffa':''));board.append(canvas);
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
      const card=element('article','','draw-match'+(draw.format==='DUEL'?' draw-duel-match':''));
      if(match.entrants)card.classList.add('draw-ffa-match');
      card.dataset.matchId=match.id;card.setAttribute('aria-label','Encuentro '+match.id);
      if(draw.format==='DUEL')card.append(slotNode(match.left,match.id,0),element('span','VS','draw-versus'),slotNode(match.right,match.id,1));
      else if(match.entrants) match.entrants.forEach((player,index)=>card.append(slotNode(player,match.id,index)));
      else card.append(slotNode(match.left,match.id,0),element('span','VS','draw-versus'),slotNode(match.right,match.id,1));
      matches.append(card);
    });canvas.append(column);
  });
  const winner=players.get(winnerId);
  const knockout=['DUEL','SINGLE_ELIMINATION','DOUBLE_ELIMINATION'].includes(draw.format);
  const finalMatch=draw.format==='DUEL'
    ? draw.rounds[0]?.matches[0]
    : draw.format==='DOUBLE_ELIMINATION'
      ? draw.rounds.flatMap(round=>round.matches).find(match=>match.id==='gf-reset') || draw.rounds.flatMap(round=>round.matches).find(match=>match.id==='gf')
      : draw.format==='SINGLE_ELIMINATION'
        ? draw.rounds.at(-1)?.matches.at(-1)
        : null;
  if(knockout && finalMatch){
    const duel=draw.format==='DUEL';
    const column=element('section','','draw-round draw-winner-round'+(duel?' draw-duel-winner-round':''));
    column.append(element('h3',duel?'Ganador del duelo':'Campeón del torneo'));
    const matches=element('div','','round-matches');
    const card=element('article','','draw-match');
    card.dataset.matchId='bracket-champion';
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
    links.push({source:finalMatch.id,target:card.dataset.matchId,slot:0,outcome:'winner',joinPlayers:true,...(duel?{orientation:'vertical'}:{})});
  }
  if(preview && draw.format==='SWISS'){
    const column=element('section','','draw-round draw-upcoming-round');
    column.append(element('h3','Próxima ronda · por definir'));
    const matches=element('div','','round-matches');
    for(let index=0;index<Math.floor(draw.order.length/2);index++){
      const card=element('article','','draw-match draw-upcoming-match');
      card.append(element('div','Rival por definir','draw-player draw-placeholder'),element('span','VS','draw-versus'),element('div','Rival por definir','draw-player draw-placeholder'));
      matches.append(card);
    }
    column.append(matches);canvas.append(column);
  }
  if(preview && ['ROUND_ROBIN','FREE_FOR_ALL'].includes(draw.format)){
    const column=element('section','','draw-round draw-ranking-round');
    column.append(element('h3',draw.format==='ROUND_ROBIN'?'Tabla de posiciones':'Clasificación final'));
    const matches=element('div','','round-matches'),card=element('article','','draw-match draw-ranking-match');
    card.dataset.matchId='preview-ranking';
    const places=Math.min(draw.order.length,draw.format==='ROUND_ROBIN'?4:3);
    for(let index=0;index<places;index++){
      const row=element('div',`${index+1}.º puesto · Por definir`,'draw-player draw-placeholder');
      row.dataset.slot=String(index);card.append(row);
      if(draw.format==='FREE_FOR_ALL')links.push({source:draw.rounds[0]?.matches[0]?.id,target:card.dataset.matchId,slot:index,outcome:'winner',orientation:'ranking'});
    }
    matches.append(card);column.append(matches);canvas.append(column);
  }
  section.append(board);
  if(winner && !knockout){
    const champion=element('p','','bracket-champion');
    const trophy=element('span','🏆','bracket-trophy');
    trophy.setAttribute('aria-hidden','true');
    champion.append(trophy,element('strong','Ganador: '+winner.name));
    section.append(champion);
  }
  if(draw.format==='SWISS')section.append(element('p','La próxima ronda debería definirse según los resultados. La cantidad de rondas y las reglas de emparejamiento todavía están pendientes de definir.','tournament-notice'));
  if(draw.format==='DOUBLE_ELIMINATION' && winnerId && !draw.results)section.append(element('p','Este torneo guardó solo el resultado general.','field-help'));
  return {section,cleanup:connectBracket(canvas,links)};
}
