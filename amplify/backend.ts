import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { storage } from './storage/resource';
import { createTournament } from './functions/create-tournament/resource';

/** Recursos AWS que Amplify podrá desplegar cuando habilitemos el backend. */
const backend = defineBackend({ auth, data, storage, createTournament });
// Acceso mínimo: leer perfiles registrados y crear torneos validados.
const profiles = backend.data.resources.tables['Profile'];
const tournaments = backend.data.resources.tables['Tournament'];
profiles.grantReadData(backend.createTournament.resources.lambda);
tournaments.grant(backend.createTournament.resources.lambda, 'dynamodb:GetItem', 'dynamodb:PutItem');
backend.createTournament.addEnvironment('PROFILE_TABLE_NAME', profiles.tableName);
backend.createTournament.addEnvironment('TOURNAMENT_TABLE_NAME', tournaments.tableName);


