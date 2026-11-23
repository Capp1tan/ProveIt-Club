/** Client-side email syntax check. It cannot determine whether a mailbox exists. */
export function isValidAccountEmail(value) {
  const email = String(value || '').trim();
  if (!email || email.length > 254) return false;
  const at = email.lastIndexOf('@');
  if (at < 1 || at > 64 || email.indexOf('@') !== at) return false;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1).toLowerCase();
  if (local.startsWith('.') || local.endsWith('.') || local.includes('..')) return false;
  if (!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/i.test(local)) return false;
  const labels = domain.split('.');
  if (labels.length < 2 || labels.some(label => !label || label.length > 63 || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(label))) return false;
  const tld = labels.at(-1);
  // Public email addresses end with a registered alphabetic or internationalized TLD.
  return /^[a-z]{2,63}$/i.test(tld) || /^xn--[a-z0-9-]{2,59}$/i.test(tld);
}

/** Converts Cognito/Amplify errors (including PreSignUp's wrapper) into user-facing Spanish. */
export function authErrorMessage(error, context = '') {
  const name = String(error?.name || error?.__type || '').split('#').at(-1).toLowerCase();
  const message = String(error?.message || error || '').toLowerCase();
  const text = `${name} ${message}`;

  if (text.includes('ya hay un registro en curso') || text.includes('registration is in progress')) {
    return 'Ya hay un registro pendiente con ese correo. Revisá tu bandeja y spam; si no llegó el código, esperá unos minutos e intentá de nuevo.';
  }
  if (text.includes('ya tiene una cuenta') || text.includes('email already exists') || text.includes('usernameexists') || text.includes('aliasexists')) {
    return 'Ese correo ya tiene una cuenta. Ingresá con el método que usaste al crearla o recuperá el acceso.';
  }
  if (text.includes('correo válido') || text.includes('invalid email') || text.includes('invalidparameter') && text.includes('email')) {
    return 'Revisá el correo: escribí una dirección válida, por ejemplo nombre@gmail.com.';
  }
  if (text.includes('email_format_invalid')) return 'Revisá el correo: escribí una dirección válida, por ejemplo nombre@gmail.com.';
  if (text.includes('invalidpassword') || text.includes('password did not conform') || text.includes('password policy')) {
    return 'La contraseña debe tener al menos 8 caracteres. No hace falta incluir mayúsculas, números ni símbolos.';
  }
  if (text.includes('usernotconfirmed')) return 'La cuenta todavía no está verificada. Revisá tu correo o pedí que te reenviemos el código.';
  if (text.includes('codemismatch')) return context.includes('signup') ? 'El código de verificación no coincide. Revisalo e intentá de nuevo.' : 'El código de recuperación no coincide. Revisalo e intentá de nuevo.';
  if (text.includes('expiredcode')) return 'Ese código venció. Solicitá uno nuevo y usalo apenas llegue.';
  if (text.includes('limitexceeded') || text.includes('toomanyrequests')) return 'Se hicieron demasiados intentos. Esperá un rato y volvé a probar.';
  if (text.includes('notauthorized') || text.includes('incorrect username or password')) return 'El correo o la contraseña no coinciden. Revisalos o recuperá tu contraseña.';
  if (text.includes('network') || text.includes('failed to fetch')) return 'No pudimos conectar con el servicio de cuentas. Revisá tu conexión e intentá de nuevo.';
  if (context === 'reset-request') return 'No pudimos iniciar la recuperación ahora. Esperá un momento e intentá de nuevo.';
  if (context === 'signup' && (text.includes('presignup') || text.includes('userlambda'))) return 'No pudimos completar el registro. Revisá tus datos; si el problema continúa, escribinos.';
  return 'No pudimos completar la operación. Revisá los datos e intentá de nuevo.';
}
