import { defineFunction,secret } from '@aws-amplify/backend';
// La firma se obtiene de Amplify Secrets; nunca se publica en el frontend.
export const paymentWebhook=defineFunction({name:'payment-webhook',entry:'./handler.ts',resourceGroupName:'data',timeoutSeconds:30,environment:{MERCADOPAGO_ACCESS_TOKEN:secret('MERCADOPAGO_ACCESS_TOKEN'),MERCADOPAGO_WEBHOOK_SECRET:secret('MERCADOPAGO_WEBHOOK_SECRET'),MERCADOPAGO_MODE:'test'}});
