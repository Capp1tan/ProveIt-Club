import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Hub } from 'aws-amplify/utils';
import { configureAmplify, getCurrentUser, loadProfile } from '../../auth-client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [account, setAccount] = useState({ status: 'checking', user: null, profile: null, error: null });
  const refresh = useCallback(async () => {
    setAccount((current) => ({ ...current, status: current.user ? 'signed-in' : 'checking', error: null }));
    try {
      const connected = await configureAmplify();
      if (!connected) {
        setAccount({ status: 'unavailable', user: null, profile: null, error: 'No se pudo conectar con la cuenta del club.' });
        return;
      }
      const user = await getCurrentUser();
      let profile = null;
      try { ({ profile } = await loadProfile()); } catch (error) {
        if (error?.name === 'UserUnAuthenticatedException') throw error;
      }
      setAccount({ status: 'signed-in', user, profile, error: null });
    } catch (error) {
      const signedOut = ['UserUnAuthenticatedException', 'NotAuthorizedException'].includes(error?.name);
      setAccount({ status: signedOut ? 'signed-out' : 'unavailable', user: null, profile: null, error: signedOut ? null : error?.message || 'No se pudo verificar la sesión.' });
    }
  }, []);

  useEffect(() => {
    let alive = true;
    const run = () => { if (alive) void refresh(); };
    const stop = Hub.listen('auth', ({ payload }) => {
      if (['signedIn', 'signedOut', 'tokenRefresh'].includes(payload.event)) run();
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
