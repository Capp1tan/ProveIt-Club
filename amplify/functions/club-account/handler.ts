// Las reservas privadas y el perfil se modifican en una sola transacción.
import { createHash } from 'node:crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, DeleteCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { CognitoIdentityProviderClient, AdminGetUserCommand } from '@aws-sdk/client-cognito-identity-provider';
import { parsePhoneNumberFromString } from 'libphonenumber-js/max';
const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const cognito = new CognitoIdentityProviderClient({});
const table = (key: string) => process.env[key]!;
const get = async (key: string, id: string) => (await db.send(new GetCommand({ TableName: table(key), Key: { id }, ConsistentRead: true }))).Item;
const phoneKey = (phone: string) => 'phone:' + createHash('sha256').update(phone).digest('hex');
type Event = { arguments?: Record<string, any> | null; fieldName?: string; info?: { fieldName: string }; identity?: { sub?: string; username?: string; claims?: Record<string, any> } };
export const handler = async (event: Event) => {
  const sub = event.identity?.sub;
  if (!sub) throw new Error('Iniciá sesión para continuar.');
  const args = event.arguments || {};
  // Amplify puede enviar fieldName en el nivel superior, sin `info`.
  // Los argumentos de las tres operaciones son distintos; el fallback también
  // admite el formato reducido del resolver sin confiar en datos de identidad.
  const operation = event.fieldName || event.info?.fieldName ||
    ('phoneNumber' in args ? 'saveClubProfile' : 'enabled' in args ? 'manageClubBadge' : 'initializeClubAccess');
  const now = new Date().toISOString();
  if (operation === 'initializeClubAccess') {
    let claim = await get('CLAIM_TABLE_NAME', 'creator');
    if (!claim) {
      // Consultamos Cognito: no confiamos en un correo enviado por el navegador.
      const user = await cognito.send(new AdminGetUserCommand({ UserPoolId: process.env.USER_POOL_ID, Username: event.identity!.username || sub }));
      const attributes = Object.fromEntries((user.UserAttributes || []).map(item => [item.Name!, item.Value]));
      if (attributes.sub !== sub || attributes.email_verified !== 'true' || attributes.email?.toLowerCase() !== 'leorivero744@gmail.com') return { isCreator: false };
      try {
        await db.send(new PutCommand({ TableName: table('CLAIM_TABLE_NAME'), Item: { id: 'creator', accountSub: sub, createdAt: now, updatedAt: now, __typename: 'UniqueClaim' }, ConditionExpression: 'attribute_not_exists(id)' }));
      } catch (error) { if ((error as Error).name !== 'ConditionalCheckFailedException') throw error; }
      claim = await get('CLAIM_TABLE_NAME', 'creator');
    }
    const isCreator = claim?.accountSub === sub;
    if (isCreator) await db.send(new PutCommand({ TableName: table('BADGE_TABLE_NAME'), Item: { id: 'CREATOR:' + sub, accountSub: sub, code: 'CREATOR', createdAt: now, updatedAt: now, __typename: 'ClubBadge' } }));
    return { isCreator };
  }
  if (operation === 'manageClubBadge') {
    const creator = await get('CLAIM_TABLE_NAME', 'creator');
    if (creator?.accountSub !== sub) throw new Error('Sólo el Creador puede administrar insignias.');
    if (args.code !== 'BETA_TESTER') throw new Error('Esta insignia está reservada.');
    const profile = await get('PROFILE_TABLE_NAME', args.profileId);
    const accountSub = profile?.owner?.split('::')[0];
    if (!accountSub) throw new Error('Perfil no encontrado.');
    const item = { id: 'BETA_TESTER:' + accountSub, accountSub, code: 'BETA_TESTER', createdAt: now, updatedAt: now, __typename: 'ClubBadge' };
    if (args.enabled) await db.send(new PutCommand({ TableName: table('BADGE_TABLE_NAME'), Item: item }));
    else await db.send(new DeleteCommand({ TableName: table('BADGE_TABLE_NAME'), Key: { id: item.id } }));
    return { isCreator: true };
  }
  if (operation !== 'saveClubProfile') throw new Error('Operación inválida.');
  const nickname = String(args.nickname || '').trim();
  const bio = String(args.bio || '').trim();
  const avatarPath = String(args.avatarPath || '');
  if (nickname.length < 3 || nickname.length > 24 || bio.length > 200) throw new Error('Revisá el nick (3–24 caracteres) y la biografía (máximo 200).');
  if (avatarPath && (!avatarPath.startsWith('profile-pictures/') || avatarPath.length > 1024)) throw new Error('Foto inválida.');
  const raw = String(args.phoneNumber || '').trim();
  const phone = raw.startsWith('+') ? parsePhoneNumberFromString(raw) : undefined;
  if (!phone?.isValid() || phone.ext) throw new Error('Ingresá un teléfono válido con + y código de país. Ejemplo: +54 9 11 2345 6789.');
  const id = args.profileId || sub;
  const existing = await get('PROFILE_TABLE_NAME', id);
  if (existing && existing.owner?.split('::')[0] !== sub) throw new Error('No podés editar este perfil.');
  const account = await get('ACCOUNT_TABLE_NAME', sub);
  const revision = account?.revision || 0;
  const item = { ...existing, id, nickname, bio, avatarPath, accountComplete: true, owner: existing?.owner || sub + '::' + event.identity!.username, createdAt: existing?.createdAt || now, updatedAt: now, __typename: 'Profile' };
  const newClaim = phoneKey(phone.number);
  const transactions: any[] = [
    { Put: { TableName: table('CLAIM_TABLE_NAME'), Item: { id: newClaim, accountSub: sub, createdAt: now, updatedAt: now, __typename: 'UniqueClaim' }, ConditionExpression: 'attribute_not_exists(id) OR accountSub = :sub', ExpressionAttributeValues: { ':sub': sub } } },
    { Put: { TableName: table('ACCOUNT_TABLE_NAME'), Item: { id: sub, accountSub: sub, phoneNumber: phone.number, phoneVerified: false, revision: revision + 1, createdAt: account?.createdAt || now, updatedAt: now, __typename: 'PrivateAccount' }, ConditionExpression: account ? 'revision = :revision' : 'attribute_not_exists(id)', ...(account ? { ExpressionAttributeValues: { ':revision': revision } } : {}) } },
    { Put: { TableName: table('PROFILE_TABLE_NAME'), Item: item, ConditionExpression: existing ? '#owner = :owner' : 'attribute_not_exists(id)', ...(existing ? { ExpressionAttributeNames: { '#owner': 'owner' }, ExpressionAttributeValues: { ':owner': existing.owner } } : {}) } },
  ];
  if (account?.phoneNumber && account.phoneNumber !== phone.number) transactions.push({ Delete: { TableName: table('CLAIM_TABLE_NAME'), Key: { id: phoneKey(account.phoneNumber) }, ConditionExpression: 'accountSub = :sub', ExpressionAttributeValues: { ':sub': sub } } });
  try { await db.send(new TransactWriteCommand({ TransactItems: transactions })); }
  catch (error) {
    if ((error as Error).name !== 'TransactionCanceledException') throw error;
    const reservation = await get('CLAIM_TABLE_NAME', newClaim);
    if (reservation && reservation.accountSub !== sub) throw new Error('Ese teléfono ya está asociado a otra cuenta.');
    throw new Error('El perfil cambió durante el guardado. Recargá y volvé a intentarlo.');
  }
  return item;
};
