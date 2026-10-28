// Las bajas se comprueban también en el servidor: ocultar un botón no da seguridad.
import { roomIsClosed } from '../../shared/tournament-room';
export {roomDeadline,roomIsClosed} from '../../shared/tournament-room';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));
export async function assertActiveAccount(sub: string) {
  const row = (await db.send(new GetCommand({ TableName: process.env.CLAIM_TABLE_NAME!, Key: { id: 'deleted-account:' + sub }, ConsistentRead: true }))).Item;
  if (row) throw new Error('Esta cuenta fue eliminada o está completando su baja.');
}
export function assertActiveTournament(row: any) {
  if (!row || row.deletedAt || row.status === 'DELETED') throw new Error('Este torneo fue eliminado o ya no está disponible.');
}

// Excepción privada asignada por el Creador al sub inmutable de Cognito.
export async function phoneOptional(sub:string){return Boolean((await db.send(new GetCommand({TableName:process.env.CLAIM_TABLE_NAME!,Key:{id:'phone-optional:'+sub},ConsistentRead:true}))).Item);}

export function assertOpenTournamentRoom(row:any,now=Date.now()){assertActiveTournament(row);if(roomIsClosed(row,now))throw new Error('La sala de este torneo ya cerró. El resultado se conserva en el historial.');}
