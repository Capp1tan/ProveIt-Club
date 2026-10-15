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
export async function registeredProfiles() {
  const client = await tournamentClient();
  const profiles = [];
  let nextToken;
  do {
    const result = await client.models.Profile.list({ limit: 100, nextToken, selectionSet: ['id', 'nickname', 'owner', 'avatarPath'] });
    profiles.push(...(resultData(result) || []));
    nextToken = result.nextToken;
  } while (nextToken);
  return profiles.filter(profile => profile.nickname && profile.owner).sort((a,b) => a.nickname.localeCompare(b.nickname, 'es'));
}
export async function createClubTournament(values) {
  const client = await tournamentClient();
  const result = resultData(await client.mutations.createClubTournament(values));
  if (!result?.id) throw new Error('AWS no confirmó el guardado. Podés reintentar sin crear un duplicado.');
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
  return tournaments.sort((a,b) => b.createdAt.localeCompare(a.createdAt));
}
export async function getClubTournament(id) {
  const client = await tournamentClient();
  return resultData(await client.models.Tournament.get({ id }));
}

