import {defineFunction} from '@aws-amplify/backend';
export const adminConsole=defineFunction({name:'club-admin-console',entry:'./handler.ts',resourceGroupName:'data',timeoutSeconds:30});
