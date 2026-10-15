import { defineFunction } from '@aws-amplify/backend';
export const clubAccount = defineFunction({ name: 'club-account', entry: './handler.ts', resourceGroupName: 'data', timeoutSeconds: 30 });
