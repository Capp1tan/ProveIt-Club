// Acceso y estado de cuenta en la navegación.
import { Hub } from 'aws-amplify/utils';
import { loadBadges, decorateAvatar } from './badges.js';
import {
  avatarUrl,
  configureAmplify,
  getCurrentUser,
  loadProfile,
  confirmResetPassword,
  confirmSignUp,
  resetPassword,
  signIn,
  signInWithRedirect,
  signOut,
  signUp,
} from './auth-client.js';

const modal = document.getElementById('loginModal');
const loginControl = document.querySelector('[data-login]');
const profileLink = document.querySelector('[data-profile-link]');
const form = modal?.querySelector('[data-auth-form]');
const emailButton = modal?.querySelector('[data-auth-email]');
const googleButton = modal?.querySelector('[data-auth-google]');
const message = modal?.querySelector('[data-auth-message]');
const hint = modal?.querySelector('[data-auth-hint]');
const submit = form?.querySelector('.auth-submit');
const email = form?.elements.email;
let backendReady = false;
let mode = 'signin';
let step = 'credentials';

function showMessage(text, isError = false) {
  if (!message) return;
  message.hidden = false;
  message.textContent = text;
  message.dataset.error = String(isError);
}
function clearMessage() {
  if (message) { message.hidden = true; message.textContent = ''; }
}
function displayAccount(user, profile = null) {
  if (!profileLink) return;
  profileLink.dataset.accountSub = user.userId;
  decorateAvatar(profileLink, user.userId);
  const name = profile?.nickname || user.username || 'Mi perfil';
  const fallback = document.createElement('span');
  fallback.className = 'profile-avatar-fallback';
  fallback.setAttribute('aria-hidden', 'true');
  fallback.textContent = name.trim().slice(0, 1).toLocaleUpperCase('es') || '?';
  profileLink.replaceChildren(fallback);
  profileLink.setAttribute('aria-label', `Ir al perfil de ${name}`);
  profileLink.title = `Mi perfil: ${name}`;
  profileLink.hidden = false;
  if (loginControl) loginControl.hidden = true;

  if (profile?.avatarPath) {
    avatarUrl(profile.avatarPath).then(url => {
      const image = document.createElement('img');
      // Reserva el tamaño incluso antes de cargar los estilos o la foto.
      image.width = 42; image.height = 42; image.decoding = 'async';
      image.src = url;
      image.alt = '';
      image.setAttribute('aria-hidden', 'true');
      image.addEventListener('error', () => profileLink.replaceChildren(fallback), { once: true });
      profileLink.replaceChildren(image);
    }).catch(() => {});
  }
}
async function syncAccountControl() {
  if (!backendReady) return;
  try {
    const user = await getCurrentUser();
    displayAccount(user);
    // El aro llega en paralelo y no retrasa el inicio de sesión ni la foto.
    void loadBadges().then(() => {
      if (profileLink?.dataset.accountSub === user.userId) decorateAvatar(profileLink, user.userId);
    }).catch(() => {});
    // Google vuelve al inicio: retomamos la creación sin perder el borrador.
    try {
      if (location.pathname === '/' || location.pathname === '/index.html') {
        if (sessionStorage.getItem('proveit:tournament-resume') === '1') {
          sessionStorage.removeItem('proveit:tournament-resume');
          location.replace('/crear-torneo.html');
          return;
        }
      }
    } catch { /* La sesión funciona aunque el navegador no permita guardar el borrador. */ }
    try {
      const { profile } = await loadProfile();
      if (profile) displayAccount(user, profile);
    } catch { /* El avatar con inicial sigue sirviendo aunque tarde o falle la lectura del perfil. */ }
  } catch {
    if (profileLink) { profileLink.hidden = true; delete profileLink.dataset.accountSub; decorateAvatar(profileLink, null); }
    if (loginControl) loginControl.hidden = false;
  }
}

// Google regresa al sitio antes de que finalice el intercambio de la sesión.
// Hub actualiza el encabezado apenas Amplify termina de iniciar o cerrar sesión.
Hub.listen('auth', ({ payload }) => {
  if (payload.event === 'signedIn' || payload.event === 'signedOut') {
    void syncAccountControl();
  }
});
// Inicializamos en paralelo: la lectura remota del perfil no bloquea los botones.
const backendInitialization = configureAmplify().catch(() => false).then(ready => {
  backendReady = ready;
  if (hint && ready) hint.textContent = 'Tu cuenta se protege con AWS Cognito.';
  return syncAccountControl().finally(() => window.proveitLoadingDone?.('account')).then(() => ready);
});
window.addEventListener('proveit:profile-updated', syncAccountControl);

function setStep(nextStep) {
  step = nextStep;
  const field = name => form?.querySelector(`[data-${name}]`);
  const password = field('password-label')?.querySelector('input');
  const codeLabel = field('code-label');
  const code = codeLabel?.querySelector('input');
  const newPassword = field('new-password-label')?.querySelector('input');
  const credentials = nextStep === 'credentials';
  field('password-label').hidden = !credentials;
  const needsCode = nextStep === 'confirm-signup' || nextStep === 'reset-confirm';
  codeLabel.hidden = !needsCode;
  field('new-password-label').hidden = nextStep !== 'reset-confirm';
  if (password) password.required = credentials;
  if (code) code.required = needsCode;
  if (newPassword) newPassword.required = nextStep === 'reset-confirm';
  form.querySelector('.auth-tabs').hidden = !credentials;
  form.querySelector('[data-auth-reset]').hidden = !credentials;
  if (submit) submit.textContent = ({
    credentials: mode === 'signup' ? 'Crear cuenta' : 'Ingresar con email',
    'confirm-signup': 'Verificar cuenta',
    'reset-request': 'Enviar código',
    'reset-confirm': 'Guardar contraseña',
  })[nextStep] || 'Enviar código';
}
function setMode(nextMode) {
  mode = nextMode;
  step = 'credentials';
  form.querySelectorAll('[data-auth-mode]').forEach(button => button.classList.toggle('active', button.dataset.authMode === mode));
  setStep('credentials');
  clearMessage();
}

emailButton?.addEventListener('click', () => {
  clearMessage();
  emailButton.hidden = true;
  googleButton.hidden = true;
  form.hidden = false;
  setMode('signin');
  email?.focus();
});
modal?.querySelectorAll('[data-auth-mode]').forEach(button => button.addEventListener('click', () => setMode(button.dataset.authMode)));

googleButton?.addEventListener('click', async () => {
  clearMessage();
  if (!await backendInitialization) return showMessage('El sitio todavía no recibió la configuración de Amplify. AWS debe generar amplify_outputs.json.', true);
  try {
    if (location.pathname === '/crear-torneo.html') {
      try { sessionStorage.setItem('proveit:tournament-resume', '1'); } catch {}
    }
    await signInWithRedirect({ provider: 'Google' });
  }
  catch (error) { showMessage(error.message || 'No se pudo iniciar sesión con Google.', true); }
});

form?.addEventListener('submit', async event => {
  event.preventDefault();
  clearMessage();
  if (!await backendInitialization) return showMessage('El sitio todavía no recibió la configuración de Amplify. Primero hay que desplegar el backend en AWS.', true);
  const emailValue = email.value.trim().toLowerCase();
  const passwordValue = form.elements.password.value;
  submit.disabled = true;
  try {
    if (step === 'credentials' && mode === 'signup') {
      const result = await signUp({ username: emailValue, password: passwordValue, options: { userAttributes: { email: emailValue } } });
      if (result.nextStep.signUpStep === 'CONFIRM_SIGN_UP') {
        setStep('confirm-signup');
        showMessage('Te enviamos un código a tu email. Ingresalo para verificar la cuenta.');
      } else {
        showMessage('Cuenta creada. Ya podés ingresar con tu email y contraseña.');
        setMode('signin');
      }
    } else if (step === 'credentials') {
      const result = await signIn({ username: emailValue, password: passwordValue });
      if (result.isSignedIn) location.href = location.pathname === '/crear-torneo.html' ? '/crear-torneo.html' : '/perfil.html';
      else if (result.nextStep.signInStep === 'CONFIRM_SIGN_UP') {
        setStep('confirm-signup');
        showMessage('Verificá tu email con el código que te enviamos.');
      } else showMessage('La cuenta requiere un paso adicional de verificación. Revisá tu email o contactá al administrador.', true);
    } else if (step === 'confirm-signup') {
      await confirmSignUp({ username: emailValue, confirmationCode: form.elements.code.value.trim() });
      setMode('signin');
      showMessage('Email verificado. Ya podés ingresar.');
    } else if (step === 'reset-request') {
      const result = await resetPassword({ username: emailValue });
      if (result.nextStep.resetPasswordStep === 'CONFIRM_RESET_PASSWORD_WITH_CODE') {
        setStep('reset-confirm');
        showMessage('Te enviamos un código para cambiar la contraseña.');
      } else showMessage('Seguí las instrucciones que aparecen en pantalla.');
    } else {
      await confirmResetPassword({ username: emailValue, confirmationCode: form.elements.code.value.trim(), newPassword: form.elements.newPassword.value });
      setMode('signin');
      showMessage('Contraseña actualizada. Ya podés ingresar.');
    }
  } catch (error) {
    showMessage(error.message || 'No se pudo completar la operación.', true);
  } finally { submit.disabled = false; }
});

form?.querySelector('[data-auth-reset]')?.addEventListener('click', () => {
  clearMessage();
  if (!email.value.trim()) return showMessage('Ingresá tu email primero y volvé a tocar “Olvidé mi contraseña”.', true);
  setStep('reset-request');
  showMessage('Te vamos a enviar un código para restablecer la contraseña.');
  form.requestSubmit();
});


// La campana se comparte con todas las páginas que tienen acceso de cuenta.
void import('./notifications.js').catch(() => { console.warn('No se pudo cargar la campana de invitaciones.'); });

// Al volver a una pestaña, renovamos el estado de acceso y el perfil guardado.
window.addEventListener('pageshow', () => { void syncAccountControl(); });
document.addEventListener('visibilitychange', () => { if (!document.hidden) void syncAccountControl(); });

void import('./social-nav.js').catch(() => { /* Amigos no bloquea el acceso al sitio. */ });
