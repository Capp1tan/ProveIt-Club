import {buildBracket} from '../shared/tournament-bracket.ts';
import {drawBoard} from './tournament-bracket.js';

const cleanups=new WeakMap();

export function renderTournamentPreview(root,{format,count,names=[],awaitingDraw=false}){
  cleanups.get(root)?.();
  const players=Array.from({length:count},(_,i)=>({id:String(i),name:names[i] || `Participante ${i+1}`}));
  const draw=buildBracket(format,players);
  const reduced=draw.format==='ROUND_ROBIN' && draw.rounds.length>5;
  const {section,cleanup}=drawBoard(draw,{preview:true,roundLimit:reduced?5:undefined});
  const help=document.createElement('p');
  help.className='editorial-help';
  help.textContent=(awaitingDraw?'Los cruces se definirán en el sorteo.':'Los nombres y los cruces son ilustrativos.')+
    (reduced?` Se muestran 5 de ${draw.rounds.length} rondas.`:'');
  root.replaceChildren(help,section);
  cleanups.set(root,cleanup);
  return cleanup;
}
