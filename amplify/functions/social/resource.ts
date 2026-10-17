import { defineFunction } from '@aws-amplify/backend';
export const social = defineFunction({name:'club-social',entry:'./handler.ts',resourceGroupName:'data',timeoutSeconds:20});
