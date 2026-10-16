import { tournamentClient } from './tournaments-api.js';
const data=result=>{if(result.errors?.length)throw new Error(result.errors.map(e=>e.message).join(' '));return result.data;};
export const money=cents=>new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS'}).format(cents/100)+' ARS';
export async function tournamentFee(){return data(await (await tournamentClient()).queries.getTournamentFee());}
export async function setTournamentFee(amountCents,enabled){return data(await (await tournamentClient()).mutations.setTournamentFee({amountCents,enabled}));}
export async function checkPayment(checkoutId){return data(await (await tournamentClient()).mutations.checkTournamentPayment({checkoutId}));}
export async function savedPayment(id){return data(await (await tournamentClient()).models.TournamentPayment.get({id},{selectionSet:['id','tournamentName','status','amountCents','currency','paymentMode','checkoutUrl','expiresAt','createdAt','updatedAt']}));}
export async function myPendingPayments(){
  const client=await tournamentClient(),rows=[];let nextToken;
  do{const result=await client.models.TournamentPayment.list({filter:{status:{eq:'PENDING'}},nextToken,limit:100,selectionSet:['id','tournamentName','status','amountCents','expiresAt','paymentMode','createdAt']});rows.push(...(data(result)||[]));nextToken=result.nextToken;}while(nextToken);
  return rows.filter(row=>Date.parse(row.expiresAt)>Date.now()).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
}
