import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { config, usesCognito } from '../../lib/config';
import { api, apiError, setTokenProvider } from '../../services/api';
import { accountManagement, beginLogin, clearTokens, completeLogin, endSession, getAccessToken, isRedirectPending } from '../../services/oidc';
import type { Session } from '../../types';

/** Explicit authentication lifecycle surfaced to the whole application. */
export type AuthStatus = 'initializing' | 'authenticated' | 'unauthenticated' | 'error';

interface Auth {
  session: Session | null;
  loading: boolean;
  initializing: boolean;
  status: AuthStatus;
  error: string;
  login: (email?: string, password?: string) => Promise<void>;
  logout: () => Promise<void>;
  register: () => Promise<void>;
  resetPassword: () => Promise<void>;
  changePassword: () => Promise<void>;
  can: (permission: string) => boolean;
  refresh: () => Promise<void>;
}

interface DemoAccess { accessToken: string; expiresAt: number }
const demoAccessKey = 'vortex-demo-access';
const Context = createContext<Auth | null>(null);
let callbackPromise: Promise<boolean> | undefined;

function readDemoAccess(): DemoAccess | undefined {
  try {
    const access = JSON.parse(sessionStorage.getItem(demoAccessKey) ?? 'null') as Partial<DemoAccess> | null;
    if (access && typeof access.accessToken === 'string' && access.accessToken
      && typeof access.expiresAt === 'number' && Number.isFinite(access.expiresAt) && access.expiresAt > Date.now()) {
      return { accessToken: access.accessToken, expiresAt: access.expiresAt };
    }
  } catch {
    // The login form is available when the browser has blocked tab storage.
  }
  removeDemoAccess();
}

function removeDemoAccess() {
  try { sessionStorage.removeItem(demoAccessKey); } catch { /* Storage unavailable. */ }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const sessionVersion = useRef(0);
  const queryClient = useQueryClient();
  const invalidateSession = useCallback(() => ++sessionVersion.current, []);

  const clear = useCallback(() => {
    invalidateSession();
    clearTimeout(timer.current);
    setSession(null);
    setTokenProvider();
    clearTokens();
    removeDemoAccess();
    queryClient.clear();
  }, [invalidateSession, queryClient]);

  const installDemoAccess = useCallback((access: DemoAccess) => {
    clearTimeout(timer.current);
    setTokenProvider(async () => Date.now() < access.expiresAt ? access.accessToken : undefined);
    timer.current = setTimeout(clear, Math.max(0, access.expiresAt - Date.now()));
  }, [clear]);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    const version = sessionVersion.current;
    try {
      const { data } = await api.get<Session>('/auth/me', { signal });
      if (usesCognito && (!data?.user || typeof data.user.displayName !== 'string' || !Array.isArray(data.permissions))) {
        throw new Error('La API no pudo verificar tus permisos. Inténtalo de nuevo.');
      }
      if (!signal?.aborted && version === sessionVersion.current) setSession(data);
    } catch (failure) {
      if (!signal?.aborted && version === sessionVersion.current && [401, 403].includes(apiError(failure).status ?? 0)) clear();
      throw failure;
    }
  }, [clear]);

  useEffect(() => {
    const startup = new AbortController();
    const restore = async () => {
      if (config.demoAuth) {
        const access = readDemoAccess();
        if (!access) return;
        installDemoAccess(access);
      } else {
        callbackPromise ??= completeLogin();
        if (!await callbackPromise || startup.signal.aborted) return;
        setTokenProvider(async () => {
          try { return await getAccessToken(); } catch (failure) { clear(); throw failure; }
        });
      }
      await refresh(startup.signal);
    };
    void restore().catch(failure => {
      if (startup.signal.aborted) return;
      const problem = apiError(failure);
      if ([401, 403].includes(problem.status ?? 0)) {
        if (usesCognito && problem.status === 403) setError('Tu cuenta no tiene permisos en VortexBird. Contacta al administrador.');
        return;
      }
      clearTimeout(timer.current);
      setTokenProvider();
      setError(problem.message);
    }).finally(() => {
      // While the silent restore redirect is in flight the document is about to
      // unload: keep the initialization screen instead of painting the login form.
      if (!startup.signal.aborted && !isRedirectPending()) setLoading(false);
    });
    return () => {
      startup.abort();
      clearTimeout(timer.current);
      invalidateSession();
      setTokenProvider();
    };
  }, [clear, refresh, installDemoAccess, invalidateSession]);

  const authenticated = session !== null;
  useEffect(() => {    if (!authenticated) return;
    const interval = setInterval(() => { void refresh().catch(() => {}); }, 60000);
    return () => clearInterval(interval);
  }, [authenticated, refresh]);

  const login = async (email?: string, password?: string) => {
    setError('');
    if (!config.demoAuth) { await beginLogin(); return; }
    const version = invalidateSession();
    const { data } = await api.post<Session>('/auth/demo-login', { email, password });
    if (version !== sessionVersion.current) return;
    const expiresAt = Date.parse(data.expiresAt ?? '');
    if (!data.accessToken || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      throw new Error('La API devolvió una sesión de demostración inválida.');
    }
    const access = { accessToken: data.accessToken, expiresAt };
    try { sessionStorage.setItem(demoAccessKey, JSON.stringify(access)); } catch { /* Storage unavailable. */ }
    installDemoAccess(access);
    setSession(data);
  };

  const logout = async () => {
    const signingOut = config.demoAuth ? undefined : endSession();
    clear();
    await signingOut;
  };

  const status: AuthStatus = session ? 'authenticated' : error ? 'error' : loading ? 'initializing' : 'unauthenticated';
  return (
    <Context.Provider value={{
      session, loading, error, login, logout,
      initializing: loading,
      status,
      refresh: () => refresh(),
      register: () => beginLogin('register'),
      resetPassword: () => beginLogin('UPDATE_PASSWORD'),
      changePassword: async () => accountManagement(),
      can: permission => !!session?.permissions?.includes(permission) || !!session?.permissions?.includes('*')
    }}>
      {children}
    </Context.Provider>
  );
}

export function useAuth() {
  const auth = useContext(Context);
  if (!auth) throw new Error('AuthProvider missing');
  return auth;
}
