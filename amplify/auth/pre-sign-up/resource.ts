import {defineFunction} from '@aws-amplify/backend';
export const preSignUp=defineFunction({name:'club-registration-guard',entry:'./handler.ts',resourceGroupName:'auth',timeoutSeconds:5});
