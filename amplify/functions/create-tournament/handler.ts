// Esta función es la puerta de escritura. Las reglas se comprueban en AWS,
// aunque alguien intente saltarse el formulario del navegador.
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';

import { read,fee,creationExemption,assertBillingAccess,ensureCheckout,publicCheckout } from '../billing/common';
import { phoneOptional, assertActiveAccount } from '../lifecycle';
import { validateCover } from '../tournament-cover';

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const formats = new Set(['DUEL', 'ROUND_ROBIN', 'SINGLE_ELIMINATION', 'DOUBLE_ELIMINATION', 'SWISS', 'FREE_FOR_ALL']);
type Arguments = {
  tournamentId: string; name: string; activity: string; format: string;
  description?: string | null; conflicts?:string; participantIds: string[]; judgeIds: string[];
  overview?:string;coverPath?:string;participantLimit?:number;prizeExpected?:boolean;
  treasurerId?: string | null;
  arbitrationMode: string; startsAt: string; timeZone: string; acceptOrganizerDecision?: boolean;
};
export const handler = async (event: { arguments: Arguments; identity?: { sub?: string } }) => {
  const sub = event.identity?.sub;
  if (!sub) throw new Error('Iniciá sesión para crear un torneo.');
  await assertActiveAccount(sub);
  const args = event.arguments;
  await assertBillingAccess(sub);
  if (/^[0-9a-f-]{36}$/i.test(args.tournamentId || '')) {
    const previous=await read('PAYMENT_TABLE_NAME',args.tournamentId);
    if(previous)return ensureCheckout(previous,sub);
    if(await read('TOURNAMENT_TABLE_NAME',args.tournamentId))throw new Error('Ese identificador ya corresponde a un torneo. Abrí un nuevo formulario.');
  }
  const pricing=await fee();
  if(!pricing.enabled)throw new Error('La creación de torneos está pausada temporalmente.');
  const text = (value: unknown, min: number, max: number, label: string) => {
    if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max) {
      throw new Error(`${label}: usá entre ${min} y ${max} caracteres.`);
    }
    return value.trim();
  };
  if (!['ORGANIZER','JUDGES'].includes(args.arbitrationMode)) throw new Error('Elegí si el torneo tendrá juez.');
  const noJudge = args.arbitrationMode === 'ORGANIZER';
  if (noJudge && args.acceptOrganizerDecision !== true) throw new Error('Aceptá explícitamente la condición de torneo sin juez.');
  const timestamp = Date.parse(args.startsAt);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString() !== args.startsAt || timestamp <= Date.now()) throw new Error('Elegí una fecha y hora futuras válidas.');
  if (typeof args.timeZone !== 'string' || args.timeZone.length > 80) throw new Error('Zona horaria inválida.');
  try { new Intl.DateTimeFormat('es', { timeZone: args.timeZone }).format(new Date(timestamp)); }
  catch { throw new Error('Elegí una zona horaria válida.'); }
  const name = text(args.name, 3, 80, 'Nombre');
  const activity = text(args.activity, 2, 80, 'Actividad');
  const description = text(args.description ?? '',10,1000,'Reglas');
  const overview=text(args.overview ?? '',0,500,'Descripción');
  const conflicts=text(args.conflicts ?? '',0,500,'Conflictos de interés');
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
  const participantLimit=args.participantLimit ?? participantIds.length;
  if(!Number.isInteger(participantLimit) || participantLimit<2 || participantLimit>64 || participantLimit!==participantIds.length)throw new Error('Completá todas las invitaciones del cupo elegido.');
  if(args.prizeExpected!==undefined && typeof args.prizeExpected!=='boolean')throw new Error('Indicá si se prevé un premio.');
  if (args.format === 'DUEL' && participantIds.length !== 2) throw new Error('El Duelo 1v1 requiere exactamente dos participantes.');
  const judgeIds = ids(args.judgeIds, noJudge ? 0 : 1, 16, 'Jueces');
  if (noJudge && judgeIds.length) throw new Error('Un torneo sin juez no puede tener jueces seleccionados.');
  if(args.treasurerId)throw new Error('El juez también coordina el dinero. Actualizá el formulario para crear el torneo.');
  const treasurerId = null;
  const allIds = [...participantIds, ...judgeIds, ...(treasurerId ? ids([treasurerId], 1, 1, 'Tesorero') : [])];
  if (new Set(participantIds).size !== participantIds.length || new Set(judgeIds).size !== judgeIds.length) throw new Error('Cada persona debe tener un único rol en este torneo.');
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
  if(profiles.some((p,i)=>i<participantIds.length && profiles.slice(0,i).some(q=>q.owner.split('::')[0]===p.owner.split('::')[0])) || profiles.some((p,i)=>i>=participantIds.length && profiles.slice(participantIds.length,i).some(q=>q.owner.split('::')[0]===p.owner.split('::')[0])))throw new Error('No se puede repetir una cuenta dentro del mismo rol.');
  if(profiles.slice(participantIds.length).some(p=>!p.judgeEnabled))throw new Error('Un juez seleccionado no habilitó el rol en su perfil.');
  const hasDual=judgeIds.some(id=>participantIds.includes(id));
  const declaration=[hasDual?'Un juez también participa en el torneo.':'',conflicts].filter(Boolean).join(' ');
  for (const accountSub of new Set([sub, ...owners])) {
    const account = (await db.send(new GetCommand({ TableName: process.env.ACCOUNT_TABLE_NAME!, Key: { id: accountSub }, ConsistentRead: true }))).Item;
    if (!account?.phoneNumber && !await phoneOptional(accountSub)) throw new Error('Todos los integrantes y el organizador deben completar su teléfono en Mi perfil.');
  }
  const names = new Map(profiles.map(profile => [profile.id, profile.nickname]));
  const coverPath=await validateCover(args.coverPath,sub,args.tournamentId);
  const now = new Date().toISOString();
  const item = {
    id: args.tournamentId, termsVersion:1,conflicts:declaration,clubRewards:false,name, activity, description, format: args.format,
    overview,coverPath,participantLimit,prizeExpected:args.prizeExpected ?? false,
    participantIds, participantNames: participantIds.map(id => names.get(id)),
    judgeIds, judgeNames: judgeIds.map(id => names.get(id)),
    treasurerId, treasurerName: treasurerId ? names.get(treasurerId) : null,
    arbitrationMode: args.arbitrationMode, startsAt: args.startsAt, timeZone: args.timeZone,
    consentVersion: noJudge ? 'NO_JUDGE_V1' : null, organizerConsentAt: noJudge ? now : null,
    createdBySub: sub, status: 'AWAITING_RESPONSES', membershipRevision: 0,
    rosterStatuses: owners.map(() => 'PENDING'), createdAt: now, updatedAt: now,
    __typename: 'Tournament',
  };
    const invites = profiles.map((profile, index) => ({
      id: args.tournamentId + ':' + index,termsVersion:1,conflictsSnapshot:declaration,
      tournamentId: args.tournamentId, tournamentName: name,
      recipientSub: owners[index], profileId: profile.id, rosterIndex: index,
      role: index < participantIds.length ? 'PARTICIPANT' : index < participantIds.length + judgeIds.length ? 'JUDGE' : 'TREASURER',
      status:'PENDING',
      arbitrationMode: args.arbitrationMode, startsAt: args.startsAt, timeZone: args.timeZone,
      rulesSnapshot: description+(args.prizeExpected?'\nPremio previsto: pendiente de definición y confirmación por el responsable. No está disponible todavía.':''), consentVersion: noJudge ? 'NO_JUDGE_V1' : null,
      consentAcceptedAt:null,
      invitedBySub: sub, createdAt: now, updatedAt: now, __typename: 'TournamentInvitation',
    }));
  const exemption=await creationExemption(sub);
  if(exemption.enabled){
    // Sin cobro ni preferencia de Mercado Pago. Se publica todo de forma atómica.
    // La revisión impide crear gratis con un permiso revocado durante la petición.
    const claim=exemption.source==='CREATOR'
      ? {Key:{id:'creator'},ConditionExpression:'accountSub=:sub',ExpressionAttributeValues:{':sub':sub}}
      : {Key:{id:'creation-exempt:'+sub},ConditionExpression:'#enabled=:yes AND revision=:rev AND accountSub=:sub',ExpressionAttributeNames:{'#enabled':'enabled'},ExpressionAttributeValues:{':yes':true,':rev':exemption.revision,':sub':sub}};
    const receipt={id:args.tournamentId,createdBySub:sub,tournamentName:name,status:'EXEMPT',amountCents:0,currency:'ARS',paymentMode:pricing.mode,
      exemptionSource:exemption.source,exemptionRevision:exemption.revision,expiresAt:args.startsAt,createdAt:now,updatedAt:now,__typename:'TournamentPayment'};
    try{await db.send(new TransactWriteCommand({TransactItems:[
      {ConditionCheck:{TableName:process.env.CLAIM_TABLE_NAME!,Key:{id:'deleted-account:'+sub},ConditionExpression:'attribute_not_exists(id)'}},
      {ConditionCheck:{TableName:process.env.CLAIM_TABLE_NAME!,...claim}},
      {Put:{TableName:process.env.PAYMENT_TABLE_NAME!,Item:receipt,ConditionExpression:'attribute_not_exists(id)'}},
      {Put:{TableName:tournamentTable,Item:{...item,creationPaymentStatus:'EXEMPT',paymentMode:pricing.mode},ConditionExpression:'attribute_not_exists(id)'}},
      ...invites.map(invite=>({Put:{TableName:process.env.INVITATION_TABLE_NAME!,Item:invite,ConditionExpression:'attribute_not_exists(id)'}})),
    ]}));}catch(error){
      if((error as Error).name!=='TransactionCanceledException')throw error;
      await assertActiveAccount(sub);
      const previous=await read('PAYMENT_TABLE_NAME',args.tournamentId);
      if(previous)return ensureCheckout(previous,sub);
      throw new Error('El permiso cambió o no pudimos crear el torneo. Actualizá la conexión antes de reintentar.');
    }
    return publicCheckout(receipt);
  }
  // El borrador es privado. No existen torneo ni invitaciones antes del pago.
  const request={id:args.tournamentId,createdBySub:sub,tournamentName:name,status:'PENDING',amountCents:pricing.amountCents,currency:'ARS',paymentMode:pricing.mode,
    payload:JSON.stringify({tournament:item,invites}),expiresAt:new Date(Math.min(Date.now()+30*60*1000,timestamp)).toISOString(),createdAt:now,updatedAt:now,__typename:'TournamentPayment'};
  try {await db.send(new TransactWriteCommand({TransactItems:[
    {ConditionCheck:{TableName:process.env.CLAIM_TABLE_NAME!,Key:{id:'deleted-account:'+sub},ConditionExpression:'attribute_not_exists(id)'}},
    {Put:{TableName:process.env.PAYMENT_TABLE_NAME!,Item:request,ConditionExpression:'attribute_not_exists(id)'}},
  ]}));}
  catch(error){
    if((error as Error).name!=='TransactionCanceledException')throw error;
    await assertActiveAccount(sub);
    const previous=await read('PAYMENT_TABLE_NAME',args.tournamentId);
    if(!previous)throw new Error('No pudimos preparar la solicitud. Reintentá.');
    return ensureCheckout(previous,sub);
  }
  return ensureCheckout(request,sub);
};
