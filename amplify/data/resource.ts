import { a, defineData, type ClientSchema } from '@aws-amplify/backend';

/**
 * Perfil público solo para personas con sesión iniciada.
 * Cada usuario puede modificar su propio perfil; el correo no se almacena aquí.
 */
const schema = a.schema({
  Profile: a
    .model({
      nickname: a.string().required(),
      bio: a.string(),
      avatarPath: a.string(),
    })
    .authorization((allow) => [
      allow.owner(),
      allow.authenticated().to(['read']),
    ]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({ schema });

