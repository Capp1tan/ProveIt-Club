import { defineFunction } from '@aws-amplify/backend';

export const createTournament = defineFunction({
  name: 'create-tournament',
  entry: './handler.ts',
  resourceGroupName: 'data',
  timeoutSeconds: 30,
});

