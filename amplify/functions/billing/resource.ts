import { defineFunction, secret } from '@aws-amplify/backend';
export const billing=defineFunction({name:'club-billing',entry:'./handler.ts',resourceGroupName:'data',timeoutSeconds:30,environment:{MERCADOPAGO_ACCESS_TOKEN:secret('MERCADOPAGO_PRODUCTION_ACCESS_TOKEN'),MERCADOPAGO_MODE:'live'}});
