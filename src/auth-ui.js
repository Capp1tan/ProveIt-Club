import './disclosure-motion.js';
import {countrySelect} from './country-select.js';
import {mountPhoneCountry} from './phone-country.js';
// Acceso y estado de cuenta en la navegación.
import { Hub } from 'aws-amplify/utils';
import { loadBadges, decorateAvatar } from './badges.js';
import {
  fetchUserAttributes,
  resendSignUpCode,
  saveProfile,
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
// Se pide identidad de club al inicio; la unicidad definitiva se reserva en AWS.
let signupPhone,signupFields;
if(form){
 signupFields=document.createElement('fieldset');signupFields.className='signup-details';signupFields.hidden=true;
 signupFields.innerHTML='<legend>Tu perfil en el club</legend><label>Nick único<input name="signupNickname" minlength="3" maxlength="24" autocomplete="nickname" placeholder="Entre 3 y 24 caracteres"></label><label>País de tu cuenta<select name="signupCountry"></select></label><label>País del teléfono<select id="phoneCountry"></select></label><label>Teléfono privado <span id="phoneRequirement"></span><div class="phone-number-row"><span id="phonePrefix"></span><input id="phoneNational" type="tel" maxlength="24" autocomplete="tel-national"></div></label><small id="phoneHelp"></small><small>El nick y el teléfono deben estar libres al completar el registro. El teléfono no se verifica por SMS todavía.</small>';
 form.querySelector('[data-password-label]').after(signupFields);signupPhone=mountPhoneCountry(signupFields);countrySelect(form.elements.signupCountry);
 const resend=document.createElement('button');resend.type='button';resend.className='auth-text-button';resend.textContent='Reenviar código de verificación';resend.dataset.authResend='';resend.hidden=true;form.append(resend);
 const back=document.createElement('button');back.type='button';back.className='auth-text-button';back.textContent='Volver a ingresar';back.dataset.authBack='';back.hidden=true;back.addEventListener('click',()=>setMode('signin'));form.append(back);
 resend.addEventListener('click',async()=>{resend.disabled=true;try{await resendSignUpCode({username:email.value.trim().toLowerCase()});showMessage('Si el registro está pendiente, te llegará un nuevo código por correo.');}catch(e){showMessage(e.message || 'No pudimos reenviar el código.',true);}finally{resend.disabled=false;}});
}
let backendReady = false;
let accountEpoch=0;
document.documentElement.dataset.accountState='checking';
if(loginControl)loginControl.hidden=true;
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
  document.documentElement.dataset.accountState='signed-in';
  profileLink.dataset.accountSub = user.userId;
  decorateAvatar(profileLink, user.userId);
  const name = profile?.nickname || 'Completar perfil';
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
    avatarUrl(profile.avatarPath,{profileId:profile.id}).then(url => {
      if (profileLink.dataset.accountSub !== user.userId) return;
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
  const current=++accountEpoch;
  try {
    const user = await getCurrentUser();
    if(current!==accountEpoch)return;
    displayAccount(user);
    // El aro llega en paralelo y no retrasa el inicio de sesión ni la foto.
    void loadBadges().then(() => {
      if (profileLink?.dataset.accountSub === user.userId) decorateAvatar(profileLink, user.userId);
    }).catch(() => {});
    // Ninguna cuenta nueva continúa con un UUID o un perfil genérico.
    // El borrador de registro proviene de atributos de su propia cuenta Cognito;
    // no se guardan teléfonos ni contraseñas en localStorage/sessionStorage.
    let profile;
    try{({profile}=await loadProfile());}catch{return;}
    if(current!==accountEpoch)return;
    if(!profile){
      try{const attrs=await fetchUserAttributes();
       const country=(()=>{try{const v=JSON.parse(sessionStorage.getItem('proveit:signup-country') || '{}');return v.email===attrs.email?.toLowerCase()?v.country:'';}catch{return '';}})();
       if(attrs.nickname && attrs.phone_number && country){profile=await saveProfile(null,{nickname:attrs.nickname,country,phoneNumber:attrs.phone_number,bio:'',avatarPath:'',visibility:'PRIVATE',socialLinks:'{}',judgeEnabled:false});window.dispatchEvent(new Event('proveit:profile-updated'));}
      }catch{/* Un nick ocupado se resuelve en el formulario inicial, no se inventa otro. */}
    }
    if(current!==accountEpoch)return;
    if(!profile?.accountComplete){
      if(location.pathname!=='/perfil.html' || location.search.includes('id='))location.replace('/perfil.html?registro=1');
      return;
    }
    displayAccount(user,profile);
    try{if((location.pathname==='/' || location.pathname==='/index.html') && sessionStorage.getItem('proveit:tournament-resume')==='1'){sessionStorage.removeItem('proveit:tournament-resume');location.replace('/crear-torneo.html');}}
    catch{}

  } catch(error) {
    if(current!==accountEpoch)return;
    // Un corte de red no significa que la persona cerró sesión.
    if(error.name!=='UserUnAuthenticatedException'){
      if(profileLink?.dataset.accountSub)return;
      document.documentElement.dataset.accountState='unavailable';
      if(loginControl){loginControl.hidden=false;loginControl.textContent='Revisar acceso';}
      return;
    }
    document.documentElement.dataset.accountState='signed-out';
    if(loginControl)loginControl.innerHTML='Ingresar <span>↗</span>';
    if (profileLink) { profileLink.hidden = true; delete profileLink.dataset.accountSub; decorateAvatar(profileLink, null); }
    if (loginControl) loginControl.hidden = false;
  }
}

// Google regresa al sitio antes de que finalice el intercambio de la sesión.
// Hub actualiza el encabezado apenas Amplify termina de iniciar o cerrar sesión.
Hub.listen('auth', ({ payload }) => {
  if(payload.event==='signedOut'){
    ++accountEpoch;document.documentElement.dataset.accountState='signed-out';
    if(profileLink){profileLink.hidden=true;delete profileLink.dataset.accountSub;decorateAvatar(profileLink,null);}
    if(loginControl){loginControl.hidden=false;loginControl.innerHTML='Ingresar <span>↗</span>';}
  }else if(payload.event==='signedIn')void syncAccountControl();
});
// Inicializamos en paralelo: la lectura remota del perfil no bloquea los botones.
const backendInitialization = configureAmplify().catch(() => false).then(ready => {
  backendReady = ready;
  if(!ready){document.documentElement.dataset.accountState='unavailable';if(loginControl){loginControl.hidden=false;loginControl.textContent='Revisar acceso';}}
  if (hint && ready) hint.textContent = 'Tu cuenta se protege con AWS Cognito.';
  return syncAccountControl().finally(() => window.proveitLoadingDone?.('account')).then(() => ready);
});
window.addEventListener('proveit:profile-updated', syncAccountControl);
window.addEventListener('proveit:session-ready', syncAccountControl);

function setStep(nextStep) {
  step = nextStep;
  const field = name => form?.querySelector(`[data-${name}]`);
  const password = field('password-label')?.querySelector('input');
  const codeLabel = field('code-label');
  const code = codeLabel?.querySelector('input');
  const newPassword = field('new-password-label')?.querySelector('input');
  const credentials = nextStep === 'credentials';
  form.querySelector('[data-auth-back]').hidden=credentials;
  const registering=credentials && mode==='signup';
  signupFields.hidden=!registering;signupFields.disabled=!registering;
  form.elements.signupNickname.required=registering;form.elements.signupCountry.required=registering;signupPhone.optional(!registering);
  const resend=form.querySelector('[data-auth-resend]');if(resend)resend.hidden=nextStep!=='confirm-signup';
  if(password)password.autocomplete=registering?'new-password':'current-password';
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
      try{sessionStorage.setItem('proveit:signup-country',JSON.stringify({email:emailValue,country:form.elements.signupCountry.value}));}catch{}
      const result = await signUp({ username: emailValue, password: passwordValue, options: { userAttributes: { email: emailValue, nickname:form.elements.signupNickname.value.trim(),phone_number:signupPhone.value() } } });
      if (result.nextStep.signUpStep === 'CONFIRM_SIGN_UP') {
        setStep('confirm-signup');
        showMessage('Te enviamos un código a tu email. Ingresalo para verificar la cuenta.');
      } else {
        showMessage('Cuenta creada. Ya podés ingresar con tu email y contraseña.');
        setMode('signin');
      }
    } else if (step === 'credentials') {
      const result = await signIn({ username: emailValue, password: passwordValue });
      if (result.isSignedIn){if(location.pathname==='/admin.html'){if(modal)modal.hidden=true;document.body.classList.remove('modal-open');}else location.href = location.pathname === '/crear-torneo.html' ? '/crear-torneo.html' : '/perfil.html';}
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
    if(error.name==='UserNotConfirmedException' || (mode==='signup' && error.name==='UsernameExistsException')){setStep('confirm-signup');showMessage('Este correo ya está registrado o pendiente de verificación. Si ya lo verificaste, volvé a Ingresar; si no, podés reenviar el código.',true);}
    else showMessage(error.message || 'No se pudo completar la operación.', true);
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

Hub.listen('auth',({payload})=>{if(payload.event==='signInWithRedirect_failure'){if(modal)modal.hidden=false;showMessage('No se pudo completar el acceso con Google. Si ya tenés cuenta con ese correo, ingresá con su método original o pedí vincularla a administración.',true);}});
