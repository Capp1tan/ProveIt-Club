// Sorteo del servidor: se persiste una sola vez al completar las confirmaciones.
import { randomInt } from 'node:crypto';
type Player = { id: string; name: string };
type Slot = Player | { source: string; outcome: 'winner' | 'loser' } | null;
type Match = { id: string; left?: Slot; right?: Slot; entrants?: Player[] };
type Round = { name: string; group: string; matches: Match[] };
export function createDraw(tournament: any, fixedOrder?: Player[]) {
  const players: Player[] = fixedOrder || tournament.participantIds.map((id: string,i: number) => ({ id, name: tournament.participantNames[i] }));
  for (let i = fixedOrder ? 0 : players.length - 1; i > 0; i--) { const j = randomInt(i + 1); [players[i],players[j]] = [players[j],players[i]]; }
  const rounds: Round[] = [];
  const pair = (slots: Slot[],prefix: string) => {
    const matches: Match[] = [];
    for (let i=0;i<slots.length;i+=2) matches.push({ id: prefix + '-' + (i/2+1), left: slots[i], right: slots[i+1] || null });
    return matches;
  };
  const advance = (match: Match, outcome: 'winner' | 'loser'): Slot => {
    if (!match.left || !match.right) return outcome === 'winner' ? (match.left || match.right || null) : null;
    return { source: match.id, outcome };
  };
  if (tournament.format === 'ROUND_ROBIN') {
    const circle: Slot[] = [...players]; if (circle.length % 2) circle.push(null);
    for (let r=0;r<circle.length-1;r++) {
      const matches: Match[] = [];
      for (let i=0;i<circle.length/2;i++) matches.push({ id: 'rr'+(r+1)+'-'+(i+1), left:circle[i],right:circle[circle.length-1-i] });
      rounds.push({ name:'Ronda '+(r+1),group:'Todos contra todos',matches });
      circle.splice(1,0,circle.pop()!);
    }
  } else if (tournament.format === 'DUEL' || tournament.format === 'SWISS') {
    rounds.push({ name:tournament.format === 'DUEL' ? 'Duelo' : 'Ronda 1',group:'Cruces',matches:pair(players,'r1') });
  } else if (tournament.format === 'FREE_FOR_ALL') {
    rounds.push({ name:'Prueba compartida',group:'Participantes',matches:[{ id:'prueba-1',entrants:players }] });
  } else {
    let size=2; while(size<players.length) size*=2;
    // Distribuir los descansos evita cruces vacíos en la primera ronda.
    const byes=size-players.length; const slots: Slot[]=[]; let p=0;
    for(let m=0;m<size/2;m++) { slots.push(players[p++]); slots.push(m<byes ? null : players[p++]); }
    const upper: Match[][]=[];
    let current=slots;
    for(let r=1;current.length>1;r++) {
      const matches=pair(current,'w'+r); upper.push(matches);
      rounds.push({ name:current.length===2 ? 'Final' : 'Ronda '+r,group:tournament.format==='DOUBLE_ELIMINATION'?'Ganadores':'Eliminación directa',matches });
      current=matches.map(match=>advance(match,'winner'));
    }
    if(tournament.format==='DOUBLE_ELIMINATION') {
      let lower: Match[]=[];
      if(upper.length>1) {
        lower=pair(upper[0].map(match=>advance(match,'loser')),'l1');
        rounds.push({name:'Ronda 1',group:'Perdedores',matches:lower});
        let lowerRound=2;
        for(let u=1;u<upper.length;u++) {
          if(u>1) {
            lower=pair(lower.map(match=>advance(match,'winner')),'l'+lowerRound);
            rounds.push({name:'Ronda '+lowerRound++,group:'Perdedores',matches:lower});
          }
          const losers=upper[u].map(match=>advance(match,'loser')).reverse();
          lower=lower.map((match,i)=>({id:'l'+lowerRound+'-'+(i+1),left:advance(match,'winner'),right:losers[i]}));
          rounds.push({name:'Ronda '+lowerRound++,group:'Perdedores',matches:lower});
        }
      }
      const final=upper[upper.length-1][0];
      rounds.push({name:'Gran final',group:'Final',matches:[{id:'gf',left:advance(final,'winner'),right:lower.length?advance(lower[0],'winner'):advance(final,'loser')}]});
    }
  }
  return JSON.stringify({ version:1, createdAt:new Date().toISOString(), order:players, format:tournament.format, rounds }, (key,value) => (key === 'left' || key === 'right') && value?.id && value?.name ? { playerId:value.id } : value);
}
