import {clubDirectory} from './community-api.js';
import { configureAmplify, getCurrentUser, profileClient } from './auth-client.js';

export async function tournamentClient() {
  if (!await configureAmplify()) throw new Error('No pudimos conectar con el club. Intentá de nuevo en unos momentos.');
  await getCurrentUser();
  return profileClient();
}
function resultData(result) {
  if (result.errors?.length) throw new Error(result.errors.map(error => error.message).join(' '));
  return result.data;
}
// Paginamos para no ocultar cuentas o torneos después de la primera página.
export async function registeredProfiles(){return clubDirectory();}
export async function createClubTournament(values) {
  const client = await tournamentClient();
  const result = resultData(await client.mutations.createClubTournament(values));
  if (!result?.id) throw new Error('AWS no confirmó la solicitud de pago. Podés reintentar sin crear un duplicado.');
  return result;
}
export async function listClubTournaments() {
  const client = await tournamentClient();
  const tournaments = [];
  let nextToken;
  do {
    const result = await client.models.Tournament.list({ limit: 100, nextToken });
    tournaments.push(...(resultData(result) || []));
    nextToken = result.nextToken;
  } while (nextToken);
  return tournaments.filter(t=>!t.deletedAt && t.status!=='DELETED').sort((a,b) => b.createdAt.localeCompare(a.createdAt));
}
export async function getClubTournament(id) {
  const client = await tournamentClient();
  const row=resultData(await client.models.Tournament.get({ id }));
  return row && !row.deletedAt && row.status!=='DELETED' ? row : null;
}


// La autorización del modelo limita estas lecturas al destinatario de Cognito.
export async function pendingInvitations() {
  const client = await tournamentClient();
  const user = await getCurrentUser();
  const invitations = [];
  let nextToken;
  do {
    const result = await client.models.TournamentInvitation.invitationsByRecipient({recipientSub:user.userId,status:{eq:'PENDING'}},{limit:100,nextToken});
    invitations.push(...(resultData(result) || [])); nextToken = result.nextToken;
  } while (nextToken);
  // No mostrar invitaciones de torneos retirados aunque la campana estuviera abierta.
  const live=new Map(await Promise.all([...new Set(invitations.map(i=>i.tournamentId))].map(async id=>[id,await getClubTournament(id)])));
  return invitations.filter(i=>{const t=live.get(i.tournamentId);return t && (i.termsVersion || 0)===(t.termsVersion || 0) && (!t.rosterStatuses || t.rosterStatuses[i.rosterIndex]==='PENDING');}).sort((a,b) => b.createdAt.localeCompare(a.createdAt));
}
export async function respondInvitation(invitationId, accept, acceptOrganizerDecision = false,acceptTerms=false,termsVersion=null) {
  const client = await tournamentClient();
  const result = resultData(await client.mutations.answerTournamentInvitation({ invitationId, accept, acceptOrganizerDecision,acceptTerms,termsVersion }));
  if (!result?.id) throw new Error('No se pudo confirmar la respuesta. Actualizá para revisar su estado.');
  return result;
}

export async function ensureClubTournamentDraw(tournamentId) {
  const client = await tournamentClient();
  return resultData(await client.mutations.prepareTournamentDraw({ tournamentId }));
}

export async function recordClubDuelResult(tournamentId, winnerProfileId,resultReason='',resultKind='NORMAL') {
  const client = await tournamentClient();
  return resultData(await client.mutations.recordClubDuelResult({ tournamentId, winnerProfileId,resultReason,resultKind }));
}

// Los permisos del premio se validan en AWS, no por los botones visibles.
export async function saveTournamentPrize(values){const c=await tournamentClient();return resultData(await c.mutations.saveClubTournamentPrize(values));}
export async function preparePrizeUpload(values){const c=await tournamentClient();return resultData(await c.mutations.prepareClubPrizeUpload(values));}

// La señal despierta una relectura autorizada; el estado real siempre viene de AWS.
export async function watchTournamentLobby(tournamentId,onChange,onError){
 const client=await tournamentClient();
 return client.subscriptions.onTournamentLobby({tournamentId}).subscribe({next:()=>onChange(),error:onError});
}
