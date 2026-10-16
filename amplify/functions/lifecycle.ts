// Las bajas se comprueban también en el servidor: ocultar un botón no da seguridad.
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
