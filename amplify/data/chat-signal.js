import {util,extensions} from '@aws-appsync/utils';
// Ningún parámetro puede cambiar la cuenta que recibe el aviso.
export function request(){return {payload:null};}
export function response(ctx){
 if(!ctx.identity || !ctx.identity.sub)util.unauthorized();
 extensions.setSubscriptionFilter(util.transform.toSubscriptionFilter({recipients:{contains:ctx.identity.sub}}));
 return null;
}
