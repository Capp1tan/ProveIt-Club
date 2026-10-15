import { a, defineData, type ClientSchema } from '@aws-amplify/backend';
import { respondInvitation } from '../functions/respond-invitation/resource';
import { createTournament } from '../functions/create-tournament/resource';

/**
 * Perfil público solo para personas con sesión iniciada.
 * Cada usuario puede modificar su propio perfil; el correo no se almacena aquí.
 */
const schema = a.schema({
  Profile: a
    .model({
      nickname: a.string().required(),
      bio: a.string(),
      avatarPath: a.string(),
    })
    .authorization((allow) => [
      allow.owner(),
      allow.authenticated().to(['read']),
    ]),
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
    // Estados alineados con participantes, jueces y tesorero. Ausente en torneos anteriores.
    rosterStatuses: a.string().required().array(),
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
  }).authorization(allow => [allow.ownerDefinedIn('recipientSub').identityClaim('sub').to(['read'])]),
  respondToTournamentInvitation: a.mutation().arguments({
    invitationId: a.id().required(),
    accept: a.boolean().required(),
  }).returns(a.ref('TournamentInvitation'))
    .authorization(allow => [allow.authenticated()])
    .handler(a.handler.function(respondInvitation)),
  createClubTournament: a.mutation().arguments({
    tournamentId: a.id().required(),
    name: a.string().required(),
    activity: a.string().required(),
    format: a.string().required(),
    description: a.string(),
    participantIds: a.string().required().array().required(),
    judgeIds: a.string().required().array().required(),
    treasurerId: a.string(),
  }).returns(a.ref('Tournament'))
    .authorization(allow => [allow.authenticated()])
    .handler(a.handler.function(createTournament)),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({ schema });


