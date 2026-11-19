import { config, usesCognito } from '../lib/config';

interface Discovery { issuer: string; authorization_endpoint: string; token_endpoint: string; end_session_endpoint?: string }
interface Provider extends Discovery { clientId: string; scope: string; revokeEndpoint?: string }
interface Tokens { access_token: string; refresh_token?: string; expires_in: number }
interface PendingLogin { verifier: string; state: string; redirectUri: string; created: number; returnTo?: string; silent?: boolean; issuer?: string; clientId?: string }
function keycloakIssuer() {
  const relativeProvider = config.keycloakUrl.startsWith('/');
  const realmUrl = new URL(`${config.keycloakUrl.replace(/\/$/, '')}/realms/${config.realm}`, relativeProvider ? location.origin : undefined);
  if (relativeProvider && realmUrl.origin !== location.origin) throw new Error('La ruta relativa de Keycloak debe pertenecer al portal.');
  return realmUrl.href;
}

const issuer = usesCognito ? config.cognitoIssuer : keycloakIssuer();
const requestKey = 'vortex-oidc-request';
const sessionKey = 'vortex-oidc-session';
let discovery: Provider | undefined;
let accessToken: string | undefined;
let refreshToken: string | undefined;
let expiresAt = 0;
let refreshing: Promise<string | undefined> | undefined;
let sessionEpoch = 0;
let navigating = false;
/** True while this document has already kicked off a top-level provider navigation (silent restore). */
export function isRedirectPending() { return navigating; }
const encode = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
const callbackUri = () => usesCognito ? `${location.origin}/` : location.origin;

function cognitoProvider(): Provider {
  const { cognitoIssuer, cognitoClientId, cognitoAuthorizationOrigin } = config;
  const pool = /^https:\/\/cognito-idp\.([a-z0-9-]+)\.amazonaws\.com\/([a-z0-9-]+)_[A-Za-z0-9]+$/.exec(cognitoIssuer);
  const hosted = /^https:\/\/[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.auth\.([a-z0-9-]+)\.amazoncognito\.com$/.exec(cognitoAuthorizationOrigin);
  if (!pool || !hosted || pool[1] !== pool[2] || pool[1] !== hosted[1] || !/^[a-z0-9]{1,128}$/.test(cognitoClientId)) {
    throw new Error('La configuración del proveedor de acceso no es válida.');
  }
  return {
    issuer: cognitoIssuer,
    clientId: cognitoClientId,
    scope: 'openid email profile vortexbird-api/access',
    authorization_endpoint: `${cognitoAuthorizationOrigin}/oauth2/authorize`,
    token_endpoint: `${cognitoAuthorizationOrigin}/oauth2/token`,
    revokeEndpoint: `${cognitoAuthorizationOrigin}/oauth2/revoke`,
    end_session_endpoint: `${cognitoAuthorizationOrigin}/logout`,
  };
}

async function metadata() {
  if (!discovery) {
    if (usesCognito) {
      discovery = cognitoProvider();
      return discovery;
    }
    const response = await fetch(`${issuer}/.well-known/openid-configuration`);
    if (!response.ok) throw new Error('El proveedor de identidad no está disponible.');
    const data = await response.json() as Discovery;
    if (data.issuer !== issuer) throw new Error('El issuer OIDC no coincide con la configuración.');
    for (const url of [data.authorization_endpoint, data.token_endpoint]) {
      if (new URL(url).origin !== new URL(issuer).origin) throw new Error('Endpoint OIDC fuera del proveedor configurado.');
    }
    discovery = { ...data, clientId: config.clientId, scope: 'openid profile email' };
  }
  return discovery;
}

function remember(tokens: Tokens) {
  accessToken = tokens.access_token;
  refreshToken = tokens.refresh_token;
  expiresAt = Date.now() + tokens.expires_in * 1000;
  // Restore through a new PKCE exchange. Never persist access or refresh tokens.
  try { sessionStorage.setItem(sessionKey, '1'); } catch { /* Storage unavailable. */ }
}

async function exchange(body: URLSearchParams) {
  const epoch = sessionEpoch;
  const m = await metadata();
  body.set('client_id', m.clientId);
  const response = await fetch(m.token_endpoint, {
    method: 'POST', redirect: 'error',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body,
  });
  if (epoch !== sessionEpoch) throw new Error('La solicitud pertenece a una sesión finalizada.');
  if (!response.ok) { clearTokens(); throw new Error('La sesión ha expirado. Inicia sesión de nuevo.'); }
  const tokens = await response.json() as Tokens;
  if (epoch !== sessionEpoch) throw new Error('La solicitud pertenece a una sesión finalizada.');
  if (!tokens.access_token || !Number.isFinite(tokens.expires_in) || tokens.expires_in < 0) {
    clearTokens();
    throw new Error('El proveedor no devolvió una sesión válida.');
  }
  if (!tokens.refresh_token && body.get('grant_type') === 'refresh_token') tokens.refresh_token = refreshToken;
  remember(tokens);
  return accessToken;
}

export function clearTokens() {
  sessionEpoch++;
  accessToken = undefined;
  refreshToken = undefined;
  expiresAt = 0;
  refreshing = undefined;
  try { sessionStorage.removeItem(sessionKey); } catch { /* Storage unavailable. */ }
}

function internalPath(value?: string) {
  if (!value?.startsWith('/') || /^[/\\]{2}/.test(value)) return '/';
  const url = new URL(value, location.origin);
  return url.origin === location.origin ? `${url.pathname}${url.search}${url.hash}` : '/';
}

async function authorize(action?: 'register' | 'UPDATE_PASSWORD', silent = false) {
  if (usesCognito && action) throw new Error('Contacta al administrador de la plataforma para gestionar tu acceso.');
  const m = await metadata();
  const verifier = encode(crypto.getRandomValues(new Uint8Array(32)));
  const state = encode(crypto.getRandomValues(new Uint8Array(24)));
  const challenge = encode(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
  const redirectUri = callbackUri();
  const returnTo = internalPath(`${location.pathname}${location.search}${location.hash}`);
  sessionStorage.setItem(requestKey, JSON.stringify({ verifier, state, redirectUri, returnTo, created: Date.now(), silent, issuer: m.issuer, clientId: m.clientId } satisfies PendingLogin));
  const endpoint = action === 'register' ? m.authorization_endpoint.replace(/\/auth$/, '/registrations') : m.authorization_endpoint;
  const url = new URL(endpoint);
  url.search = new URLSearchParams({
    client_id: m.clientId, redirect_uri: redirectUri, response_type: 'code', scope: m.scope, state,
    code_challenge: challenge, code_challenge_method: 'S256',
    // The managed login honors a lang query parameter through the authorize redirect.
    ...(usesCognito ? { lang: 'es' } : {}),
    ...(action === 'UPDATE_PASSWORD' ? { kc_action: 'UPDATE_PASSWORD' } : {}),
    ...(silent ? { prompt: 'none' } : {})
  }).toString();
  navigating = true;
  location.assign(url.toString());
}

export async function beginLogin(action?: 'register' | 'UPDATE_PASSWORD') { await authorize(action); }

export async function completeLogin() {
  const params = new URLSearchParams(location.search);
  if (!params.has('code') && !params.has('error')) {
    if (accessToken) return true;
    let restore = false;
    try {
      restore = sessionStorage.getItem(sessionKey) === '1';
      // Consume before redirecting so an expired SSO session cannot cause a loop.
      if (restore) sessionStorage.removeItem(sessionKey);
    } catch { /* Storage unavailable. */ }
    if (restore) await authorize(undefined, true);
    return false;
  }
  const saved = sessionStorage.getItem(requestKey);
  sessionStorage.removeItem(requestKey);
  history.replaceState(null, '', location.pathname);
  if (!saved) throw new Error('La solicitud de acceso no existe o ya fue utilizada.');
  const pending = JSON.parse(saved) as PendingLogin;
  if (!pending.state || params.get('state') !== pending.state || !pending.verifier || pending.redirectUri !== callbackUri()
    || !Number.isFinite(pending.created) || Date.now() - pending.created > 600000 || pending.created > Date.now()) {
    clearTokens();
    throw new Error('La validación de la solicitud de acceso falló.');
  }
  if (params.get('iss') && params.get('iss') !== (usesCognito ? pending.issuer : issuer)) { clearTokens(); throw new Error('El emisor de la respuesta no coincide.'); }
  if (params.has('error')) {
    clearTokens();
    if (pending.silent && ['login_required', 'interaction_required', 'consent_required'].includes(params.get('error') ?? '')) return false;
    throw new Error('El proveedor canceló o rechazó el acceso.');
  }
  if (usesCognito) {
    const m = await metadata();
    if (pending.issuer !== m.issuer || pending.clientId !== m.clientId) { clearTokens(); throw new Error('Cambió el proveedor de la solicitud de acceso.'); }
  }
  await exchange(new URLSearchParams({ grant_type: 'authorization_code', code: params.get('code')!, redirect_uri: pending.redirectUri, code_verifier: pending.verifier }));
  const returnTo = internalPath(pending.returnTo);
  if (`${location.pathname}${location.search}${location.hash}` !== returnTo) {
    history.replaceState(null, '', returnTo);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }
  return true;
}

export async function getAccessToken() {
  if (!accessToken) return undefined;
  if (Date.now() < expiresAt - 30000) return accessToken;
  if (!refreshToken) { clearTokens(); throw new Error('La sesión ha expirado.'); }
  if (!refreshing) {
    const current = exchange(new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }));
    refreshing = current;
    void current.finally(() => { if (refreshing === current) refreshing = undefined; }).catch(() => {});
  }
  return refreshing;
}

export async function endSession() {
  const tokenToRevoke = refreshToken;
  clearTokens();
  const m = await metadata();
  if (usesCognito && m.revokeEndpoint && m.end_session_endpoint) {
    try {
      if (tokenToRevoke) await fetch(m.revokeEndpoint, {
        method: 'POST', redirect: 'error', credentials: 'omit', signal: AbortSignal.timeout(5000),
        body: new URLSearchParams({ token: tokenToRevoke, client_id: m.clientId }),
      });
    } finally {
      const url = new URL(m.end_session_endpoint);
      url.search = new URLSearchParams({ client_id: m.clientId, logout_uri: callbackUri() }).toString();
      location.assign(url.href);
    }
    return;
  }
  if (m.end_session_endpoint) {
    const url = new URL(m.end_session_endpoint);
    if (url.origin !== new URL(issuer).origin) throw new Error('Endpoint de cierre fuera del proveedor configurado.');
    url.search = new URLSearchParams({ client_id: config.clientId, post_logout_redirect_uri: location.origin }).toString();
    location.assign(url.toString());
  }
}

export function accountManagement() {
  if (usesCognito) return authorize('UPDATE_PASSWORD');
  location.assign(`${issuer}/account`);
}
