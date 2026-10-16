import { createHash } from 'node:crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, ScanCommand, DeleteCommand, PutCommand, UpdateCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { CognitoIdentityProviderClient, AdminGetUserCommand, AdminDeleteUserCommand } from '@aws-sdk/client-cognito-identity-provider';
import { assertActiveAccount } from '../lifecycle';
const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const cognito = new CognitoIdentityProviderClient({});
const table = (key: string) => process.env[key]!;
const read = async (key: string, id: string) => (await db.send(new GetCommand({TableName:table(key),Key:{id},ConsistentRead:true}))).Item;
async function matching(key:string, field:string, value:string, prefix=false) {
  const items:any[]=[];let cursor;
  do { const page=await db.send(new ScanCommand({TableName:table(key),ConsistentRead:true,FilterExpression:prefix?'begins_with(#field, :value)':'#field = :value',ExpressionAttributeNames:{'#field':field},ExpressionAttributeValues:{':value':value},ExclusiveStartKey:cursor}));items.push(...(page.Items || []));cursor=page.LastEvaluatedKey; } while(cursor);
  return items;
}
// Un tombstone impide que un webhook tardío vuelva a publicar el torneo.
async function retire(id:string,sub:string,admin:boolean) {
  for(let attempt=0;attempt<5;attempt++) {
  const [t,p]=await Promise.all([read('TOURNAMENT_TABLE_NAME',id),read('PAYMENT_TABLE_NAME',id)]);
  if(!t && !p)throw new Error('No encontramos ese torneo ni una solicitud de pago.');
  if(!admin && (t?.createdBySub || p?.createdBySub)!==sub)throw new Error('Sólo el organizador o el administrador puede eliminar este torneo.');
  const now=new Date().toISOString();const changes:any[]=[];
  if(t)changes.push({Update:{TableName:table('TOURNAMENT_TABLE_NAME'),Key:{id},UpdateExpression:'SET deletedAt=if_not_exists(deletedAt,:now), deletedBySub=if_not_exists(deletedBySub,:sub), #s=:deleted, updatedAt=:now, membershipRevision=if_not_exists(membershipRevision,:zero)+:one',ConditionExpression:'attribute_exists(id)',ExpressionAttributeNames:{'#s':'status'},ExpressionAttributeValues:{':now':now,':sub':sub,':deleted':'DELETED',':zero':0,':one':1}}});
  if(p)changes.push({Update:{TableName:table('PAYMENT_TABLE_NAME'),Key:{id},UpdateExpression:'SET deletedAt=if_not_exists(deletedAt,:now), updatedAt=:now',ConditionExpression:'attribute_exists(id)',ExpressionAttributeValues:{':now':now}}});
  // Si el pago publica justo ahora, volvemos a leer y retiramos también el torneo.
  if(!t)changes.push({ConditionCheck:{TableName:table('TOURNAMENT_TABLE_NAME'),Key:{id},ConditionExpression:'attribute_not_exists(id)'}});
  if(!p)changes.push({ConditionCheck:{TableName:table('PAYMENT_TABLE_NAME'),Key:{id},ConditionExpression:'attribute_not_exists(id)'}});
  try{await db.send(new TransactWriteCommand({TransactItems:changes}));return;}
  catch(error){if((error as Error).name!=='TransactionCanceledException')throw error;}
  }
  throw new Error('El torneo cambió mientras se eliminaba. Volvé a intentar.');
}
type Event={fieldName?:string;info?:{fieldName:string};arguments:Record<string,any>;identity?:{sub?:string;username?:string;claims?:Record<string,any>}};
export const handler=async(event:Event)=>{
  const sub=event.identity?.sub;if(!sub)throw new Error('Iniciá sesión.');
  const creator=await read('CLAIM_TABLE_NAME','creator');
  const admin=creator?.accountSub===sub;
  const args=event.arguments || {},operation=event.fieldName || event.info?.fieldName || (args.tournamentId?'deleteClubTournament':'deleteMyClubAccount');
  if(operation==='deleteClubTournament') {
    await assertActiveAccount(sub);
    if(typeof args.tournamentId!=='string' || !/^[0-9a-f-]{36}$/i.test(args.tournamentId))throw new Error('Identificador inválido.');
    await retire(args.tournamentId,sub,admin);return true;
  }
  if(operation!=='deleteMyClubAccount' || args.confirmation!=='ELIMINAR MI CUENTA')throw new Error('Confirmá expresamente la eliminación de tu cuenta.');
  if(admin)throw new Error('La cuenta del Creador está protegida y no se puede eliminar desde el sitio.');
  // Sólo se puede borrar la identidad que firmó esta solicitud. No aceptamos un ID ajeno.
  const username=event.identity?.username || event.identity?.claims?.['cognito:username'] || sub;
  try {
    const user=await cognito.send(new AdminGetUserCommand({UserPoolId:process.env.USER_POOL_ID,Username:username}));
    const attrs=Object.fromEntries((user.UserAttributes || []).map(a=>[a.Name!,a.Value]));
    if(attrs.sub!==sub)throw new Error('La identidad no coincide.');
    if(attrs.email?.toLowerCase()==='leorivero744@gmail.com')throw new Error('La cuenta del Creador está protegida.');
  } catch(error) {if((error as Error).name!=='UserNotFoundException')throw error;}
  const now=new Date().toISOString();
  // Permite retomar una limpieza interrumpida y bloquea escrituras con tokens viejos.
  await db.send(new PutCommand({TableName:table('CLAIM_TABLE_NAME'),Item:{id:'deleted-account:'+sub,accountSub:sub,createdAt:now,updatedAt:now,__typename:'UniqueClaim'}}));
  for(const t of await matching('TOURNAMENT_TABLE_NAME','createdBySub',sub))await retire(t.id,sub,false);
  for(const p of await matching('PAYMENT_TABLE_NAME','createdBySub',sub))if(!p.deletedAt)await retire(p.id,sub,false);
  for(const invite of await matching('INVITATION_TABLE_NAME','recipientSub',sub)) {
    // Se retira de torneos ajenos; no decide resultados ni borra los de otra persona.
    const t=await read('TOURNAMENT_TABLE_NAME',invite.tournamentId);
    if(t && !t.deletedAt && t.rosterStatuses?.[invite.rosterIndex] && !t.winnerProfileId) {
      const revision=t.membershipRevision || 0;
      const statuses=[...t.rosterStatuses];statuses[invite.rosterIndex]='REJECTED';
      await db.send(new UpdateCommand({TableName:table('TOURNAMENT_TABLE_NAME'),Key:{id:t.id},UpdateExpression:'SET rosterStatuses=:states, #s=:s, updatedAt=:now, membershipRevision=:next REMOVE #draw',ConditionExpression:'attribute_not_exists(deletedAt) AND attribute_not_exists(winnerProfileId) AND (attribute_not_exists(membershipRevision) OR membershipRevision=:previous)',ExpressionAttributeNames:{'#s':'status','#draw':'draw'},ExpressionAttributeValues:{':states':statuses,':s':'NEEDS_REPLACEMENT',':now':now,':next':revision+1,':previous':revision}}));
    }
    await db.send(new DeleteCommand({TableName:table('INVITATION_TABLE_NAME'),Key:{id:invite.id}}));
  }
  // Se eliminan perfiles, teléfono y sus reservas; los recibos e historial competitivo se conservan.
  for(const profile of await matching('PROFILE_TABLE_NAME','owner',sub+'::',true))await db.send(new DeleteCommand({TableName:table('PROFILE_TABLE_NAME'),Key:{id:profile.id}}));
  // Las cuentas antiguas pueden usar un owner sin sufijo.
  for(const profile of await matching('PROFILE_TABLE_NAME','owner',sub))await db.send(new DeleteCommand({TableName:table('PROFILE_TABLE_NAME'),Key:{id:profile.id}}));
  const account=await read('ACCOUNT_TABLE_NAME',sub);
  if(account?.phoneNumber) {
    const id='phone:'+createHash('sha256').update(account.phoneNumber).digest('hex');
    const claim=await read('CLAIM_TABLE_NAME',id);
    if(claim?.accountSub===sub)await db.send(new DeleteCommand({TableName:table('CLAIM_TABLE_NAME'),Key:{id},ConditionExpression:'accountSub=:sub',ExpressionAttributeValues:{':sub':sub}}));
  }
  await db.send(new DeleteCommand({TableName:table('ACCOUNT_TABLE_NAME'),Key:{id:sub}}));
  for(const badge of await matching('BADGE_TABLE_NAME','accountSub',sub))await db.send(new DeleteCommand({TableName:table('BADGE_TABLE_NAME'),Key:{id:badge.id}}));
  try {await cognito.send(new AdminDeleteUserCommand({UserPoolId:process.env.USER_POOL_ID,Username:username}));}
  catch(error){if((error as Error).name!=='UserNotFoundException')throw error;}
  return true;
};
