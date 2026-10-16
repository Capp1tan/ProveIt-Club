import { tournamentClient } from './tournaments-api.js';
function checked(result) {
  if(result.errors?.length)throw new Error(result.errors.map(e=>e.message).join(' '));
  if(result.data!==true)throw new Error('AWS no confirmó la eliminación. Reintentá para comprobar su estado.');
}
export async function deleteTournament(tournamentId) {
  checked(await (await tournamentClient()).mutations.deleteClubTournament({tournamentId}));
  window.dispatchEvent(new Event('proveit:tournament-deleted'));
}
export async function deleteMyAccount() {
  checked(await (await tournamentClient()).mutations.deleteMyClubAccount({confirmation:'ELIMINAR MI CUENTA'}));
}
