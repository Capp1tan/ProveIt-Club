// Esta función es la puerta de escritura. Las reglas se comprueban en AWS,
// aunque alguien intente saltarse el formulario del navegador.
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const formats = new Set(['DUEL', 'ROUND_ROBIN', 'SINGLE_ELIMINATION', 'DOUBLE_ELIMINATION', 'SWISS', 'FREE_FOR_ALL']);
type Arguments = {
  tournamentId: string; name: string; activity: string; format: string;
  description?: string | null; participantIds: string[]; judgeIds: string[];
  treasurerId?: string | null;
};
export const handler = async (event: { arguments: Arguments; identity?: { sub?: string } }) => {
  const sub = event.identity?.sub;
  if (!sub) throw new Error('Iniciá sesión para crear un torneo.');
  const args = event.arguments;
  const text = (value: unknown, min: number, max: number, label: string) => {
    if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max) {
      throw new Error(`${label}: usá entre ${min} y ${max} caracteres.`);
    }
    return value.trim();
  };
  const name = text(args.name, 3, 80, 'Nombre');
  const activity = text(args.activity, 2, 80, 'Actividad');
  const description = text(args.description ?? '', 0, 1000, 'Descripción');
  if (!formats.has(args.format)) throw new Error('Elegí un formato válido.');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(args.tournamentId)) {
    throw new Error('Identificador de torneo inválido.');
  }
  const ids = (value: unknown, min: number, max: number, label: string): string[] => {
    if (!Array.isArray(value) || value.length < min || value.length > max || value.some(id => typeof id !== 'string' || !id || id.length > 128)) {
      throw new Error(`${label}: seleccioná entre ${min} y ${max} cuentas.`);
    }
    return value;
  };
  const participantIds = ids(args.participantIds, 2, 64, 'Participantes');
  if (args.format === 'DUEL' && participantIds.length !== 2) throw new Error('El Duelo 1v1 requiere exactamente dos participantes.');
  const judgeIds = ids(args.judgeIds, 1, 16, 'Jueces');
  const treasurerId = args.treasurerId || null;
  const allIds = [...participantIds, ...judgeIds, ...(treasurerId ? ids([treasurerId], 1, 1, 'Tesorero') : [])];
  if (new Set(allIds).size !== allIds.length) throw new Error('Cada persona debe tener un único rol en este torneo.');
  const profileTable = process.env.PROFILE_TABLE_NAME!;
  const tournamentTable = process.env.TOURNAMENT_TABLE_NAME!;
  // Lecturas consistentes por ID: no se aceptan nombres escritos a mano.
  const profiles = await Promise.all(allIds.map(async id => {
    const result = await db.send(new GetCommand({ TableName: profileTable, Key: { id }, ConsistentRead: true }));
    const profile = result.Item;
    if (!profile?.nickname || typeof profile.owner !== 'string') throw new Error('Una cuenta seleccionada ya no tiene un perfil válido. Actualizá la lista.');
    return profile;
  }));
  const owners = profiles.map(profile => profile.owner.split('::')[0]);
  if (new Set(owners).size !== owners.length) throw new Error('Una misma cuenta no puede ocupar varios lugares ni roles.');
  const names = new Map(profiles.map(profile => [profile.id, profile.nickname]));
  const now = new Date().toISOString();
  const item = {
    id: args.tournamentId, name, activity, description, format: args.format,
    participantIds, participantNames: participantIds.map(id => names.get(id)),
    judgeIds, judgeNames: judgeIds.map(id => names.get(id)),
    treasurerId, treasurerName: treasurerId ? names.get(treasurerId) : null,
    createdBySub: sub, status: 'CREATED', createdAt: now, updatedAt: now,
    __typename: 'Tournament',
  };
  try {
    // El ID se conserva al reintentar: evita duplicados ante un corte de conexión.
    await db.send(new PutCommand({ TableName: tournamentTable, Item: item, ConditionExpression: 'attribute_not_exists(id)' }));
    return item;
  } catch (error) {
    if ((error as Error).name !== 'ConditionalCheckFailedException') throw error;
    const existing = await db.send(new GetCommand({ TableName: tournamentTable, Key: { id: args.tournamentId }, ConsistentRead: true }));
    if (existing.Item?.createdBySub === sub) return existing.Item;
    throw new Error('No se pudo guardar el torneo. Volvé a cargar la página.');
  }
};

