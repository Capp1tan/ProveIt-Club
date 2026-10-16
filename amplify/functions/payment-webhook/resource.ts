import { defineFunction,secret } from '@aws-amplify/backend';
// Primer despliegue: sin firma configurada, el endpoint rechaza todas las llamadas.
// Luego de registrar su URL en MP, se vincula el secreto de firma de Amplify.
export const paymentWebhook=defineFunction({name:'payment-webhook',entry:'./handler.ts',resourceGroupName:'data',timeoutSeconds:30,environment:{MERCADOPAGO_ACCESS_TOKEN:secret('MERCADOPAGO_ACCESS_TOKEN'),MERCADOPAGO_MODE:'test'}});
