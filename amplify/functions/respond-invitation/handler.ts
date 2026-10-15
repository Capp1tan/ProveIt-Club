// Sólo el destinatario autenticado puede responder. La transacción evita respuestas parciales.
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));
export const handler = async (event: { identity?: { sub?: string }; arguments: { invitationId: string; accept: boolean } }) => {
  const sub = event.identity?.sub;
  const { invitationId, accept } = event.arguments;
  if (!sub || typeof invitationId !== 'string' || invitationId.length > 200 || typeof accept !== 'boolean') throw new Error('Respuesta inválida.');
  const TableName = process.env.INVITATION_TABLE_NAME!;
  const read = () => db.send(new GetCommand({ TableName, Key: { id: invitationId }, ConsistentRead: true }));
  const invitation = (await read()).Item;
  if (!invitation || invitation.recipientSub !== sub) throw new Error('Esta invitación no te pertenece.');
  const status = accept ? 'ACCEPTED' : 'REJECTED';
  if (invitation.status !== 'PENDING') {
    if (invitation.status === status) return invitation;
    throw new Error('Ya respondiste esta invitación.');
  }
  const index = invitation.rosterIndex;
  if (!Number.isInteger(index) || index < 0 || index > 80) throw new Error('Invitación inválida.');
  const now = new Date().toISOString();
  try {
    await db.send(new TransactWriteCommand({ TransactItems: [
      { Update: { TableName, Key: { id: invitationId },
        UpdateExpression: 'SET #status = :status, updatedAt = :now',
        ConditionExpression: 'recipientSub = :sub AND #status = :pending',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: { ':status': status, ':now': now, ':sub': sub, ':pending': 'PENDING' } } },
      { Update: { TableName: process.env.TOURNAMENT_TABLE_NAME!, Key: { id: invitation.tournamentId },
        UpdateExpression: 'SET rosterStatuses[' + index + '] = :status, updatedAt = :now',
        ConditionExpression: 'attribute_exists(id) AND rosterStatuses[' + index + '] = :pending',
        ExpressionAttributeValues: { ':status': status, ':now': now, ':pending': 'PENDING' } } },
    ] }));
  } catch (error) {
    if ((error as Error).name !== 'TransactionCanceledException') throw error;
    const latest = (await read()).Item;
    if (latest?.recipientSub === sub && latest.status === status) return latest;
    throw new Error('La invitación cambió. Actualizá las notificaciones y volvé a intentar.');
  }
  return { ...invitation, status, updatedAt: now };
};
