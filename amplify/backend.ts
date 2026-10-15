import { defineBackend } from '@aws-amplify/backend';
import { clubAccount } from './functions/club-account/resource';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { storage } from './storage/resource';
import { respondInvitation } from './functions/respond-invitation/resource';
import { createTournament } from './functions/create-tournament/resource';

/** Recursos AWS que Amplify podrá desplegar cuando habilitemos el backend. */
const backend = defineBackend({ auth, data, storage, createTournament, respondInvitation, clubAccount });
// Acceso mínimo: leer perfiles registrados y crear torneos validados.
const profiles = backend.data.resources.tables['Profile'];
const tournaments = backend.data.resources.tables['Tournament'];
profiles.grantReadData(backend.createTournament.resources.lambda);
tournaments.grant(backend.createTournament.resources.lambda, 'dynamodb:GetItem', 'dynamodb:PutItem');
backend.createTournament.addEnvironment('PROFILE_TABLE_NAME', profiles.tableName);
backend.createTournament.addEnvironment('TOURNAMENT_TABLE_NAME', tournaments.tableName);



// Las invitaciones sólo se escriben mediante funciones con comprobación de identidad.
const invitations = backend.data.resources.tables['TournamentInvitation'];
invitations.grant(backend.createTournament.resources.lambda, 'dynamodb:PutItem');
invitations.grant(backend.respondInvitation.resources.lambda, 'dynamodb:GetItem', 'dynamodb:UpdateItem');
tournaments.grant(backend.respondInvitation.resources.lambda, 'dynamodb:GetItem', 'dynamodb:UpdateItem');
backend.createTournament.addEnvironment('INVITATION_TABLE_NAME', invitations.tableName);
backend.respondInvitation.addEnvironment('INVITATION_TABLE_NAME', invitations.tableName);
backend.respondInvitation.addEnvironment('TOURNAMENT_TABLE_NAME', tournaments.tableName);

// El servidor es el único que puede reservar teléfonos o conceder insignias.
const accountFunction = backend.clubAccount.resources.lambda;
profiles.grant(accountFunction, 'dynamodb:GetItem', 'dynamodb:PutItem');
backend.clubAccount.addEnvironment('PROFILE_TABLE_NAME', profiles.tableName);
for (const [model, environment] of [['PrivateAccount','ACCOUNT_TABLE_NAME'], ['UniqueClaim','CLAIM_TABLE_NAME'], ['ClubBadge','BADGE_TABLE_NAME']] as const) {
  const table = backend.data.resources.tables[model];
  table.grant(accountFunction, 'dynamodb:GetItem', 'dynamodb:PutItem', 'dynamodb:DeleteItem');
  backend.clubAccount.addEnvironment(environment, table.tableName);
}
backend.auth.resources.userPool.grant(accountFunction, 'cognito-idp:AdminGetUser');
backend.clubAccount.addEnvironment('USER_POOL_ID', backend.auth.resources.userPool.userPoolId);
for (const fn of [backend.createTournament, backend.respondInvitation]) {
  backend.data.resources.tables['PrivateAccount'].grant(fn.resources.lambda, 'dynamodb:GetItem');
  fn.addEnvironment('ACCOUNT_TABLE_NAME', backend.data.resources.tables['PrivateAccount'].tableName);
}
