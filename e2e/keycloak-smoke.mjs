import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { createHash, createPublicKey, randomBytes, verify } from 'node:crypto';
import process from 'node:process';
import { URL, URLSearchParams } from 'node:url';
import { chromium } from '@playwright/test';

const issuer = new URL(process.env.OIDC_QA_ISSUER ?? 'http://127.0.0.1:18089/realms/vortexbird');
assert(issuer.protocol === 'http:' && issuer.hostname === '127.0.0.1', 'Use an isolated Keycloak instance on loopback.');
assert(process.env.OIDC_QA_USERNAME && process.env.OIDC_QA_PASSWORD, 'Use a dedicated local Keycloak fixture user.');
const clientId = 'vortexbird-portal';
const callback = 'http://localhost:5173/qa-oidc';
const discovery = await globalThis.fetch(issuer.href + '/.well-known/openid-configuration').then(response => response.json());
assert.equal(discovery.issuer, issuer.href);
for (const key of ['authorization_endpoint', 'token_endpoint', 'jwks_uri', 'end_session_endpoint']) {
  assert.equal(new URL(discovery[key]).origin, issuer.origin);
}
const jwks = await globalThis.fetch(discovery.jwks_uri).then(response => response.json());
const browser = await chromium.launch();
const page = await browser.newPage();
await page.route(callback + '**', route => route.fulfill({ contentType: 'text/plain', body: 'OIDC QA callback' }));

function authorization(options = {}) {
  const verifier = randomBytes(32).toString('base64url');
  const nonce = randomBytes(16).toString('hex');
  const state = randomBytes(16).toString('hex');
  const url = new URL(discovery.authorization_endpoint);
  url.search = new URLSearchParams({
    client_id: clientId, response_type: 'code', redirect_uri: callback, scope: 'openid profile email',
    code_challenge: createHash('sha256').update(verifier).digest('base64url'),
    code_challenge_method: 'S256', state, nonce, ...options,
  }).toString();
  return { url, verifier, nonce, state };
}

async function tokenGrant(fields) {
  const response = await globalThis.fetch(discovery.token_endpoint, {
    method: 'POST',
    body: new URLSearchParams({ client_id: clientId, ...fields }),
  });
  return { status: response.status, payload: await response.json() };
}

function parseVerifiedJwt(token) {
  const [head, body, signature] = token.split('.');
  const { alg, kid } = JSON.parse(Buffer.from(head, 'base64url'));
  assert.equal(alg, 'RS256');
  const key = createPublicKey({ key: jwks.keys.find(entry => entry.kid === kid), format: 'jwk' });
  assert(verify('RSA-SHA256', Buffer.from(head + '.' + body), key, Buffer.from(signature, 'base64url')));
  const claims = JSON.parse(Buffer.from(body, 'base64url'));
  assert.equal(claims.iss, issuer.href);
  assert(claims.exp * 1000 > Date.now());
  return claims;
}

try {
  const login = authorization();
  await page.goto(login.url.href);
  await page.locator('#username').fill(process.env.OIDC_QA_USERNAME);
  await page.locator('#password').fill(process.env.OIDC_QA_PASSWORD);
  await page.locator('#kc-login').click();
  await page.waitForURL(callback + '**');
  const authResponse = new URL(page.url()).searchParams;
  assert.equal(authResponse.get('state'), login.state);
  const original = await tokenGrant({
    grant_type: 'authorization_code', code: authResponse.get('code'),
    redirect_uri: callback, code_verifier: login.verifier,
  });
  assert.equal(original.status, 200);
  const access = parseVerifiedJwt(original.payload.access_token);
  assert([access.aud].flat().includes('vortexbird-api'));
  assert.equal(access.identity_type, 'human');
  assert(access.partner_id && [access.channel_id].flat().some(Boolean));
  assert.equal(parseVerifiedJwt(original.payload.id_token).nonce, login.nonce);
  process.stdout.write('PASS Keycloak Authorization Code with PKCE, issuer, audience, signature, expiry and scoped identity claims.\n');

  const rejected = authorization({ prompt: 'none' });
  await page.goto(rejected.url.href);
  await page.waitForURL(callback + '**');
  const wrongVerifier = await tokenGrant({
    grant_type: 'authorization_code', code: new URL(page.url()).searchParams.get('code'),
    redirect_uri: callback, code_verifier: randomBytes(32).toString('base64url'),
  });
  assert.equal(wrongVerifier.status, 400);
  assert.equal(wrongVerifier.payload.error, 'invalid_grant');
  process.stdout.write('PASS Keycloak rejects a mismatched PKCE verifier.\n');

  const refreshInput = { grant_type: 'refresh_token', refresh_token: original.payload.refresh_token };
  const refresh = await tokenGrant(refreshInput);
  assert.equal(refresh.status, 200);
  assert.notEqual(refresh.payload.refresh_token, original.payload.refresh_token);
  parseVerifiedJwt(refresh.payload.access_token);
  assert.equal((await tokenGrant(refreshInput)).status, 400);
  process.stdout.write('PASS Keycloak rotates refresh tokens and rejects reuse.\n');

  const logout = new URL(discovery.end_session_endpoint);
  logout.search = new URLSearchParams({ id_token_hint: original.payload.id_token, post_logout_redirect_uri: callback }).toString();
  await page.goto(logout.href);
  await page.waitForURL(callback + '**');
  const afterLogout = authorization({ prompt: 'none' });
  await page.goto(afterLogout.url.href);
  await page.waitForURL(callback + '**');
  assert.equal(new URL(page.url()).searchParams.get('error'), 'login_required');
  process.stdout.write('PASS Keycloak logout ends the interactive session.\n');
} finally {
  await browser.close();
}
