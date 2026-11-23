import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Hub } from 'aws-amplify/utils';
import { configureAmplify, getCurrentUser, loadProfile } from '../../auth-client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [account, setAccount] = useState({ status: 'checking', user: null, profile: null, error: null });
  const refreshPromise = useRef(null);
  const refreshGeneration = useRef(0);
  const refresh = useCallback(() => {
    if (refreshPromise.current) return refreshPromise.current;
    const generation = ++refreshGeneration.current;
    setAccount((current) => ({ ...current, status: current.user ? 'signed-in' : 'checking', error: null }));
    const operation = (async () => {
      try {
        const connected = await configureAmplify();
        if (!connected) throw Object.assign(new Error('No se pudo conectar con la cuenta del club.'), { name: 'BackendUnavailable' });
        const user = await getCurrentUser();
        if (generation !== refreshGeneration.current) return;

        // La identidad se confirma antes de consultar datos del perfil. Así, una
        // demora del API de datos no deja el encabezado en «Cuenta…» indefinidamente.
        setAccount((current) => ({
          status: 'signed-in', user,
          profile: current.user?.userId === user.userId ? current.profile : null,
          error: null,
        }));
        try {
          const { profile } = await loadProfile();
          if (generation === refreshGeneration.current) setAccount({ status: 'signed-in', user, profile, error: null });
        } catch (error) {
          if (generation !== refreshGeneration.current) return;
          if (error?.name === 'UserUnAuthenticatedException') throw error;
          // La sesión sigue siendo válida aunque todavía no podamos leer el perfil.
          setAccount((current) => current.user?.userId === user.userId
            ? { ...current, status: 'signed-in', user, error: error?.message || null }
            : current);
        }
      } catch (error) {
        if (generation !== refreshGeneration.current) return;
        const signedOut = ['UserUnAuthenticatedException', 'NotAuthorizedException'].includes(error?.name);
        setAccount({ status: signedOut ? 'signed-out' : 'unavailable', user: null, profile: null, error: signedOut ? null : error?.message || 'No se pudo verificar la sesión.' });
      }
    })();
    refreshPromise.current = operation.finally(() => {
      if (generation === refreshGeneration.current) refreshPromise.current = null;
    });
    return refreshPromise.current;
  }, []);

  useEffect(() => {
    let alive = true;
    const run = () => { if (alive) void refresh(); };
    const stop = Hub.listen('auth', ({ payload }) => {
      if (payload.event === 'signedOut') {
        ++refreshGeneration.current;
        refreshPromise.current = null;
        if (alive) setAccount({ status: 'signed-out', user: null, profile: null, error: null });
      } else if (payload.event === 'signedIn') run();
    });
    const onProfileUpdated = () => run();
    window.addEventListener('proveit:profile-updated', onProfileUpdated);
    run();
    return () => { alive = false; stop(); window.removeEventListener('proveit:profile-updated', onProfileUpdated); };
  }, [refresh]);

  const value = useMemo(() => ({ ...account, refresh }), [account, refresh]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth debe usarse dentro de AuthProvider.');
  return value;
}
