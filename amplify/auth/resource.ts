import {preSignUp} from './pre-sign-up/resource';
import { defineAuth, secret } from '@aws-amplify/backend';

// La vista previa usa registro por email. No reutilizamos las credenciales OAuth de producción.
const isPreviewBranch = Boolean(process.env.AWS_BRANCH && process.env.AWS_BRANCH !== 'main');

/**
 * Cognito maneja el registro, el inicio de sesión y la verificación del correo.
 * Las credenciales de Google se cargarán como secretos en Amplify; nunca van aquí.
 */
export const auth = defineAuth({
  triggers:{preSignUp},
  loginWith: {
    email: true,
    ...(!isPreviewBranch ? { externalProviders: {
      google: {
        clientId: secret('GOOGLE_CLIENT_ID'),
        clientSecret: secret('GOOGLE_CLIENT_SECRET'),
        // El correo es obligatorio en Cognito: Google debe enviarlo y mapearlo.
        scopes: ['openid', 'email', 'profile'],
        attributeMapping: { email: 'email', emailVerified: 'email_verified' },
      },
      callbackUrls: [
        'http://localhost:5173/',
        'http://localhost:5173/react/',
        'https://proveitclub.win/',
        'https://proveitclub.win/react/',
        'https://www.proveitclub.win/',
        'https://www.proveitclub.win/react/',
      ],
      logoutUrls: [
        'http://localhost:5173/',
        'http://localhost:5173/react/',
        'https://proveitclub.win/',
        'https://proveitclub.win/react/',
        'https://www.proveitclub.win/',
        'https://www.proveitclub.win/react/',
      ],
    } } : {}),
  },
});

