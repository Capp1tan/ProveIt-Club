// Las reservas privadas y el perfil se modifican en una sola transacción.
import {S3Client,HeadObjectCommand} from '@aws-sdk/client-s3';
import { createHash } from 'node:crypto';
import { assertActiveAccount, phoneOptional } from '../lifecycle';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, GetCommand, PutCommand, DeleteCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
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
    ('phoneOptional' in args ? 'setClubPhoneOptional' : 'phoneNumber' in args ? 'saveClubProfile' : 'enabled' in args ? 'manageClubBadge' : 'initializeClubAccess');
  // Consultar el estado permite retomar una baja interrumpida desde Mi perfil.
  if(operation==='initializeClubAccess' && await get('CLAIM_TABLE_NAME','deleted-account:'+sub))return {isCreator:false};
  await assertActiveAccount(sub);
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
    if (isCreator) await db.send(new PutCommand({ TableName: table('BADGE_TABLE_NAME'), Item: { id: 'CREATOR:' + sub, accountSub: sub, accountUsername: event.identity!.username || event.identity!.claims?.['cognito:username'] || sub, code: 'CREATOR', createdAt: now, updatedAt: now, __typename: 'ClubBadge' } }));
    return { isCreator, phoneOptional:await phoneOptional(sub) };
  }
  if(operation==='setClubPhoneOptional') {
    if((await get('CLAIM_TABLE_NAME','creator'))?.accountSub!==sub)throw new Error('Sólo el Creador puede cambiar esta excepción.');
    const profile=await get('PROFILE_TABLE_NAME',args.profileId),target=profile?.owner?.split('::')[0];
    if(!target || typeof args.phoneOptional!=='boolean')throw new Error('Cuenta inválida.');
    const Key={id:'phone-optional:'+target};
    if(args.phoneOptional) {
      await db.send(new PutCommand({TableName:table('CLAIM_TABLE_NAME'),Item:{...Key,accountSub:target,createdAt:now,updatedAt:now,__typename:'UniqueClaim'}}));
      // El perfil ya existente puede participar aunque no tenga teléfono.
      if(!profile.accountComplete)await db.send(new PutCommand({TableName:table('PROFILE_TABLE_NAME'),Item:{...profile,accountComplete:true,updatedAt:now},ConditionExpression:'#owner=:owner',ExpressionAttributeNames:{'#owner':'owner'},ExpressionAttributeValues:{':owner':profile.owner}}));
    } else await db.send(new DeleteCommand({TableName:table('CLAIM_TABLE_NAME'),Key}));
    return {isCreator:true,phoneOptional:await phoneOptional(sub)};
  }
  if (operation === 'manageClubBadge') {
    const creator = await get('CLAIM_TABLE_NAME', 'creator');
    if (creator?.accountSub !== sub) throw new Error('Sólo el Creador puede administrar insignias.');
    if (!['BETA_TESTER','VERIFIED'].includes(args.code)) throw new Error('Esta insignia está reservada.');
    const profile = await get('PROFILE_TABLE_NAME', args.profileId);
    const accountSub = profile?.owner?.split('::')[0];
    if (!accountSub) throw new Error('Perfil no encontrado.');
    // AppSync devuelve owner como username; el permiso de administración usa
    // siempre el sub de Cognito. El alias sólo sirve para mostrar la insignia.
    const accountUsername = profile.owner.split('::')[1] || accountSub;
    const item = { id: args.code+':' + accountSub, accountSub, accountUsername, code: args.code, createdAt: now, updatedAt: now, __typename: 'ClubBadge' };
    if (args.enabled) await db.send(new PutCommand({ TableName: table('BADGE_TABLE_NAME'), Item: item }));
    else await db.send(new DeleteCommand({ TableName: table('BADGE_TABLE_NAME'), Key: { id: item.id } }));
    return { isCreator: true };
  }
  if (operation !== 'saveClubProfile') throw new Error('Operación inválida.');
  const identity=await cognito.send(new AdminGetUserCommand({UserPoolId:process.env.USER_POOL_ID,Username:event.identity!.username || sub}));
  const identityAttrs=Object.fromEntries((identity.UserAttributes || []).map(a=>[a.Name,a.Value]));
  if(identityAttrs.sub!==sub || identityAttrs.email_verified!=='true')throw new Error('Verificá tu correo antes de completar el perfil.');
  const nickname = String(args.nickname || '').trim();
  const bio = String(args.bio || '').trim();
  const avatarPath = String(args.avatarPath || '');
  if (nickname.length < 3 || nickname.length > 24 || bio.length > 200) throw new Error('Revisá el nick (3–24 caracteres) y la biografía (máximo 200).');
  if (avatarPath && (!(avatarPath.startsWith('profile-pictures/') || avatarPath.startsWith('profile-private/')) || avatarPath.length > 1024)) throw new Error('Foto inválida.');
  const raw = String(args.phoneNumber || '').trim();
  const phone = raw.startsWith('+') ? parsePhoneNumberFromString(raw) : undefined;
  const optional=await phoneOptional(sub);
  if ((!raw && !optional) || (raw && (!phone?.isValid() || phone.ext))) throw new Error('Ingresá un teléfono válido con + y código de país. Ejemplo: +54 9 11 2345 6789.');
  const id = args.profileId || sub;
  const existing = await get('PROFILE_TABLE_NAME', id);
  if (existing && existing.owner?.split('::')[0] !== sub) throw new Error('No podés editar este perfil.');
  const account = await get('ACCOUNT_TABLE_NAME', sub);
  const revision = account?.revision || 0;
  const visibility=args.visibility==='PUBLIC'?'PUBLIC':'PRIVATE';
  const judgeEnabled=args.judgeEnabled===true;
  let links:any;try{links=JSON.parse(args.socialLinks || '{}');}catch{throw new Error('Redes inválidas.');}
  const allowed:Record<string,string[] | null>={instagram:['instagram.com','www.instagram.com'],twitch:['twitch.tv','www.twitch.tv'],discord:['discord.com','discord.gg','www.discord.com'],custom:null};
  const socialLinks:Record<string,string>={};
  if(!links || Array.isArray(links) || typeof links!=='object')throw new Error('Redes inválidas.');
  for(const [key,raw] of Object.entries(links)){
   if(!(key in allowed) || typeof raw!=='string' || raw.length>500)throw new Error('Red social inválida.');if(!raw.trim())continue;
   if(key==='discord' && !raw.includes('://')){if(!/^[a-zA-Z0-9_.]{2,32}$/.test(raw))throw new Error('Usuario de Discord inválido.');socialLinks[key]=raw;continue;}
   let u:URL;try{u=new URL(raw);}catch{throw new Error('Usá enlaces completos con https://.');}
   if(u.protocol!=='https:' || u.username || u.password || (allowed[key] && !allowed[key]!.includes(u.hostname)))throw new Error('Revisá el dominio del enlace.');
   socialLinks[key]=u.href;
  }
  if(avatarPath && avatarPath!==existing?.avatarPath){
   if(!avatarPath.startsWith('profile-private/'+sub+'/'))throw new Error('La foto no pertenece a tu cuenta. Volvé a subirla.');
   const h=await new S3Client({}).send(new HeadObjectCommand({Bucket:process.env.PROFILE_BUCKET_NAME,Key:avatarPath}));
   if(!['image/jpeg','image/png','image/webp'].includes(h.ContentType || '') || !h.ContentLength || h.ContentLength>2097152)throw new Error('Foto inválida o mayor a 2 MB.');
  }
  const nickClaim='nickname:'+createHash('sha256').update(nickname.normalize('NFKC').toLocaleLowerCase('es')).digest('hex');
  // También comprobar nicks anteriores a las reservas de 3.0.
  let scanKey;
  do{const page=await db.send(new ScanCommand({TableName:table('PROFILE_TABLE_NAME'),ProjectionExpression:'id,nickname',ExclusiveStartKey:scanKey}));if(page.Items?.some(p=>p.id!==id && p.nickname?.normalize('NFKC').toLocaleLowerCase('es')===nickname.normalize('NFKC').toLocaleLowerCase('es')))throw new Error('Ese nick ya está en uso.');scanKey=page.LastEvaluatedKey;}while(scanKey);
  const item = { ...existing, id, visibility,socialLinks:JSON.stringify(socialLinks),judgeEnabled,nickname, bio, avatarPath, accountComplete: true, owner: existing?.owner || sub + '::' + event.identity!.username, createdAt: existing?.createdAt || now, updatedAt: now, __typename: 'Profile' };
  const number=phone?.number || "";
  const newClaim = number ? phoneKey(number) : null;
  const transactions: any[] = [
    {Put:{TableName:table('CLAIM_TABLE_NAME'),Item:{id:nickClaim,accountSub:sub,createdAt:now,updatedAt:now,__typename:'UniqueClaim'},ConditionExpression:'attribute_not_exists(id) OR accountSub=:sub',ExpressionAttributeValues:{':sub':sub}}},
    { ConditionCheck: { TableName: table('CLAIM_TABLE_NAME'), Key: { id: 'deleted-account:' + sub }, ConditionExpression: 'attribute_not_exists(id)' } },
    ...(newClaim ? [{ Put: { TableName: table('CLAIM_TABLE_NAME'), Item: { id: newClaim, accountSub: sub, createdAt: now, updatedAt: now, __typename: 'UniqueClaim' }, ConditionExpression: 'attribute_not_exists(id) OR accountSub = :sub', ExpressionAttributeValues: { ':sub': sub } } }] : []),
    { Put: { TableName: table('ACCOUNT_TABLE_NAME'), Item: { id: sub, accountSub: sub, phoneNumber: number, phoneVerified: false, revision: revision + 1, createdAt: account?.createdAt || now, updatedAt: now, __typename: 'PrivateAccount' }, ConditionExpression: account ? 'revision = :revision' : 'attribute_not_exists(id)', ...(account ? { ExpressionAttributeValues: { ':revision': revision } } : {}) } },
    { Put: { TableName: table('PROFILE_TABLE_NAME'), Item: item, ConditionExpression: existing ? '#owner = :owner' : 'attribute_not_exists(id)', ...(existing ? { ExpressionAttributeNames: { '#owner': 'owner' }, ExpressionAttributeValues: { ':owner': existing.owner } } : {}) } },
  ];
  if (account?.phoneNumber && account.phoneNumber !== number) transactions.push({ Delete: { TableName: table('CLAIM_TABLE_NAME'), Key: { id: phoneKey(account.phoneNumber) }, ConditionExpression: 'accountSub = :sub', ExpressionAttributeValues: { ':sub': sub } } });
  try { await db.send(new TransactWriteCommand({ TransactItems: transactions })); }
  catch (error) {
    if ((error as Error).name !== 'TransactionCanceledException') throw error;
    const occupied=await get('CLAIM_TABLE_NAME',nickClaim);if(occupied && occupied.accountSub!==sub)throw new Error('Ese nick ya está en uso o reservado.');
    const reservation = newClaim ? await get('CLAIM_TABLE_NAME', newClaim) : null;
    if (reservation && reservation.accountSub !== sub) throw new Error('Ese teléfono ya está asociado a otra cuenta.');
    throw new Error('El perfil cambió durante el guardado. Recargá y volvé a intentarlo.');
  }
  return item;
};
