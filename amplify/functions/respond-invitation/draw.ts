// Sorteo del servidor: se persiste una sola vez al completar las confirmaciones.
import { randomInt } from 'node:crypto';
import {buildBracket,type Player} from '../../../shared/tournament-bracket';
export function createDraw(tournament: any, fixedOrder?: Player[]) {
  const players: Player[] = fixedOrder || tournament.participantIds.map((id: string,i: number) => ({ id, name: tournament.participantNames[i] }));
  for (let i = fixedOrder ? 0 : players.length - 1; i > 0; i--) { const j = randomInt(i + 1); [players[i],players[j]] = [players[j],players[i]]; }
  return JSON.stringify({ version:1, createdAt:new Date().toISOString(), ...buildBracket(tournament.format,players) }, (key,value) => (key === 'left' || key === 'right') && value?.id && value?.name ? { playerId:value.id } : value);
}
