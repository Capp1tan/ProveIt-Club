import { defineStorage } from '@aws-amplify/backend';

/**
 * Las fotos se guardan separadas del código del sitio.
 * El dueño puede subir, reemplazar y borrar su foto; usuarios con sesión pueden verla.
 */
export const storage = defineStorage({
  name: 'proveitProfilePictures',
  access: (allow) => ({
    // Los adjuntos sólo se cargan con una URL breve emitida por el servidor.
    'prize-media/*': [allow.authenticated.to(['read'])],
    'profile-pictures/{entity_id}/*': [
      allow.entity('identity').to(['read', 'write', 'delete']),
    ],
  }),
});

