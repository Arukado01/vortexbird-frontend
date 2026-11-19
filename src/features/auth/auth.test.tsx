import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from './AuthProvider';

const { get, completeLogin, isRedirectPending, configState } = vi.hoisted(() => ({
  get: vi.fn(),
  completeLogin: vi.fn(),
  isRedirectPending: vi.fn(),
  configState: { demoAuth: false } as { demoAuth: boolean },
}));
vi.mock('../../services/api', () => ({ api: { get }, apiError: (error: unknown) => ({ message: error instanceof Error ? error.message : String(error) }), setTokenProvider: vi.fn() }));
vi.mock('../../services/oidc', () => ({
  beginLogin: vi.fn(), completeLogin, isRedirectPending, clearTokens: vi.fn(),
  getAccessToken: vi.fn(), endSession: vi.fn(), accountManagement: vi.fn(),
}));
vi.mock('../../lib/config', () => ({
  usesCognito: false,
  config: new Proxy({}, { get: (_target, key: string) => key === 'demoAuth' ? configState.demoAuth : undefined }),
}));

let releaseSession: ((value: unknown) => void) | undefined;
function Probe() {
  const auth = useAuth();
  return <div>
    <span data-testid="status">{auth.status}</span>
    <span data-testid="has-session">{auth.session ? 'yes' : 'no'}</span>
  </div>;
}
function mount() {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><AuthProvider><Probe /></AuthProvider></QueryClientProvider>);
}

describe('AuthProvider initialization states', () => {
  afterEach(() => {
    window.sessionStorage.clear();
    releaseSession = undefined;
    configState.demoAuth = false;
  });

  it('stays initializing (and never drops to login) while the session is being restored', async () => {
    configState.demoAuth = true;
    window.sessionStorage.setItem('vortex-demo-access', JSON.stringify({ accessToken: 'qa', expiresAt: Date.now() + 60000 }));
    get.mockImplementation(() => new Promise(resolve => { releaseSession = resolve; }));
    completeLogin.mockResolvedValue(false);
    isRedirectPending.mockReturnValue(false);
    mount();
    expect(screen.getByTestId('status').textContent).toBe('initializing');
    releaseSession!({ data: { user: { id: 'u', displayName: 'Operador', email: 'a@b.co' }, permissions: ['*'] } });
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('authenticated'));
  });

  it('reports unauthenticated only after the restore finishes without a session', async () => {
    completeLogin.mockResolvedValue(false);
    isRedirectPending.mockReturnValue(false);
    get.mockResolvedValue({ data: {} });
    mount();
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('unauthenticated'));
    expect(screen.getByTestId('has-session').textContent).toBe('no');
  });

  it('does not end initialization while the silent restore redirect is pending', async () => {
    completeLogin.mockResolvedValue(false);
    isRedirectPending.mockReturnValue(true);
    mount();
    await new Promise(resolve => setTimeout(resolve, 30));
    expect(screen.getByTestId('status').textContent).toBe('initializing');
    expect(get).not.toHaveBeenCalled();
  });
});
