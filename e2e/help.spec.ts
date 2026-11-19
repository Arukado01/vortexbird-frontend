import { expect, type Page } from '@playwright/test';
import { test } from './fixtures';
import { mkdir, readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { helpPath, manualByRoute } from '../src/features/help/index';

async function signIn(page: Page, permissions: string[]) {
  await page.addInitScript(() => {
    sessionStorage.setItem('vortex-demo-access', JSON.stringify({ accessToken: 'help-qa-token', expiresAt: Date.now() + 600_000 }));
  });
  await page.route('**/api/v1/**', async route => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname.endsWith('/auth/me')) {
      return route.fulfill({ json: { user: { id: 'qa-user', displayName: 'Operador de prueba', email: 'operador@example.invalid' }, permissions } });
    }
    if (pathname.endsWith('/dashboard')) {
      return route.fulfill({ json: {
        metrics: { totalOrders: 28, confirmedOrders: 23, pendingOrders: 4, cancelledOrders: 1, totalRevenue: 2650000, approvedPayments: 23, rejectedPayments: 1, availableStock: 572, activeReservations: 7, healthyIntegrations: 4, pendingEvents: 2, failedWebhooks: 0 },
        ordersByDay: [{ date: '2026-11-16', count: 12, total: 1200000 }, { date: '2026-11-17', count: 16, total: 1450000 }],
        ordersByStatus: [], ordersByChannel: [{ channel: 'Comercio electrónico', count: 28 }],
        recentOrders: [], recentActivity: [], integrations: [{ id: 'erp', name: 'ERP', status: 'healthy' }],
      } });
    }
    return route.fulfill({ json: { items: [], totalCount: 0, totalPages: 0, page: 1, pageSize: 10 } });
  });
}

test('opens public help from login and searches with module and profile filters', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Centro de ayuda' }).click();
  await expect(page.getByRole('heading', { name: 'Centro de ayuda' })).toBeVisible();
  await page.getByRole('searchbox', { name: 'Buscar en los manuales' }).fill('restablecer contrasena');
  await page.getByRole('combobox', { name: 'Módulo' }).click();
  await page.getByRole('option', { name: 'Acceso' }).click();
  await page.getByRole('combobox', { name: 'Tipo de usuario' }).click();
  await page.getByRole('option', { name: 'Visitante' }).click();
  await expect(page.getByRole('status')).toHaveText('1 manual');
  await page.getByRole('link', { name: /Acceso a la plataforma/ }).click();
  await expect(page.getByRole('heading', { name: 'Recuperar contraseña' })).toBeVisible();
  await expect(page.locator('.help-metadata dd').first()).toHaveText(/^\d+\.\d+\.\d+$/);
  const screenshot = page.locator('.help-illustration img');
  await screenshot.scrollIntoViewIfNeeded();
  await expect(screenshot).toHaveJSProperty('complete', true);
  await expect.poll(() => screenshot.evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await expect(page.getByRole('heading', { name: 'Historial de cambios' })).toBeVisible();
  await page.getByRole('link', { name: 'Todos los manuales' }).click();
  await expect(page.getByRole('searchbox', { name: 'Buscar en los manuales' })).toHaveValue('restablecer contrasena');
  await page.getByRole('searchbox', { name: 'Buscar en los manuales' }).fill('no hay coincidencias qa');
  await expect(page.getByRole('heading', { name: 'No encontramos manuales' })).toBeVisible();
});

test('filters manuals through the searchable selects without overflow', async ({ page }, info) => {
  await page.goto('/help');
  // Search inside the combobox narrows the options before choosing.
  await page.getByRole('combobox', { name: 'Módulo' }).click();
  await page.getByRole('searchbox', { name: 'Buscar en Módulo' }).fill('acc');
  await page.getByRole('option', { name: 'Acceso' }).click();
  await expect(page.getByRole('status')).toHaveText('1 manual');
  await page.getByRole('combobox', { name: 'Tipo de usuario' }).click();
  await page.getByRole('option', { name: 'Operador' }).click();
  await expect(page.getByRole('status')).toHaveText('1 manual');
  // Clearing resets to the full catalog and the URL keeps the filters shareable.
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Limpiar filtros' }).click();
  await expect(page.getByRole('status')).toHaveText('11 manuales');
  if (info.project.name === 'desktop') {
    await page.setViewportSize({ width: 390, height: 850 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
});

test('reads all general guides directly and after reload without requesting auth', async ({ page }) => {
  test.setTimeout(60_000);
  const manualsDir = resolve(process.cwd(), 'docs/user-manuals');
  const files = (await readdir(manualsDir)).filter(file => file.endsWith('.json'));
  const authRequests: string[] = [];
  await page.route('**/auth/me', route => {
    authRequests.push(route.request().url());
    return route.abort();
  });
  await page.goto('/help');
  await expect(page.getByRole('status')).toHaveText(files.length + ' manuales');
  for (const file of files) {
    const manual = JSON.parse(await readFile(resolve(manualsDir, file), 'utf8'));
    await page.goto(helpPath(manual.id));
    await expect(page.getByRole('heading', { name: manual.title, level: 1 })).toBeVisible();
    for (const section of manual.sections) {
      await expect(page.getByRole('heading', { name: section.title, level: 2 })).toBeVisible();
    }
    await expect(page.getByRole('heading', { name: 'Preguntas frecuentes' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Imprimir o guardar en PDF' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { name: manual.title, level: 1 })).toBeVisible();
  }
  expect(authRequests).toHaveLength(0);
  await page.goto('/help?q=referencia+comercial');
  await expect(page.getByRole('link', { name: /Pagos y conciliación/ })).toBeVisible();
  await page.goto('/help/inexistente');
  await expect(page.getByRole('heading', { name: 'Manual no encontrado' })).toBeVisible();
});

test('shows public procedures while guarding access to workspace actions', async ({ page }) => {
  await signIn(page, ['orders.read']);
  await page.goto('/help/ordenes');
  await expect(page.getByRole('heading', { name: 'Consultar una orden' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Crear una orden' })).toBeVisible();
  await page.goto('/help/pagos');
  await expect(page.getByRole('heading', { name: 'Consultar pagos' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Ir al módulo' })).toHaveCount(0);
  await page.goto('/users');
  await expect(page.getByRole('heading', { name: 'Acceso restringido' })).toBeVisible();
});

test('provides contextual help on all workspace routes and returns to the originating order', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'Shared route mappings are exercised once.');
  await signIn(page, ['*']);
  for (const [route, manual] of Object.entries(manualByRoute)) {
    await page.goto(route);
    await expect(page.getByRole('link', { name: 'Manual de este módulo' })).toHaveAttribute('href', helpPath(manual));
  }
  const detail = '/orders/a1111111-1111-1111-1111-111111111111?tab=timeline#trace';
  await page.goto(detail);
  await page.getByRole('link', { name: 'Manual de este módulo' }).click();
  await expect(page.getByRole('heading', { name: 'Gestión de órdenes' })).toBeVisible();
  await page.getByRole('link', { name: 'Volver al workspace' }).click();
  await expect(page).toHaveURL(url => url.pathname + url.search + url.hash === detail);
});

test('offers help before delegating registration and recovery to Keycloak', async ({ page }) => {
  await page.route('**/config.js', route => route.fulfill({ contentType: 'application/javascript', body: "window.__VORTEX_CONFIG__ = { VITE_DEMO_AUTH: 'false' };" }));
  await page.goto('/');
  for (const title of ['Crear cuenta', 'Recuperar contraseña']) {
    await page.getByRole('link', { name: title, exact: true }).click();
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Centro de ayuda' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continuar con Keycloak' })).toBeVisible();
    const origin = new URL(page.url()).pathname;
    await page.getByRole('link', { name: 'Centro de ayuda' }).click();
    await expect(page.getByRole('heading', { name: 'Centro de ayuda' })).toBeVisible();
    await page.getByRole('link', { name: 'Ir al inicio de sesión' }).click();
    await expect(page).toHaveURL(url => url.pathname === origin);
    await page.getByRole('link', { name: 'Volver al inicio de sesión' }).click();
  }
});

test('supports dark mode, printable output, and desktop, tablet and mobile widths', async ({ page }, info) => {
  await page.goto('/help/acceso');
  await page.getByRole('button', { name: 'Activar tema oscuro' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.evaluate(() => { window.print = () => document.body.setAttribute('data-printed', 'true'); });
  await page.getByRole('button', { name: 'Imprimir o guardar en PDF' }).click();
  await expect(page.locator('body')).toHaveAttribute('data-printed', 'true');
  if (info.project.name === 'desktop') {
    for (const width of [1280, 820, 390]) {
      await page.setViewportSize({ width, height: 850 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    }
    await page.emulateMedia({ media: 'print' });
    await expect(page.locator('.help-header')).toBeHidden();
    await expect(page.getByRole('heading', { name: 'Preguntas frecuentes' })).toBeVisible();
    const pdf = await page.pdf({ format: 'A4' });
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
  }
});

test('refreshes screenshots of current screens using synthetic data', async ({ page }, info) => {
  test.skip(!process.env.UPDATE_HELP_SCREENSHOTS || info.project.name !== 'desktop', 'Run with UPDATE_HELP_SCREENSHOTS=1 after changes to illustrated screens.');
  const media = resolve(process.cwd(), 'public/help-media');
  await mkdir(media, { recursive: true });
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Centro de ayuda' })).toBeVisible();
  await page.screenshot({ path: resolve(media, 'acceso.png'), animations: 'disabled' });
  await signIn(page, ['*']);
  await page.goto('/');
  await expect(page.getByText('28', { exact: true }).first()).toBeVisible();
  await page.screenshot({ path: resolve(media, 'dashboard.png'), animations: 'disabled' });
});
