import {preSignUp} from './auth/pre-sign-up/resource';
import {adminConsole} from './functions/admin-console/resource';
import {Policy,PolicyStatement} from 'aws-cdk-lib/aws-iam';
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
import { social } from './functions/social/resource';
import { Table, CfnTable, AttributeType, BillingMode } from 'aws-cdk-lib/aws-dynamodb';
import { RemovalPolicy } from 'aws-cdk-lib';
import { LogRetention, RetentionDays } from 'aws-cdk-lib/aws-logs';

/** Recursos AWS que Amplify podrá desplegar cuando habilitemos el backend. */
const backend = defineBackend({ auth, data, storage, createTournament, respondInvitation, clubAccount, billing, paymentWebhook, maintenance, social, adminConsole, preSignUp });
// Tabla privada sin CRUD público. Sólo la función de amigos puede leerla o escribirla.
const socialTable=new Table(backend.data.resources.graphqlApi.stack,'ClubSocial',{
  partitionKey:{name:'pk',type:AttributeType.STRING},sortKey:{name:'sk',type:AttributeType.STRING},
  billingMode:BillingMode.PAY_PER_REQUEST,timeToLiveAttribute:'ttl',removalPolicy:RemovalPolicy.RETAIN,
});
socialTable.grantReadWriteData(backend.social.resources.lambda);
backend.social.addEnvironment('SOCIAL_TABLE_NAME',socialTable.tableName);
for(const [model,env] of [['Profile','PROFILE_TABLE_NAME'],['Tournament','TOURNAMENT_TABLE_NAME'],['UniqueClaim','CLAIM_TABLE_NAME']] as const){
  backend.data.resources.tables[model].grantReadData(backend.social.resources.lambda);
  backend.social.addEnvironment(env,backend.data.resources.tables[model].tableName);
}
backend.data.resources.tables['Tournament'].grant(backend.social.resources.lambda,'dynamodb:ConditionCheckItem');
backend.data.resources.tables['UniqueClaim'].grant(backend.social.resources.lambda,'dynamodb:ConditionCheckItem');
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

// Comunidad 3.0: la función devuelve sólo campos autorizados; Profile ya no es público.
backend.data.resources.tables['ClubBadge'].grantReadData(backend.social.resources.lambda);
backend.social.addEnvironment('BADGE_TABLE_NAME',backend.data.resources.tables['ClubBadge'].tableName);
invitations.grantReadWriteData(backend.social.resources.lambda);
tournaments.grantReadWriteData(backend.social.resources.lambda);
backend.social.addEnvironment('INVITATION_TABLE_NAME',invitations.tableName);
backend.social.addEnvironment('PROFILE_BUCKET_NAME',backend.storage.resources.bucket.bucketName);
backend.storage.resources.bucket.grantRead(backend.social.resources.lambda,'profile-pictures/*');
backend.storage.resources.bucket.grantReadWrite(backend.social.resources.lambda,'profile-private/*');
// Portadas: sólo funciones autenticadas emiten URLs temporales y validan la propiedad.
backend.storage.resources.bucket.grantPut(backend.social.resources.lambda,'tournament-covers/*');
backend.storage.resources.bucket.grantRead(backend.social.resources.lambda,'tournament-covers/*');
backend.storage.resources.bucket.grantRead(backend.createTournament.resources.lambda,'tournament-covers/*');
backend.createTournament.addEnvironment('PROFILE_BUCKET_NAME',backend.storage.resources.bucket.bucketName);
backend.storage.resources.bucket.grantRead(accountFunction,'profile-private/*');
backend.clubAccount.addEnvironment('PROFILE_BUCKET_NAME',backend.storage.resources.bucket.bucketName);
profiles.grant(accountFunction,'dynamodb:Scan');

invitations.grant(backend.respondInvitation.resources.lambda,'dynamodb:PutItem');

backend.storage.resources.bucket.grantReadWrite(backend.maintenance.resources.lambda,'profile-private/*');
backend.maintenance.addEnvironment('PROFILE_BUCKET_NAME',backend.storage.resources.bucket.bucketName);

// Consultas privadas y gestión de exenciones con escritura limitada y auditoría.
for(const [model,key] of [['Profile','PROFILE_TABLE_NAME'],['PrivateAccount','ACCOUNT_TABLE_NAME'],['UniqueClaim','CLAIM_TABLE_NAME'],['ClubBadge','BADGE_TABLE_NAME'],['Tournament','TOURNAMENT_TABLE_NAME'],['TournamentPayment','PAYMENT_TABLE_NAME'],['TournamentInvitation','INVITATION_TABLE_NAME'],['BillingSettings','BILLING_SETTINGS_TABLE_NAME']] as const){
 backend.data.resources.tables[model].grantReadData(backend.adminConsole.resources.lambda);
 backend.adminConsole.addEnvironment(key,backend.data.resources.tables[model].tableName);
}
socialTable.grantReadData(backend.adminConsole.resources.lambda);
backend.adminConsole.resources.lambda.addToRolePolicy(new PolicyStatement({actions:['dynamodb:PutItem'],resources:[socialTable.tableArn],conditions:{'ForAllValues:StringEquals':{'dynamodb:LeadingKeys':['ADMIN_AUDIT']}}}));
backend.adminConsole.addEnvironment('SOCIAL_TABLE_NAME',socialTable.tableName);
backend.adminConsole.resources.lambda.addToRolePolicy(new PolicyStatement({actions:['dynamodb:PutItem'],resources:[backend.data.resources.tables['UniqueClaim'].tableArn],conditions:{'ForAllValues:StringLike':{'dynamodb:LeadingKeys':['creation-exempt:*']}}}));
backend.data.resources.tables['UniqueClaim'].grant(backend.adminConsole.resources.lambda,'dynamodb:ConditionCheckItem');
backend.data.resources.tables['UniqueClaim'].grant(backend.createTournament.resources.lambda,'dynamodb:ConditionCheckItem');
// Los permisos sobre la tabla no deben depender de cómo CDK incluya los índices.
backend.social.resources.lambda.addToRolePolicy(new PolicyStatement({actions:['dynamodb:Query'],resources:[profiles.tableArn+'/index/byAvatarPath']}));
backend.auth.resources.userPool.grant(backend.adminConsole.resources.lambda,'cognito-idp:ListUsers','cognito-idp:AdminGetUser');
backend.adminConsole.addEnvironment('USER_POOL_ID',backend.auth.resources.userPool.userPoolId);
backend.storage.resources.bucket.grantRead(backend.adminConsole.resources.lambda,'profile-pictures/*');
backend.storage.resources.bucket.grantRead(backend.adminConsole.resources.lambda,'profile-private/*');
backend.adminConsole.addEnvironment('PROFILE_BUCKET_NAME',backend.storage.resources.bucket.bucketName);

// Reserva de correos del alta, privada y en el stack de Auth para evitar dependencias circulares.
const registrationTable=new Table(backend.auth.resources.userPool.stack,'ClubRegistrationClaims',{partitionKey:{name:'id',type:AttributeType.STRING},billingMode:BillingMode.PAY_PER_REQUEST,timeToLiveAttribute:'expiresAt',removalPolicy:RemovalPolicy.RETAIN});
registrationTable.grant(backend.preSignUp.resources.lambda,'dynamodb:PutItem');
backend.preSignUp.addEnvironment('REGISTRATION_TABLE_NAME',registrationTable.tableName);
backend.preSignUp.resources.lambda.role?.attachInlinePolicy(new Policy(backend.auth.resources.userPool.stack,'RegistrationPoolRead',{statements:[new PolicyStatement({actions:['cognito-idp:ListUsers'],resources:[backend.auth.resources.userPool.userPoolArn]})]}));

// Respaldo continuo de 35 días y bloqueo de borrado accidental. Estos ajustes
// protegen las tablas existentes; no son un límite de gasto ni un backup S3.
for(const table of Object.values(backend.data.resources.cfnResources.amplifyDynamoDbTables)){
 table.deletionProtectionEnabled=true;
 table.pointInTimeRecoverySpecification={pointInTimeRecoveryEnabled:true,recoveryPeriodInDays:35};
 table.applyRemovalPolicy(RemovalPolicy.RETAIN);
}
for(const table of [socialTable,registrationTable]){
 const cfn=table.node.defaultChild as CfnTable;
 cfn.deletionProtectionEnabled=true;
 cfn.pointInTimeRecoverySpecification={pointInTimeRecoveryEnabled:true,recoveryPeriodInDays:35};
 table.applyRemovalPolicy(RemovalPolicy.RETAIN);
}

for(const [fn,days] of [[backend.createTournament,30],[backend.respondInvitation,30],[backend.clubAccount,30],[backend.social,30],[backend.preSignUp,30],[backend.billing,90],[backend.paymentWebhook,90],[backend.maintenance,90],[backend.adminConsole,90]] as const){
 // Aplica la retención al grupo existente, sin reemplazarlo ni cambiar su nombre.
 new LogRetention(fn.resources.lambda,'ClubLogRetention',{
  logGroupName:'/aws/lambda/'+fn.resources.lambda.functionName,
  retention:days as RetentionDays,
 });
}

const photoBucket=backend.storage.resources.bucket.node.defaultChild as import('aws-cdk-lib/aws-s3').CfnBucket;
photoBucket.versioningConfiguration={status:'Enabled'};
// Amplify administra su ciclo de vida y la limpieza del bucket. No cambiamos
// su RemovalPolicy mientras AutoDeleteObjects esté habilitado por Amplify.
