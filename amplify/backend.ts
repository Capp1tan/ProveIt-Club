import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { storage } from './storage/resource';

/** Recursos AWS que Amplify podrá desplegar cuando habilitemos el backend. */
defineBackend({ auth, data, storage });

