import { defineAuth, secret } from '@aws-amplify/backend';

/**
 * Cognito maneja el registro, el inicio de sesión y la verificación del correo.
 * Las credenciales de Google se cargarán como secretos en Amplify; nunca van aquí.
 */
export const auth = defineAuth({
  loginWith: {
    email: true,
    externalProviders: {
      google: {
        clientId: secret('GOOGLE_CLIENT_ID'),
        clientSecret: secret('GOOGLE_CLIENT_SECRET'),
        // El correo es obligatorio en Cognito: Google debe enviarlo y mapearlo.
        scopes: ['openid', 'email', 'profile'],
        attributeMapping: { email: 'email' },
      },
      callbackUrls: [
        'http://localhost:5173/',
        'https://proveitclub.win/',
        'https://www.proveitclub.win/',
      ],
      logoutUrls: [
        'http://localhost:5173/',
        'https://proveitclub.win/',
        'https://www.proveitclub.win/',
      ],
    },
  },
});

