import { defineStorage } from '@aws-amplify/backend';

/**
 * Las fotos se guardan separadas del código del sitio.
 * El dueño puede subir, reemplazar y borrar su foto; usuarios con sesión pueden verla.
 */
export const storage = defineStorage({
  name: 'proveitProfilePictures',
  access: (allow) => ({
    'profile-pictures/{entity_id}/*': [
      allow.entity('identity').to(['read', 'write', 'delete']),
      allow.authenticated.to(['read']),
    ],
  }),
});

