import { a, defineData, type ClientSchema } from '@aws-amplify/backend';
import { clubAccount } from '../functions/club-account/resource';
import { respondInvitation } from '../functions/respond-invitation/resource';
import { createTournament } from '../functions/create-tournament/resource';

/**
 * Perfil público solo para personas con sesión iniciada.
 * Cada usuario puede modificar su propio perfil; el correo no se almacena aquí.
 */
import { billing } from '../functions/billing/resource';
import { maintenance } from '../functions/maintenance/resource';

const schema = a.schema({
  Profile: a
    .model({
      nickname: a.string().required(),
      bio: a.string(),
      avatarPath: a.string(),
      accountComplete: a.boolean(),
    })
    .authorization((allow) => [
      allow.owner().to(['read']),
      allow.authenticated().to(['read']),
    ]),
  // El teléfono nunca se publica en Profile. Sólo su dueño puede leerlo.
  PrivateAccount: a.model({ accountSub: a.string().required(), phoneNumber: a.string().required(), phoneVerified: a.boolean().required(), revision: a.integer().required() })
    .authorization(allow => [allow.ownerDefinedIn('accountSub').identityClaim('sub').to(['read'])]),
  UniqueClaim: a.model({ accountSub: a.string().required() })
    .authorization(allow => [allow.ownerDefinedIn('accountSub').identityClaim('sub').to(['read'])]),
  ClubBadge: a.model({ accountSub: a.string().required(), accountUsername: a.string(), code: a.string().required() })
    .authorization(allow => [allow.authenticated().to(['read'])]),
  ClubAccess: a.customType({ isCreator: a.boolean().required() }),
  deleteClubTournament: a.mutation().arguments({ tournamentId: a.id().required() }).returns(a.boolean()).authorization(allow=>[allow.authenticated()]).handler(a.handler.function(maintenance)),
  deleteMyClubAccount: a.mutation().arguments({ confirmation: a.string().required() }).returns(a.boolean()).authorization(allow=>[allow.authenticated()]).handler(a.handler.function(maintenance)),
  initializeClubAccess: a.mutation().returns(a.ref('ClubAccess')).authorization(allow => [allow.authenticated()]).handler(a.handler.function(clubAccount)),
  manageClubBadge: a.mutation().arguments({ profileId: a.id().required(), code: a.string().required(), enabled: a.boolean().required() })
    .returns(a.ref('ClubAccess')).authorization(allow => [allow.authenticated()]).handler(a.handler.function(clubAccount)),
  saveClubProfile: a.mutation().arguments({ profileId: a.id(), nickname: a.string().required(), bio: a.string(), avatarPath: a.string(), phoneNumber: a.string().required() })
    .returns(a.ref('Profile')).authorization(allow => [allow.authenticated()]).handler(a.handler.function(clubAccount)),
  // Solicitudes de cobro privadas: sólo el organizador puede consultarlas.
  TournamentPayment: a.model({
    createdBySub:a.string().required(),tournamentName:a.string().required(),status:a.string().required(),
    amountCents:a.integer().required(),currency:a.string().required(),paymentMode:a.string().required(),
    payload:a.string(),checkoutUrl:a.string(),preferenceId:a.string(),collectorId:a.string(),paymentId:a.string(),
    expiresAt:a.datetime().required(),leaseUntil:a.float(),lastCheckedAt:a.float(),deletedAt:a.datetime(),
  }).authorization(allow=>[allow.ownerDefinedIn('createdBySub').identityClaim('sub').to(['read'])]),
  BillingSettings: a.model({amountCents:a.integer().required(),enabled:a.boolean().required()})
    .authorization(allow=>[allow.authenticated().to(['read'])]),
  TournamentFee: a.customType({amountCents:a.integer().required(),currency:a.string().required(),enabled:a.boolean().required(),mode:a.string().required(),canPay:a.boolean().required()}),
  getTournamentFee:a.query().returns(a.ref('TournamentFee')).authorization(allow=>[allow.authenticated()]).handler(a.handler.function(billing)),
  setTournamentFee:a.mutation().arguments({amountCents:a.integer().required(),enabled:a.boolean().required()}).returns(a.ref('TournamentFee')).authorization(allow=>[allow.authenticated()]).handler(a.handler.function(billing)),
  checkTournamentPayment:a.mutation().arguments({checkoutId:a.id().required()}).returns(a.ref('TournamentPayment')).authorization(allow=>[allow.authenticated()]).handler(a.handler.function(billing)),
  // Las cuentas pueden consultar torneos. Sólo la función validada los escribe.
  Tournament: a.model({
    name: a.string().required(),
    activity: a.string().required(),
    format: a.string().required(),
    description: a.string(),
    participantIds: a.string().required().array().required(),
    participantNames: a.string().required().array().required(),
    judgeIds: a.string().required().array().required(),
    judgeNames: a.string().required().array().required(),
    treasurerId: a.string(),
    treasurerName: a.string(),
    createdBySub: a.string().required(),
    status: a.string().required(),
    deletedAt: a.datetime(),
    deletedBySub: a.string(),
    // Opcionales para conservar los torneos anteriores; obligatorios al crear nuevos.
    arbitrationMode: a.string(),
    consentVersion: a.string(),
    organizerConsentAt: a.datetime(),
    startsAt: a.datetime(),
    timeZone: a.string(),
    creationPaymentStatus:a.string(),
    paymentMode:a.string(),
    winnerProfileId: a.id(),
    winnerName: a.string(),
    decidedBySub: a.string(),
    decidedByLabel: a.string(),
    decidedAt: a.datetime(),
    // Estados alineados con participantes, jueces y tesorero. Ausente en torneos anteriores.
    rosterStatuses: a.string().required().array(),
    membershipRevision: a.integer(),
    draw: a.string(),
    // Premio provisional, editable sólo a través de la función que comprueba al juez.
    prizeTitle:a.string(), prizeDescription:a.string(), prizeLinks:a.string(), prizeAttachments:a.string(),
    prizeRevision:a.integer(), prizeUpdatedAt:a.datetime(), prizeUpdatedBySub:a.string(),
  }).authorization(allow => [allow.authenticated().to(['read'])]),
  TournamentInvitation: a.model({
    tournamentId: a.id().required(),
    tournamentName: a.string().required(),
    recipientSub: a.string().required(),
    profileId: a.id().required(),
    role: a.string().required(),
    rosterIndex: a.integer().required(),
    status: a.string().required(),
    invitedBySub: a.string().required(),
    arbitrationMode: a.string(),
    consentVersion: a.string(),
    consentAcceptedAt: a.datetime(),
    startsAt: a.datetime(),
    timeZone: a.string(),
    rulesSnapshot: a.string(),
  }).authorization(allow => [allow.ownerDefinedIn('recipientSub').identityClaim('sub').to(['read'])]),
  PrizeUpload:a.customType({path:a.string().required(),url:a.string().required()}),
  prepareClubPrizeUpload:a.mutation().arguments({tournamentId:a.id().required(),uploadContentType:a.string().required(),uploadSize:a.integer().required()}).returns(a.ref('PrizeUpload')).authorization(allow=>[allow.authenticated()]).handler(a.handler.function(respondInvitation)),
  saveClubTournamentPrize:a.mutation().arguments({tournamentId:a.id().required(),prizeTitle:a.string().required(),prizeDescription:a.string(),prizeLinks:a.string(),prizeAttachments:a.string(),prizeRevision:a.integer().required()}).returns(a.ref('Tournament')).authorization(allow=>[allow.authenticated()]).handler(a.handler.function(respondInvitation)),
  recordClubDuelResult: a.mutation().arguments({ tournamentId: a.id().required(), winnerProfileId: a.id().required() })
    .returns(a.ref('Tournament')).authorization(allow => [allow.authenticated()]).handler(a.handler.function(respondInvitation)),
  prepareTournamentDraw: a.mutation().arguments({ tournamentId: a.id().required() })
    .returns(a.ref('Tournament')).authorization(allow => [allow.authenticated()])
    .handler(a.handler.function(respondInvitation)),
  respondToTournamentInvitation: a.mutation().arguments({
    invitationId: a.id().required(),
    accept: a.boolean().required(),
    acceptOrganizerDecision: a.boolean(),
  }).returns(a.ref('TournamentInvitation'))
    .authorization(allow => [allow.authenticated()])
    .handler(a.handler.function(respondInvitation)),
  createClubTournament: a.mutation().arguments({
    tournamentId: a.id().required(),
    arbitrationMode: a.string().required(),
    startsAt: a.datetime().required(),
    timeZone: a.string().required(),
    acceptOrganizerDecision: a.boolean(),
    name: a.string().required(),
    activity: a.string().required(),
    format: a.string().required(),
    description: a.string(),
    participantIds: a.string().required().array().required(),
    judgeIds: a.string().required().array().required(),
    treasurerId: a.string(),
  }).returns(a.ref('TournamentPayment'))
    .authorization(allow => [allow.authenticated()])
    .handler(a.handler.function(createTournament)),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({ schema });



