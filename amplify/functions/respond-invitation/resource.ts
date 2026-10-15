import { defineFunction } from '@aws-amplify/backend';
export const respondInvitation = defineFunction({
  name: 'respond-invitation', entry: './handler.ts', resourceGroupName: 'data', timeoutSeconds: 20,
});
