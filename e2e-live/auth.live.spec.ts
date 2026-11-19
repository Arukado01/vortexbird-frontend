import { test, expect, type Page } from '@playwright/test';
import { loadLiveEnvironment } from './environment';
import { checkTable, readFromApi, readManualCatalog, visitModule, workspaceNavigation } from './workspace-tour';

const environment = loadLiveEnvironment();
const apiPath = environment.api.pathname.replace(/\/$/, '');
const tokenPath = `${environment.issuer.pathname}/protocol/openid-connect/token`;
const can = (permissions: string[], permission: string) => permissions.includes('*') || permissions.includes(permission);

test.afterEach(async ({ page }, testInfo) => {
  // Playwright can generate error-context.md even when traces are off. Remove
  // credential-bearing diagnostics before teardown, close the page before its
  // context snapshot, and let preserveOutput: never discard transient artifacts.
  for (const error of testInfo.errors) {
    error.message = 'El escenario conectado no se completó; diagnóstico sensible omitido.';
    delete error.stack;
    delete error.value;
    delete error.cause;
    delete error.errorContext;
  }
  await page.close().catch(() => {});
});

function isApi(url: string, path: string) {
  const parsed = new URL(url);
  return parsed.origin === environment.api.origin && parsed.pathname === `${apiPath}${path}`;
}

function assertTrustedProvider(page: Page) {
  const url = new URL(page.url());
  expect(url.origin === environment.issuer.origin && url.pathname.startsWith(environment.issuer.pathname + '/'), 'El formulario debe pertenecer al proveedor configurado.').toBe(true);
}

function observeAuthentication(page: Page) {
  let authorization = '';
  const evidence = { initialExpiresIn: 0, refreshes: 0, lastRefreshAt: 0, lastMeAt: 0 };
  page.on('request', request => {
    if (isApi(request.url(), '/auth/me')) authorization = request.headers().authorization || authorization;
  });
  page.on('response', response => {
    if (isApi(response.url(), '/auth/me') && response.status() === 200) evidence.lastMeAt = Date.now();
    const url = new URL(response.url());
    if (url.origin !== environment.issuer.origin || url.pathname !== tokenPath || response.status() !== 200) return;
    const grant = new URLSearchParams(response.request().postData() ?? '').get('grant_type');
    if (grant === 'refresh_token') {
      evidence.refreshes++;
      evidence.lastRefreshAt = Date.now();
    }
    // Retain only TTL, never a token response, authorization code or refresh token.
    void response.json().then((body: { expires_in?: unknown }) => {
      if (grant === 'authorization_code' && typeof body.expires_in === 'number') evidence.initialExpiresIn = body.expires_in;
    }).catch(() => {});
  });
  return { evidence, authorization: () => authorization };
}

async function startLogin(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Iniciar sesión con Keycloak', exact: true }).click();
  await page.locator('#username').waitFor({ state: 'visible' });
  assertTrustedProvider(page);
}

async function submitCredentials(page: Page, username: string, password: string) {
  assertTrustedProvider(page);
  try {
    await page.locator('#username').fill(username);
    await page.locator('#password').fill(password);
    await page.locator('#kc-login').click();
  } catch {
    // Playwright call logs can contain fill arguments. Never propagate them.
    throw new Error('No fue posible completar el formulario del proveedor de identidad.');
  }
}

async function login(page: Page, identity: typeof environment.primary) {
  const recorder = observeAuthentication(page);
  await startLogin(page);
  const receivedSession = page.waitForResponse(response => isApi(response.url(), '/auth/me') && response.status() === 200);
  void receivedSession.catch(() => {});
  await submitCredentials(page, identity.username, identity.password);
  const response = await receivedSession;
  const body = await response.json() as { permissions?: unknown; user?: { id?: unknown } };
  expect(typeof body.user?.id === 'string', 'La API debe reconocer una identidad activa vinculada.').toBe(true);
  expect(Array.isArray(body.permissions), 'La API debe devolver permisos efectivos.').toBe(true);
  const permissions = (body.permissions as unknown[]).filter((value): value is string => typeof value === 'string');
  for (const permission of identity.permissions) expect(can(permissions, permission), `La identidad requiere ${permission}.`).toBe(true);
  await expect(page.getByLabel('Menú de sesión', { exact: true })).toBeVisible();
  expect(recorder.authorization().startsWith('Bearer '), 'El portal debe usar un token del proveedor en la API.').toBe(true);
  return { recorder, permissions };
}

async function requestStatus(page: Page, path: string, authorization = '') {
  const result = await page.evaluate(async ({ url, authorization }) => {
    try {
      const response = await fetch(url, { method: 'GET', credentials: 'omit', redirect: 'error', cache: 'no-store', headers: authorization ? { Authorization: authorization } : {} });
      return { status: response.status, failed: false };
    } catch { return { status: 0, failed: true }; }
  }, { url: `${environment.api.href.replace(/\/$/, '')}${path}`, authorization });
  expect(result.failed, 'La API debe ser accesible desde el navegador con CORS válido.').toBe(false);
  return result.status;
}

test('rejects an anonymous API request and protects workspace routes', async ({ page }) => {
  await page.goto(environment.restrictedRoute);
  await expect(page.getByRole('button', { name: 'Iniciar sesión con Keycloak', exact: true })).toBeVisible();
  expect(await requestStatus(page, '/auth/me')).toBe(401);
  expect(await requestStatus(page, environment.restrictedApi)).toBe(401);
});

test('rejects invalid credentials without using a real QA username', async ({ page }) => {
  await startLogin(page);
  await submitCredentials(page, `vortexbird-invalid-${Date.now()}@example.invalid`, 'Not-A-Valid-Credential-For-Any-Account');
  await expect(page.locator('#input-error, #kc-error-message, .alert-error').first()).toBeVisible();
  await expect(page.locator('#username')).toBeVisible();
  assertTrustedProvider(page);
});

test('logs in through the real provider and authorizes the primary account', async ({ page }) => {
  const { recorder } = await login(page, environment.primary);
  expect(await requestStatus(page, '/auth/me', recorder.authorization())).toBe(200);
  expect(await requestStatus(page, '/users', recorder.authorization())).toBe(200);
  await page.getByRole('navigation', { name: 'Módulos del workspace' }).getByRole('link', { name: 'Usuarios', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Usuarios', exact: true })).toBeVisible();
});

test('restores the primary account and the original route after a real SSO reload', async ({ page }) => {
  const { recorder } = await login(page, environment.primary);
  await page.getByRole('navigation', { name: 'Módulos del workspace' }).getByRole('link', { name: 'Usuarios', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Usuarios', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Usuarios', exact: true })).toBeVisible();
  expect(new URL(page.url()).pathname).toBe('/users');
  expect(await requestStatus(page, '/users', recorder.authorization())).toBe(200);
});

test('enforces the restricted account permissions in the real API and workspace', async ({ page }) => {
  if (!environment.restricted) {
    test.skip(true, 'Cuenta QA secundaria no configurada: autorización entre roles no verificada.');
    return;
  }
  const { recorder, permissions } = await login(page, environment.restricted);
  expect(can(permissions, environment.deniedPermission), 'La cuenta restringida no debe tener users.read ni comodín.').toBe(false);
  await page.getByRole('navigation', { name: 'Módulos del workspace' }).getByRole('link', { name: 'Órdenes', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Órdenes', exact: true })).toBeVisible();
  expect(await requestStatus(page, '/orders', recorder.authorization())).toBe(200);
  expect(await requestStatus(page, environment.restrictedApi, recorder.authorization())).toBe(403);
  await page.goto(environment.restrictedRoute);
  await expect(page.getByRole('heading', { name: 'Acceso restringido', exact: true })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Módulos del workspace' }).getByRole('link', { name: 'Usuarios', exact: true })).toHaveCount(0);
});

test('refreshes an access token using the real provider clock and keeps API access', async ({ page }) => {
  test.setTimeout((environment.refreshMaxWaitSeconds + 90) * 1000);
  const { recorder } = await login(page, environment.primary);
  await expect.poll(() => recorder.evidence.initialExpiresIn).toBeGreaterThan(0);
  expect(recorder.evidence.initialExpiresIn + 75 <= environment.refreshMaxWaitSeconds, 'Aumenta LIVE_REFRESH_MAX_WAIT_SECONDS para cubrir el TTL real más 75 segundos.').toBe(true);
  await expect.poll(() => recorder.evidence.refreshes, { timeout: environment.refreshMaxWaitSeconds * 1000, intervals: [1000, 5000] }).toBeGreaterThan(0);
  await expect.poll(() => recorder.evidence.lastMeAt >= recorder.evidence.lastRefreshAt && recorder.evidence.lastMeAt > 0).toBe(true);
  expect(await requestStatus(page, '/users', recorder.authorization())).toBe(200);
  await expect(page.getByLabel('Menú de sesión', { exact: true })).toBeVisible();
});

test('logs out locally and terminates the real Keycloak SSO session', async ({ page }) => {
  await login(page, environment.primary);
  await page.getByLabel('Menú de sesión', { exact: true }).click();
  const navigated = page.waitForEvent('framenavigated', { predicate: frame => frame === page.mainFrame() });
  await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click();
  await navigated;
  const portalLogin = page.getByRole('button', { name: 'Iniciar sesión con Keycloak', exact: true });
  const confirmation = page.locator('#kc-logout');
  await Promise.race([portalLogin.waitFor({ state: 'visible' }), confirmation.waitFor({ state: 'visible' })]);
  if (await confirmation.isVisible()) { assertTrustedProvider(page); await confirmation.click(); }
  await expect(portalLogin).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem('vortex-oidc-session') === null)).toBe(true);
  await portalLogin.click();
  await expect(page.locator('#username')).toBeVisible();
  assertTrustedProvider(page);
  // If SSO survived logout, authorization would bypass this form and re-open the workspace.
  await expect(page.locator('#password')).toBeVisible();
});

test.describe('local portal with the running API', () => {
  const local = [environment.frontend, environment.api, environment.issuer].every(url =>
    ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname));
  if (!local) return;
  test.describe.configure({ timeout: 120_000 });

  test('opens the eleven public manuals from the login page and reloads their direct URLs', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Centro de ayuda', exact: true }).click();
    await readManualCatalog(page, false);
  });

  test('opens the eleven manuals from an authenticated workspace and returns to the source module', async ({ page }) => {
    await login(page, environment.primary);
    await visitModule(page, environment.api, '/users', 'Usuarios');
    await page.getByRole('link', { name: 'Manual de este módulo' }).click();
    await expect(page).toHaveURL(url => url.pathname === '/help/usuarios-permisos');
    await page.getByRole('link', { name: 'Todos los manuales' }).click();
    await readManualCatalog(page, true);
    await page.getByRole('link', { name: 'Volver al workspace' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Usuarios' })).toBeVisible();
  });

  test('reads dashboard, administration, role permissions, settings and reports from the API', async ({ page }) => {
    await login(page, environment.primary);
    const [dashboard] = await Promise.all([
      readFromApi(page, environment.api, '/dashboard', { days: '7' }),
      page.getByLabel('Período del dashboard').selectOption('7'),
    ]);
    expect(dashboard.status()).toBe(200);
    expect(typeof (await dashboard.json()).metrics.totalOrders).toBe('number');
    await expect(page.getByText('Órdenes procesadas', { exact: true })).toBeVisible();
    const users = await checkTable(page, await visitModule(page, environment.api, '/users', 'Usuarios'));
    if (users.hasNextPage) {
      const [secondPage] = await Promise.all([
        readFromApi(page, environment.api, '/users', { page: '2' }),
        page.getByRole('button', { name: 'Página siguiente' }).click(),
      ]);
      expect(secondPage.status()).toBe(200);
      await checkTable(page, secondPage, 2);
    }
    const search = `qa-no-match-${crypto.randomUUID()}`;
    const searchBox = page.getByLabel('Buscar usuarios', { exact: true });
    await searchBox.fill(search);
    const [filtered] = await Promise.all([
      readFromApi(page, environment.api, '/users', { search, page: '1' }),
      searchBox.press('Enter'),
    ]);
    expect(filtered.status()).toBe(200);
    expect((await checkTable(page, filtered)).totalCount).toBe(0);
    await expect(page.getByRole('heading', { name: 'Sin resultados' })).toBeVisible();
    for (const [route, title] of [['/partners', 'Partners'], ['/channels', 'Canales'], ['/activity-logs', 'Activity Log']]) {
      await checkTable(page, await visitModule(page, environment.api, route, title));
    }
    const [permissions] = await Promise.all([
      readFromApi(page, environment.api, '/permissions'),
      visitModule(page, environment.api, '/roles', 'Roles y permisos'),
    ]);
    expect(permissions.status()).toBe(200);
    await page.getByRole('button', { name: /^Seleccionar rol / }).first().click();
    await expect(page.getByLabel('users.read', { exact: true })).toBeVisible();
    await visitModule(page, environment.api, '/settings', 'Configuración');
    await expect(page.getByRole('heading', { name: 'Parámetros de la plataforma' })).toBeVisible();
    await expect(page.getByText('OpenID Connect · Authorization Code + PKCE', { exact: true })).toBeVisible();
    const report = await visitModule(page, environment.api, '/reports', 'Reportes', '/dashboard');
    const { ordersByDay } = await report.json();
    expect(Array.isArray(ordersByDay)).toBe(true);
    if (ordersByDay.length) await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(ordersByDay.length);
    else await expect(page.getByRole('heading', { name: 'No hay actividad en este período' })).toBeVisible();
  });

  test('reads operational lists and integration and delivery history through the workspace', async ({ page }) => {
    await login(page, environment.primary);
    for (const [route, title] of [
      ['/orders', 'Órdenes'], ['/products', 'Productos'], ['/inventory', 'Inventario'],
      ['/pricing', 'Precios'], ['/payments', 'Pagos'], ['/events', 'Eventos'],
      ['/webhooks', 'Webhooks'], ['/webhook-deliveries', 'Entregas de webhooks'],
    ]) {
      await checkTable(page, await visitModule(page, environment.api, route, title));
    }
    const integrations = await visitModule(page, environment.api, '/integrations', 'Un ecosistema conectado.');
    const { items } = await integrations.json();
    expect(Array.isArray(items)).toBe(true);
    if (items.length) await expect(page.locator('.integration-card')).toHaveCount(items.length);
    else await expect(page.getByRole('heading', { name: 'No hay adaptadores configurados' })).toBeVisible();
    await checkTable(page, await visitModule(page, environment.api, '/integration-executions', 'Ejecuciones de integraciones'));
    await workspaceNavigation(page).getByRole('link', { name: 'Dashboard' }).click();
    await expect(page.getByLabel('Período del dashboard')).toBeVisible();
  });
});
