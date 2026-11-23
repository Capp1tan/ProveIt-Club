import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { confirmResetPassword, confirmSignUp, configureAmplify, resendSignUpCode, resetPassword, signIn, signInWithRedirect, signUp } from '../../auth-client.js';
import { useAuth } from '../auth/AuthProvider.jsx';
import './AuthPage.css';

const countries = [['AR','Argentina','+549'],['CL','Chile','+56'],['PY','Paraguay','+595'],['UY','Uruguay','+598'],['PE','Perú','+51'],['BR','Brasil','+55']];
function phoneValue(country, value) { const raw = value.trim(); if (!raw) return ''; if (raw.startsWith('+')) return `+${raw.replace(/\D/g, '')}`; return (countries.find(([id]) => id === country)?.[2] || '') + raw.replace(/\D/g, '').replace(/^0+/, ''); }

export default function AuthPage() {
  const { status, refresh } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState('signin');
  const [step, setStep] = useState('credentials');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [country, setCountry] = useState('');
  const [phoneCountry, setPhoneCountry] = useState('AR');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');

  function say(text, error = false) { setMessage(text); setIsError(error); }
  function changeMode(value) { setMode(value); setStep('credentials'); say(''); }

  async function submit(event) {
    event.preventDefault(); if (busy) return;
    setBusy(true); say('');
    const username = email.trim().toLowerCase();
    try {
      if (!await configureAmplify()) throw new Error('No pudimos conectar con el servicio de cuentas. Intentá más tarde.');
      if (step === 'credentials' && mode === 'signup') {
        if (!country) throw new Error('Elegí el país de tu cuenta.');
        if (nickname.trim().length < 3) throw new Error('El nick debe tener entre 3 y 24 caracteres.');
        if (!phone.trim()) throw new Error('Completá tu teléfono privado.');
        try { sessionStorage.setItem('proveit:signup-country', JSON.stringify({ email: username, country })); } catch {}
        const result = await signUp({ username, password, options: { userAttributes: { email: username, nickname: nickname.trim(), phone_number: phoneValue(phoneCountry, phone) } } });
        if (result.nextStep.signUpStep === 'CONFIRM_SIGN_UP') { setStep('confirm-signup'); say('Te enviamos un código a tu email. Ingresalo para verificar la cuenta.'); }
        else { changeMode('signin'); say('Cuenta creada. Ya podés ingresar con tu email y contraseña.'); }
      } else if (step === 'credentials') {
        const result = await signIn({ username, password });
        if (result.isSignedIn) { await refresh(); navigate(location.state?.from || '/perfil', { replace: true }); }
        else if (result.nextStep.signInStep === 'CONFIRM_SIGN_UP') { setStep('confirm-signup'); say('Verificá tu email con el código que te enviamos.'); }
        else say('La cuenta requiere un paso adicional de verificación. Revisá tu email o contactá al administrador.', true);
      } else if (step === 'confirm-signup') {
        await confirmSignUp({ username, confirmationCode: code.trim() }); changeMode('signin'); say('Email verificado. Ya podés ingresar.');
      } else if (step === 'reset-request') {
        const result = await resetPassword({ username });
        if (result.nextStep.resetPasswordStep === 'CONFIRM_RESET_PASSWORD_WITH_CODE') { setStep('reset-confirm'); say('Te enviamos un código para cambiar la contraseña.'); }
        else say('Seguí las instrucciones que aparecen en pantalla.');
      } else {
        await confirmResetPassword({ username, confirmationCode: code.trim(), newPassword }); changeMode('signin'); say('Contraseña actualizada. Ya podés ingresar.');
      }
    } catch (cause) { say(cause?.message || 'No pudimos completar el acceso. Intentá otra vez.', true); }
    finally { setBusy(false); }
  }

  async function google() {
    if (busy) return; setBusy(true); say('');
    try { if (!await configureAmplify()) throw new Error('No pudimos conectar con el servicio de cuentas. Intentá más tarde.'); await signInWithRedirect({ provider: 'Google' }); }
    catch (cause) { say(cause?.message || 'No se pudo iniciar sesión con Google.', true); setBusy(false); }
  }

  async function resend() {
    setBusy(true);
    try { await resendSignUpCode({ username: email.trim().toLowerCase() }); say('Si el registro está pendiente, te llegará un nuevo código por correo.'); }
    catch (cause) { say(cause?.message || 'No pudimos reenviar el código.', true); }
    finally { setBusy(false); }
  }

  if (status === 'signed-in') return <main className="react-auth-page"><section className="react-auth-card"><p className="react-eyebrow">PROVEIT CLUB</p><h1>Ya estás dentro.</h1><p>Tu sesión está activa.</p><Link className="react-primary" to="/perfil">Ir a mi perfil ↗</Link></section></main>;

  return <main className="react-auth-page"><section className="react-auth-card">
    <p className="react-eyebrow">PROVEIT CLUB · TU CUENTA</p>
    <h1>{step === 'credentials' ? mode === 'signup' ? 'Sumate al club.' : 'Entrá al club.' : step === 'confirm-signup' ? 'Confirmá tu email.' : step === 'reset-request' ? 'Recuperá tu cuenta.' : 'Elegí otra contraseña.'}</h1>
    <p className="react-auth-intro">{mode === 'signup' && step === 'credentials' ? 'Tu nick y teléfono se registran desde el inicio. El correo debe ser único.' : 'Tus competencias, amistades y perfil están vinculados a tu cuenta.'}</p>
      {step === 'credentials' && !location.hostname.endsWith('.amplifyapp.com') && <button type="button" className="react-auth-google" onClick={() => void google()} disabled={busy}><b>G</b> Continuar con Google</button>}
      {step === 'credentials' && !location.hostname.endsWith('.amplifyapp.com') && <div className="react-auth-divider"><span>o con tu email</span></div>}
    <form className="react-auth-form" onSubmit={submit}>
      {(step === 'credentials' || step === 'confirm-signup' || step.startsWith('reset')) && <label>Correo electrónico<input required type="email" autoComplete="email" maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} disabled={busy || step === 'reset-confirm' || step === 'confirm-signup'} placeholder="vos@ejemplo.com" /></label>}
      {step === 'credentials' && <>
        {mode === 'signup' && <>
          <label>Nick único<input required minLength={3} maxLength={24} autoComplete="nickname" value={nickname} onChange={(event) => setNickname(event.target.value)} disabled={busy} placeholder="Entre 3 y 24 caracteres" /></label>
          <label>País de tu cuenta<select required value={country} onChange={(event) => setCountry(event.target.value)} disabled={busy}><option value="">Elegí tu país</option>{countries.map(([id,name]) => <option key={id} value={id}>{name}</option>)}</select></label>
          <label>País del teléfono<select required value={phoneCountry} onChange={(event) => setPhoneCountry(event.target.value)} disabled={busy}>{countries.map(([id,name,prefix]) => <option key={id} value={id}>{name} ({prefix})</option>)}</select></label>
          <label>Teléfono privado<input required type="tel" autoComplete="tel-national" maxLength={24} value={phone} onChange={(event) => setPhone(event.target.value)} disabled={busy} placeholder="Código de área y número" /></label>
        </>}
        <label>Contraseña<input required type="password" minLength={8} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} value={password} onChange={(event) => setPassword(event.target.value)} disabled={busy} placeholder="Mínimo 8 caracteres" /></label>
      </>}
      {step === 'confirm-signup' && <label>Código de verificación<input required inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(event) => setCode(event.target.value)} disabled={busy} /></label>}
      {step === 'reset-confirm' && <><label>Código de recuperación<input required inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(event) => setCode(event.target.value)} disabled={busy} /></label><label>Nueva contraseña<input required type="password" minLength={8} autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} disabled={busy} /></label></>}
      <button className="react-primary" type="submit" disabled={busy}>{busy ? 'Un momento…' : step === 'credentials' ? mode === 'signup' ? 'Crear cuenta' : 'Ingresar' : step === 'confirm-signup' ? 'Verificar cuenta' : step === 'reset-request' ? 'Enviar código' : 'Guardar contraseña'} <span aria-hidden="true">↗</span></button>
      {message && <p className={`react-auth-message${isError ? ' is-error' : ''}`} role={isError ? 'alert' : 'status'}>{message}</p>}
    </form>
    {step === 'credentials' ? <div className="react-auth-links">{mode === 'signin' ? <><button type="button" onClick={() => { setStep('reset-request'); say(''); }}>Olvidé mi contraseña</button><button type="button" onClick={() => changeMode('signup')}>Crear cuenta</button></> : <button type="button" onClick={() => changeMode('signin')}>Ya tengo cuenta · Ingresar</button>}</div> : <div className="react-auth-links"><button type="button" onClick={() => { setStep('credentials'); setMode('signin'); say(''); }}>Volver a ingresar</button>{step === 'confirm-signup' && <button type="button" onClick={() => void resend()} disabled={busy}>Reenviar código</button>}</div>}
    <Link className="react-auth-back" to="/">← Volver a ProveIt</Link>
  </section></main>;
}
