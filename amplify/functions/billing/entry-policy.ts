import {createHash} from 'node:crypto';
export const DEFAULT_ENTRY_CENTS=50000;
export function entryCheckoutId(tournamentId:string,profileId:string){const bytes=createHash('sha256').update('proveit-entry-v1:'+tournamentId+':'+profileId).digest().subarray(0,16);bytes[6]=(bytes[6]&15)|80;bytes[8]=(bytes[8]&63)|128;const h=bytes.toString('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;}
export function entryAmount(t:any){if(t.entryFeeCents==null || t.entryFeeCents===0)return 0;if(!Number.isSafeInteger(t.entryFeeCents) || t.entryFeeCents<DEFAULT_ENTRY_CENTS || t.entryFeeCents>100000000)throw new Error('La inscripción necesita revisión del administrador.');return t.entryFeeCents;}
export function assertEntryPaid(t:any,i:any,row:any,sub:string,mode:string){
 const amount=entryAmount(t);if(i.role!=='PARTICIPANT' || !amount)return;
 if(row?.status==='REVERSED')throw new Error('El pago fue revertido. Contactá al administrador antes de volver a pagar.');
 if(!row || row.status!=='APPROVED')throw new Error('ENTRY_PAYMENT_REQUIRED: Confirmá el pago de inscripción para participar.');
 if(row.deletedAt || row.kind!=='ENTRY' || row.id!==entryCheckoutId(t.id,i.profileId) || row.createdBySub!==sub || row.tournamentId!==t.id || row.participantProfileId!==i.profileId || row.amountCents!==amount || row.currency!=='ARS' || row.paymentMode!==mode)throw new Error('El pago no corresponde a esta inscripción.');
}
