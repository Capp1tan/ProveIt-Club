// Interfaz de acceso. La configuración, los secretos OAuth y los datos viven
// en AWS; este archivo solo controla los formularios y mensajes del navegador.
import {
  configureAmplify,
  confirmResetPassword,
  confirmSignUp,
  getCurrentUser,
  resetPassword,
  signIn,
  signInWithRedirect,
  signOut,
  signUp,
} from './auth-client.js';

const modal = document.getElementById('loginModal');
if (modal) {
  const form = modal.querySelector('[data-auth-form]');
  const emailButton = modal.querySelector('[data-auth-email]');
  const googleButton = modal.querySelector('[data-auth-google]');
  const message = modal.querySelector('[data-auth-message]');
  const hint = modal.querySelector('[data-auth-hint]');
  const submit = form?.querySelector('.auth-submit');
  const email = form?.elements.email;
  let backendReady = false;
  let mode = 'signin';
  let step = 'credentials';

  configureAmplify().then(ready => {
    backendReady = ready;
    if (hint && ready) hint.textContent = 'Tu cuenta se protege con AWS Cognito.';
  });

  const showMessage = (text, isError = false) => {
    if (!message) return;
    message.hidden = false;
    message.textContent = text;
    message.dataset.error = String(isError);
  };
  const clearMessage = () => { if (message) { message.hidden = true; message.textContent = ''; } };
  const field = name => form?.querySelector(`[data-${name}]`);
  function setStep(nextStep) {
    step = nextStep;
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
    if (submit) submit.textContent = ({ credentials: mode === 'signup' ? 'Crear cuenta' : 'Ingresar con email', 'confirm-signup': 'Verificar cuenta', 'reset-request': 'Enviar código', 'reset-confirm': 'Guardar contraseña' })[nextStep] || 'Enviar código';
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
  modal.querySelectorAll('[data-auth-mode]').forEach(button => button.addEventListener('click', () => setMode(button.dataset.authMode)));

  googleButton?.addEventListener('click', async () => {
    clearMessage();
    if (!backendReady) return showMessage('El sitio todavía no recibió la configuración de Amplify. AWS debe generar amplify_outputs.json.', true);
    try { await signInWithRedirect({ provider: 'Google' }); }
    catch (error) { showMessage(error.message || 'No se pudo iniciar sesión con Google.', true); }
  });

  form?.addEventListener('submit', async event => {
    event.preventDefault();
    clearMessage();
    if (!backendReady) return showMessage('El sitio todavía no recibió la configuración de Amplify. Primero hay que desplegar el backend en AWS.', true);
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
        if (result.isSignedIn) location.href = '/perfil.html';
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

  // Si Google devuelve a la página inicial, llevamos al usuario a completar su perfil.
  if (backendReady) getCurrentUser().then(() => {
    const login = document.querySelector('[data-login]');
    if (login) {
      login.textContent = 'Mi perfil ↗';
      login.addEventListener('click', event => {
        event.preventDefault();
        event.stopImmediatePropagation();
        location.href = '/perfil.html';
      }, true);
    }
  }).catch(() => {});
}

