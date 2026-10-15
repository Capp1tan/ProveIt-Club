// Cliente de Amplify Auth, Data y Storage. Amplify genera amplify_outputs.json
// cuando se despliega el backend; sin ese archivo el sitio mantiene la demo y
// muestra una explicación, en vez de fingir que el registro funcionó.
import { Amplify } from 'aws-amplify';
import {
  confirmResetPassword,
  confirmSignIn,
  confirmSignUp,
  fetchAuthSession,
  getCurrentUser,
  resetPassword,
  signIn,
  signInWithRedirect,
  signOut,
  signUp,
} from 'aws-amplify/auth';

let configured = false;
let configurationPromise;
let dataClientPromise;

// Data y Storage se descargan sólo cuando se necesita leer el perfil o una foto.
// La promesa compartida evita crear clientes duplicados con peticiones simultáneas.
export function profileClient() {
  if (!dataClientPromise) {
    dataClientPromise = import('aws-amplify/data').then(({ generateClient }) => generateClient());
    dataClientPromise.catch(() => { dataClientPromise = undefined; });
  }
  return dataClientPromise;
}

export async function configureAmplify() {
  if (configured) return true;
  // Las páginas pueden cargar el perfil y la navegación a la vez:
  // comparten una sola configuración para no reiniciar la sesión OAuth.
  if (!configurationPromise) {
    configurationPromise = (async () => {
      try {
        const response = await fetch('/amplify_outputs.json', { cache: 'no-cache' });
        if (!response.ok) return false;
        const outputs = await response.json();
        // Dominio propio de Cognito; AWS sigue generando los demás identificadores.
        if (outputs.auth?.oauth) outputs.auth.oauth.domain = 'auth.proveitclub.win';
        Amplify.configure(outputs);
        configured = true;
        return true;
      } catch (error) {
        console.error('No se pudo cargar la configuración de Amplify:', error);
        return false;
      }
    })();
  }
  const ready = await configurationPromise;
  if (!ready) configurationPromise = undefined;
  return ready;
}

function requireBackend() {
  if (!configured) throw new Error('El backend de Amplify todavía no está conectado.');
}

export { confirmResetPassword, confirmSignIn, confirmSignUp, fetchAuthSession, getCurrentUser, resetPassword, signIn, signInWithRedirect, signOut, signUp };

export async function loadProfile() {
  requireBackend();
  const dataClient = await profileClient();
  const user = await getCurrentUser();
  const { data, errors } = await dataClient.models.Profile.list({
    filter: { owner: { contains: user.userId } },
    limit: 1,
  });
  if (errors?.length) throw new Error(errors[0].message);
  return { user, profile: data?.[0] ?? null };
}

export async function saveProfile(profileId, values) {
  requireBackend();
  const dataClient = await profileClient();
  const nickname = values.nickname.trim();
  const { data: profiles, errors: listErrors } = await dataClient.models.Profile.list({ limit: 1000 });
  if (listErrors?.length) throw new Error(listErrors[0].message);
  const key = value => value.normalize('NFKC').toLocaleLowerCase('es');
  if (profiles.some(profile => profile.id !== profileId && key(profile.nickname) === key(nickname))) {
    throw new Error('Ese nick ya está en uso. Elegí otro.');
  }
  const payload = {
    nickname,
    bio: values.bio.trim(),
    avatarPath: values.avatarPath || '',
  };
  const result = profileId
    ? await dataClient.models.Profile.update({ id: profileId, ...payload })
    : await dataClient.models.Profile.create(payload);
  if (result.errors?.length) throw new Error(result.errors[0].message);
  return result.data;
}

export async function saveAvatar(file) {
  requireBackend();
  if (!file) return null;
  if (file.size > 2 * 1024 * 1024) throw new Error('La foto debe pesar 2 MB o menos.');
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('Usá una imagen JPG, PNG o WebP.');
  }
  const session = await fetchAuthSession();
  const identityId = session.identityId;
  if (!identityId) throw new Error('No se encontró la identidad de almacenamiento.');
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
  const path = `profile-pictures/${identityId}/${Date.now()}-${safeName}`;
  const { uploadData } = await import('aws-amplify/storage');
  await uploadData({ path, data: file, options: { contentType: file.type } }).result;
  return path;
}

export async function avatarUrl(path) {
  if (!path) return '';
  const { getUrl } = await import('aws-amplify/storage');
  const result = await getUrl({ path, options: { expiresIn: 3600 } });
  return result.url.toString();
}


