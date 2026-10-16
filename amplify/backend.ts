import { billing } from './functions/billing/resource';
import { maintenance } from './functions/maintenance/resource';
import { paymentWebhook } from './functions/payment-webhook/resource';
import { FunctionUrlAuthType } from 'aws-cdk-lib/aws-lambda';
import { defineBackend } from '@aws-amplify/backend';
import { clubAccount } from './functions/club-account/resource';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { storage } from './storage/resource';
import { respondInvitation } from './functions/respond-invitation/resource';
import { createTournament } from './functions/create-tournament/resource';

/** Recursos AWS que Amplify podrá desplegar cuando habilitemos el backend. */
const backend = defineBackend({ auth, data, storage, createTournament, respondInvitation, clubAccount, billing, paymentWebhook, maintenance });
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
backend.data.resources.tables['UniqueClaim'].grant(accountFunction,'dynamodb:ConditionCheckItem');
// La baja sólo acepta la identidad autenticada; el administrador del club está protegido.
backend.auth.resources.userPool.grant(backend.maintenance.resources.lambda,'cognito-idp:AdminGetUser','cognito-idp:AdminDeleteUser');
backend.maintenance.addEnvironment('USER_POOL_ID',backend.auth.resources.userPool.userPoolId);
for(const [model,env] of [['Profile','PROFILE_TABLE_NAME'],['PrivateAccount','ACCOUNT_TABLE_NAME'],['UniqueClaim','CLAIM_TABLE_NAME'],['ClubBadge','BADGE_TABLE_NAME'],['Tournament','TOURNAMENT_TABLE_NAME'],['TournamentPayment','PAYMENT_TABLE_NAME'],['TournamentInvitation','INVITATION_TABLE_NAME']] as const) {
  backend.data.resources.tables[model].grantReadWriteData(backend.maintenance.resources.lambda);
  backend.maintenance.addEnvironment(env,backend.data.resources.tables[model].tableName);
}
backend.data.resources.tables['UniqueClaim'].grantReadData(backend.respondInvitation.resources.lambda);
backend.respondInvitation.addEnvironment('CLAIM_TABLE_NAME',backend.data.resources.tables['UniqueClaim'].tableName);
for (const fn of [backend.createTournament, backend.respondInvitation]) {
  backend.data.resources.tables['PrivateAccount'].grant(fn.resources.lambda, 'dynamodb:GetItem');
  fn.addEnvironment('ACCOUNT_TABLE_NAME', backend.data.resources.tables['PrivateAccount'].tableName);
}

// El juez se identifica leyendo el perfil en AWS, nunca desde un rol del navegador.
profiles.grant(backend.respondInvitation.resources.lambda, 'dynamodb:GetItem');
backend.respondInvitation.addEnvironment('PROFILE_TABLE_NAME', profiles.tableName);


// URL sólo de recepción: no acepta decisiones del navegador, valida firma y consulta MP.
const webhookUrl=backend.paymentWebhook.resources.lambda.addFunctionUrl({authType:FunctionUrlAuthType.NONE});
backend.addOutput({custom:{paymentWebhookUrl:webhookUrl.url}});
for(const fn of [backend.createTournament,backend.billing]) {
  fn.addEnvironment('PAYMENT_WEBHOOK_URL',webhookUrl.url);
  backend.data.resources.tables['TournamentPayment'].grantReadWriteData(fn.resources.lambda);
  backend.data.resources.tables['BillingSettings'].grantReadData(fn.resources.lambda);
  fn.addEnvironment('PAYMENT_TABLE_NAME',backend.data.resources.tables['TournamentPayment'].tableName);
  fn.addEnvironment('BILLING_SETTINGS_TABLE_NAME',backend.data.resources.tables['BillingSettings'].tableName);
  fn.addEnvironment('CLAIM_TABLE_NAME',backend.data.resources.tables['UniqueClaim'].tableName);
  backend.data.resources.tables['UniqueClaim'].grantReadData(fn.resources.lambda);
}
backend.data.resources.tables['BillingSettings'].grant(backend.billing.resources.lambda,'dynamodb:UpdateItem');
for(const fn of [backend.billing,backend.paymentWebhook]) {
  backend.data.resources.tables['UniqueClaim'].grant(fn.resources.lambda,'dynamodb:ConditionCheckItem');
  for(const [model,env] of [['Tournament','TOURNAMENT_TABLE_NAME'],['TournamentInvitation','INVITATION_TABLE_NAME'],['UniqueClaim','CLAIM_TABLE_NAME'],['TournamentPayment','PAYMENT_TABLE_NAME']] as const) {
    backend.data.resources.tables[model].grant(fn.resources.lambda,'dynamodb:GetItem','dynamodb:PutItem','dynamodb:UpdateItem');
    fn.addEnvironment(env,backend.data.resources.tables[model].tableName);
  }
}

// El juez autorizado recibe una URL de carga válida por dos minutos.
backend.storage.resources.bucket.grantPut(backend.respondInvitation.resources.lambda,'prize-media/*');
backend.storage.resources.bucket.grantRead(backend.respondInvitation.resources.lambda,'prize-media/*');
backend.respondInvitation.addEnvironment('PRIZE_BUCKET_NAME',backend.storage.resources.bucket.bucketName);
