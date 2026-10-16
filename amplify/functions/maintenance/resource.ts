import { defineFunction } from '@aws-amplify/backend';
export const maintenance = defineFunction({ name: 'club-maintenance', entry: './handler.ts', resourceGroupName: 'data', timeoutSeconds: 60 });
