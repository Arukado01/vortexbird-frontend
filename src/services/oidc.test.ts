import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const issuer='http://localhost:8080/realms/vortexbird';
const metadata={issuer,authorization_endpoint:issuer+'/protocol/openid-connect/auth',token_endpoint:issuer+'/protocol/openid-connect/token',end_session_endpoint:issuer+'/protocol/openid-connect/logout'};
function pending(state='valid'){sessionStorage.setItem('vortex-oidc-request',JSON.stringify({state,verifier:'test-verifier',redirectUri:location.origin,created:Date.now()}));history.replaceState(null,'','/?code=auth-code&state=valid');}
beforeEach(()=>{vi.resetModules();sessionStorage.clear();history.replaceState(null,'','/');window.__VORTEX_CONFIG__={VITE_KEYCLOAK_URL:'http://localhost:8080',VITE_KEYCLOAK_REALM:'vortexbird'};});
afterEach(()=>{vi.unstubAllGlobals();});
describe('OIDC authorization-code security',()=>{
  it('rejects callbacks whose state does not match before calling the token endpoint',async()=>{pending('other');const fetchMock=vi.fn();vi.stubGlobal('fetch',fetchMock);const oidc=await import('./oidc');await expect(oidc.completeLogin()).rejects.toThrow('validación');expect(fetchMock).not.toHaveBeenCalled();expect(sessionStorage.getItem('vortex-oidc-request')).toBeNull();});
  it('rejects metadata from a different issuer',async()=>{pending();vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({...metadata,issuer:'https://attacker.example'}))));const oidc=await import('./oidc');await expect(oidc.completeLogin()).rejects.toThrow('issuer');});
  it('keeps tokens in memory and prevents refresh resurrecting a logged-out session',async()=>{pending();let resolveRefresh:(value:Response)=>void=()=>{};const fetchMock=vi.fn().mockResolvedValueOnce(new Response(JSON.stringify(metadata))).mockResolvedValueOnce(new Response(JSON.stringify({access_token:'old-access',refresh_token:'old-refresh',expires_in:0}))).mockImplementationOnce(()=>new Promise<Response>(resolve=>{resolveRefresh=resolve;}));vi.stubGlobal('fetch',fetchMock);const oidc=await import('./oidc');expect(await oidc.completeLogin()).toBe(true);const refresh=oidc.getAccessToken();await vi.waitFor(()=>expect(fetchMock).toHaveBeenCalledTimes(3));oidc.clearTokens();resolveRefresh(new Response(JSON.stringify({access_token:'new-access',refresh_token:'new-refresh',expires_in:300})));await expect(refresh).rejects.toThrow('sesión finalizada');expect(await oidc.getAccessToken()).toBeUndefined();expect(localStorage.getItem('accessToken')).toBeNull();});
});

describe('OIDC session recovery', () => {
  it('rejects a protocol-relative provider on another origin', async () => {
    window.__VORTEX_CONFIG__ = { VITE_KEYCLOAK_URL: '//other.example/auth' };
    await expect(import('./oidc')).rejects.toThrow('pertenecer al portal');
  });

  it.each(['/auth', `${location.origin}/auth/`])('completes the portal callback with Keycloak at %s', async keycloakUrl => {
    window.__VORTEX_CONFIG__ = { VITE_KEYCLOAK_URL: keycloakUrl };
    const realm = `${location.origin}/auth/realms/vortexbird`;
    const tokenEndpoint = `${realm}/protocol/openid-connect/token`;
    pending();
    history.replaceState(null, '', `/?code=auth-code&state=valid&iss=${encodeURIComponent(realm)}`);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ issuer: realm, authorization_endpoint: `${realm}/protocol/openid-connect/auth`, token_endpoint: tokenEndpoint }))
      .mockResolvedValueOnce(Response.json({ access_token: 'test-access', expires_in: 300 }));
    vi.stubGlobal('fetch', fetchMock);
    const oidc = await import('./oidc');
    expect(await oidc.completeLogin()).toBe(true);
    expect(fetchMock.mock.calls[0][0]).toBe(`${realm}/.well-known/openid-configuration`);
    expect(fetchMock.mock.calls[1][0]).toBe(tokenEndpoint);
    expect(fetchMock.mock.calls[1][1].body.get('redirect_uri')).toBe(location.origin);
  });

  it('does not redirect visitors who have never authenticated', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const oidc = await import('./oidc');
    expect(await oidc.completeLogin()).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(oidc.isRedirectPending()).toBe(false);
  });

  it('flags the silent restore navigation so the splash survives until the provider answers', async () => {
    sessionStorage.setItem('vortex-oidc-session', '1');
    const assign = vi.fn();
    vi.stubGlobal('location', { origin: location.origin, pathname: '/orders/example', search: '', hash: '', assign });
    vi.stubGlobal('crypto', { getRandomValues: crypto.getRandomValues.bind(crypto), subtle: { digest: vi.fn().mockResolvedValue(new Uint8Array(32).buffer) } });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(metadata))));
    const oidc = await import('./oidc');
    expect(await oidc.completeLogin()).toBe(false);
    expect(assign).toHaveBeenCalledOnce();
    expect(oidc.isRedirectPending()).toBe(true);
  });

  it('recovers a reloaded tab with a new silent PKCE exchange and preserves its route', async () => {
    sessionStorage.setItem('vortex-oidc-session', '1');
    const assign = vi.fn();
    vi.stubGlobal('location', { origin: location.origin, pathname: '/orders/example', search: '?tab=timeline', hash: '', assign });
    vi.stubGlobal('crypto', { getRandomValues: crypto.getRandomValues.bind(crypto), subtle: { digest: vi.fn().mockResolvedValue(new Uint8Array(32).buffer) } });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(metadata))));
    const oidc = await import('./oidc');
    expect(await oidc.completeLogin()).toBe(false);
    expect(assign).toHaveBeenCalledOnce();
    const url = new URL(assign.mock.calls[0][0]);
    expect(url.searchParams.get('prompt')).toBe('none');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('code_challenge')).toHaveLength(43);
    const request = JSON.parse(sessionStorage.getItem('vortex-oidc-request')!);
    expect(request.returnTo).toBe('/orders/example?tab=timeline');
    expect(request.state).toBe(url.searchParams.get('state'));
    expect(request.verifier).toHaveLength(43);
    expect(sessionStorage.getItem('vortex-oidc-session')).toBeNull();
    // The marker is consumed; repeated startup cannot create a redirect loop.
    expect(await oidc.completeLogin()).toBe(false);
    expect(assign).toHaveBeenCalledOnce();
  });

  it('returns to login without looping when the Keycloak SSO session has expired', async () => {
    sessionStorage.setItem('vortex-oidc-request', JSON.stringify({ state: 'valid', verifier: 'test-verifier', redirectUri: location.origin, created: Date.now(), silent: true }));
    sessionStorage.setItem('vortex-oidc-session', '1');
    history.replaceState(null, '', '/?error=login_required&state=valid');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const oidc = await import('./oidc');
    expect(await oidc.completeLogin()).toBe(false);
    expect(await oidc.completeLogin()).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(sessionStorage.getItem('vortex-oidc-session')).toBeNull();
  });

  it('restores the original internal route while persisting only a non-secret marker', async () => {
    pending();
    const request = JSON.parse(sessionStorage.getItem('vortex-oidc-request')!);
    sessionStorage.setItem('vortex-oidc-request', JSON.stringify({ ...request, returnTo: '/orders/example?tab=timeline' }));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response(JSON.stringify(metadata))).mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'private-access', refresh_token: 'private-refresh', expires_in: 300 }))));
    const oidc = await import('./oidc');
    expect(await oidc.completeLogin()).toBe(true);
    expect(location.pathname + location.search).toBe('/orders/example?tab=timeline');
    expect(sessionStorage.getItem('vortex-oidc-session')).toBe('1');
    expect(sessionStorage.getItem('vortex-oidc-request')).toBeNull();
    expect(JSON.stringify(sessionStorage)).not.toContain('private-');
    expect(await oidc.getAccessToken()).toBe('private-access');
    oidc.clearTokens();
    expect(sessionStorage.getItem('vortex-oidc-session')).toBeNull();
  });

  it('rejects incomplete pending requests before contacting the provider', async () => {
    pending();
    const request = JSON.parse(sessionStorage.getItem('vortex-oidc-request')!);
    delete request.created;
    sessionStorage.setItem('vortex-oidc-request', JSON.stringify(request));
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const oidc = await import('./oidc');
    await expect(oidc.completeLogin()).rejects.toThrow('validación');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects token responses without a valid expiry', async () => {
    pending();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response(JSON.stringify(metadata))).mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'invalid-access' }))));
    const oidc = await import('./oidc');
    await expect(oidc.completeLogin()).rejects.toThrow('sesión válida');
    expect(await oidc.getAccessToken()).toBeUndefined();
    expect(sessionStorage.getItem('vortex-oidc-session')).toBeNull();
  });
});

describe('Cognito hosted login', () => {
  const cognitoIssuer = 'https://cognito-idp.us-east-2.amazonaws.com/us-east-2_Test';
  const hostedOrigin = 'https://test-portal.auth.us-east-2.amazoncognito.com';
  const clientId = 'testclient';

  beforeEach(() => {
    window.__VORTEX_CONFIG__ = {
      VITE_OIDC_PROVIDER: 'cognito',
      VITE_COGNITO_ISSUER: cognitoIssuer,
      VITE_COGNITO_AUTHORIZATION_ORIGIN: hostedOrigin,
      VITE_COGNITO_CLIENT_ID: clientId,
    };
  });

  it('uses the current public portal origin for PKCE and requests the API scope', async () => {
    const publicOrigin = 'https://portal-example.up.railway.app';
    const assign = vi.fn();
    vi.stubGlobal('location', { origin: publicOrigin, pathname: '/orders', search: '', hash: '', assign });
    vi.stubGlobal('crypto', {
      getRandomValues: crypto.getRandomValues.bind(crypto),
      subtle: { digest: vi.fn().mockResolvedValue(new Uint8Array(32).buffer) },
    });
    const oidc = await import('./oidc');
    await oidc.beginLogin();
    const url = new URL(assign.mock.calls[0][0]);
    expect(url.origin + url.pathname).toBe(`${hostedOrigin}/oauth2/authorize`);
    expect(url.searchParams.get('redirect_uri')).toBe(`${publicOrigin}/`);
    expect(url.searchParams.get('client_id')).toBe(clientId);
    expect(url.searchParams.get('scope')?.split(' ')).toContain('vortexbird-api/access');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
  });

  it('keeps the original refresh token when Cognito does not rotate it', async () => {
    const timestamp = Date.now();
    sessionStorage.setItem('vortex-oidc-request', JSON.stringify({
      state: 'valid', verifier: 'test-verifier', redirectUri: `${location.origin}/`,
      issuer: cognitoIssuer, clientId, created: timestamp,
    }));
    history.replaceState(null, '', '/?code=auth-code&state=valid');
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ access_token: 'first-access', refresh_token: 'first-refresh', expires_in: 0 }))
      .mockResolvedValueOnce(Response.json({ access_token: 'second-access', expires_in: 0 }))
      .mockResolvedValueOnce(Response.json({ access_token: 'third-access', expires_in: 300 }));
    vi.stubGlobal('fetch', fetchMock);
    const oidc = await import('./oidc');
    expect(await oidc.completeLogin()).toBe(true);
    expect(await oidc.getAccessToken()).toBe('second-access');
    expect(await oidc.getAccessToken()).toBe('third-access');
    expect(fetchMock.mock.calls.map(call => call[0])).toEqual(Array(3).fill(`${hostedOrigin}/oauth2/token`));
    expect(fetchMock.mock.calls[2][1].body.get('refresh_token')).toBe('first-refresh');
    expect(fetchMock.mock.calls[2][1].body.get('client_id')).toBe(clientId);
    expect(JSON.stringify(sessionStorage)).not.toContain('first-refresh');
  });
});
