import { defineFunction } from '@aws-amplify/backend';

export const publicGallery = defineFunction({
  name: 'public-winner-gallery',
  entry: './handler.ts',
  resourceGroupName: 'data',
  timeoutSeconds: 10,
});
