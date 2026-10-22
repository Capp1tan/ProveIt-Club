// Cliente de Amplify Auth, Data y Storage. Amplify genera amplify_outputs.json
// cuando se despliega el backend; sin ese archivo el sitio mantiene la demo y
// muestra una explicación, en vez de fingir que el registro funcionó.
import { Amplify } from 'aws-amplify';
import { Hub } from 'aws-amplify/utils';
import {
  confirmResetPassword,
  confirmSignIn,
  confirmSignUp,
  fetchUserAttributes,
  resendSignUpCode,
  fetchAuthSession,
  getCurrentUser as amplifyGetCurrentUser,
  resetPassword,
  signIn,
  signInWithRedirect,
  signOut,
  signUp,
} from 'aws-amplify/auth';

let configured = false;
let configurationPromise;
let dataClientPromise;
let sessionPromise;
let publicProfilePromise,publicProfileSub='',publicProfileAt=0,profileEpoch=0;
const avatarRequests=new Map();
Hub.listen('auth',({payload})=>{if(['signedOut','signedIn'].includes(payload.event)){profileEpoch++;publicProfilePromise=undefined;publicProfileSub='';avatarRequests.clear();}});
// Amplify conserva sus tokens en el almacenamiento persistente del navegador.
// Comprobamos y renovamos la sesión antes de usarla, sin guardar contraseñas.
export async function getCurrentUser() {
  const user = await amplifyGetCurrentUser();
  if (!sessionPromise) {
    sessionPromise = fetchAuthSession().then(session => {
      if (!session.tokens) throw new Error('Tu sesión venció. Volvé a ingresar.');
      return session;
    }).finally(() => { sessionPromise = undefined; });
  }
  await sessionPromise;
  return user;
}


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

export { fetchUserAttributes, resendSignUpCode, confirmResetPassword, confirmSignIn, confirmSignUp, fetchAuthSession, resetPassword, signIn, signInWithRedirect, signOut, signUp };

// El perfil público se comparte entre cabecera, cuenta y chat durante 15 segundos.
// Sólo se recuerda el ID por cuenta; no se guardan teléfono ni tokens en este caché.
export async function loadProfile({ includePrivate = false } = {}) {
  requireBackend();
  const [dataClient,user]=await Promise.all([profileClient(),getCurrentUser()]);
  if(!publicProfilePromise || publicProfileSub!==user.userId || Date.now()-publicProfileAt>15000){
    publicProfileSub=user.userId;publicProfileAt=Date.now();const current=profileEpoch;
    publicProfilePromise=(async()=>{
      let id;try{id=sessionStorage.getItem('proveit:profile-id:'+user.userId);}catch{}
      const direct=id?await dataClient.models.Profile.get({id}):{data:null};
      if(direct.errors?.length)throw new Error(direct.errors[0].message);
      let profile=direct.data;
      const owns=p=>p?.owner===user.username || p?.owner===user.userId || p?.owner?.startsWith(user.userId+'::');
      if(!owns(profile)){
        const profiles=[];let nextToken;
        do{const result=await dataClient.models.Profile.list({filter:{owner:{contains:user.userId}},limit:100,nextToken});if(result.errors?.length)throw new Error(result.errors[0].message);profiles.push(...(result.data || []));nextToken=result.nextToken;}while(nextToken);
        profiles.sort((a,b)=>(b.updatedAt || '').localeCompare(a.updatedAt || '') || a.id.localeCompare(b.id));profile=profiles[0] ?? null;
      }
      if(current!==profileEpoch)throw new Error('Tu sesión cambió.');
      if(profile)try{sessionStorage.setItem('proveit:profile-id:'+user.userId,profile.id);}catch{}
      return profile;
    })().catch(error=>{if(current===profileEpoch)publicProfilePromise=undefined;throw error;});
  }
  const [profile,accountResult]=await Promise.all([publicProfilePromise,includePrivate?dataClient.models.PrivateAccount.get({id:user.userId}):Promise.resolve({})]);
  if(accountResult.errors?.length)throw new Error(accountResult.errors[0].message);
  return {user,profile,account:accountResult.data};
}

export async function saveProfile(profileId, values) {
  requireBackend();
  const dataClient = await profileClient();
  if (!profileId) profileId = (await loadProfile()).profile?.id || null;
  const nickname = values.nickname.trim();
  /* La reserva del nick se valida atómicamente en el servidor. */
  const payload = {
    nickname,
    bio: values.bio.trim(),
    avatarPath: values.avatarPath || '',
    phoneNumber: values.phoneNumber, visibility:values.visibility, socialLinks:values.socialLinks, judgeEnabled:values.judgeEnabled,
  };
  const result = await dataClient.mutations.saveClubProfile({ profileId, ...payload });
  if (result.errors?.length) throw new Error(result.errors[0].message);
  publicProfilePromise=undefined;publicProfileAt=0;
  return result.data;
}

export async function saveAvatar(file) {
  requireBackend();
  if (!file) return null;
  if (file.size > 2 * 1024 * 1024) throw new Error('La foto debe pesar 2 MB o menos.');
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('Usá una imagen JPG, PNG o WebP.');
  }
  const {optimizeAvatar}=await import('./image-upload.js');
  file=await optimizeAvatar(file);
  const {communityAction}=await import('./community-api.js');
  const grant=await communityAction('UPLOAD',{contentType:file.type,size:file.size});
  const response=await fetch(grant.url,{method:'PUT',headers:{'Content-Type':file.type},body:file,signal:AbortSignal.timeout(60000)});
  if(!response.ok)throw new Error('No pudimos subir la foto. Reintentá.');return grant.path;
}

export function avatarUrl(path) {
  if(!path)return Promise.resolve('');
  const cached=avatarRequests.get(path);if(cached && cached.expires>Date.now())return cached.promise;
  const promise=import('./community-api.js').then(({communityAction})=>communityAction('AVATAR',{path})).then(result=>result.url);
  avatarRequests.set(path,{promise,expires:Date.now()+45000});
  promise.catch(()=>{if(avatarRequests.get(path)?.promise===promise)avatarRequests.delete(path);});
  return promise;
}


