import { defineFunction, secret } from '@aws-amplify/backend';
const isPreviewBranch = Boolean(process.env.AWS_BRANCH && process.env.AWS_BRANCH !== 'main');
export const billing=defineFunction({name:'club-billing',entry:'./handler.ts',resourceGroupName:'data',timeoutSeconds:30,environment:isPreviewBranch?{MERCADOPAGO_MODE:'preview'}:{MERCADOPAGO_ACCESS_TOKEN:secret('MERCADOPAGO_PRODUCTION_ACCESS_TOKEN'),MERCADOPAGO_MODE:'live'}});
