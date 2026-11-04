/** El precio se fija al crear el torneo; activar la gratuidad no reescribe cobros. */
export function participationPricing(settings:any,mode:string){
 const standardAmountCents=settings?.amountCents ?? 50000,freeEntries=settings?.freeEntries===true;
 return {amountCents:0,standardAmountCents,participantAmountCents:freeEntries?0:standardAmountCents,freeEntries,currency:'ARS',enabled:settings?.enabled ?? true,mode};
}
