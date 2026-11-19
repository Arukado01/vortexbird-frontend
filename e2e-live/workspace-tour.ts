import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, type Page, type Response } from '@playwright/test';
import { helpPath, manualByRoute } from '../src/features/help/index';

export function workspaceNavigation(page: Page) {
  return page.getByRole('navigation', { name: 'Módulos del workspace' });
}

export function readFromApi(page: Page, api: URL, path: string, query: Record<string, string> = {}) {
  const pathname = api.pathname.replace(/\/$/, '') + path;
  return page.waitForResponse(response => {
    const url = new URL(response.url());
    return response.request().method() === 'GET' && url.origin === api.origin && url.pathname === pathname
      && Object.entries(query).every(([key, value]) => url.searchParams.get(key) === value);
  });
}

export async function visitModule(page: Page, api: URL, route: string, title: string, endpoint = route) {
  const isHistory = route === '/webhook-deliveries' || route === '/integration-executions';
  const container = isHistory ? page.getByRole('main') : workspaceNavigation(page);
  const [response] = await Promise.all([
    readFromApi(page, api, endpoint),
    container.locator(`a[href="${route}"]`).click(),
  ]);
  expect(response.status(), `GET ${endpoint}`).toBe(200);
  await expect(page.getByRole('heading', { name: title, exact: true, level: 1 })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Manual de este módulo' })).toHaveAttribute('href', helpPath(manualByRoute[route]));
  return response;
}

export async function checkTable(page: Page, response: Response, expectedPage = 1) {
  const data = await response.json();
  expect(data.page).toBe(expectedPage);
  expect(data.pageSize).toBe(10);
  expect(Array.isArray(data.items)).toBe(true);
  expect(data.items.length).toBeLessThanOrEqual(10);
  const table = page.getByRole('main').getByRole('table');
  await expect(table).toBeVisible();
  await expect(table.locator('tbody tr')).toHaveCount(data.items.length);
  await expect(page.getByRole('button', { name: 'Página siguiente' })).toBeEnabled({ enabled: data.hasNextPage });
  return { hasNextPage: data.hasNextPage === true, totalCount: data.totalCount as number };
}

export async function readManualCatalog(page: Page, signedIn: boolean) {
  const directory = join(process.cwd(), 'docs', 'user-manuals');
  const files = (await readdir(directory)).filter(file => file.endsWith('.json')).sort();
  expect(files).toHaveLength(11);
  const catalog = page.getByRole('region', { name: 'Manuales disponibles' });
  await expect(catalog.getByRole('status')).toHaveText('11 manuales');
  await catalog.getByRole('searchbox').fill('restablecer contrasena');
  await page.getByLabel('Módulo', { exact: true }).selectOption('Acceso');
  await page.getByLabel('Tipo de usuario').selectOption('Visitante');
  await expect(catalog.getByRole('status')).toHaveText('1 manual');
  await page.getByRole('button', { name: 'Limpiar filtros' }).click();
  for (const file of files) {
    const manual: { id: string; title: string; history: { version: string }[] } =
      JSON.parse(await readFile(join(directory, file), 'utf8'));
    await catalog.locator(`a[href="${helpPath(manual.id)}"]`).click();
    const heading = page.getByRole('heading', { level: 1, name: manual.title, exact: true });
    await expect(heading).toBeVisible();
    await expect(page.locator('.help-metadata dd').first()).toHaveText(manual.history[0].version);
    await expect(page.getByRole('heading', { name: 'Historial de cambios' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Imprimir o guardar en PDF' })).toBeVisible();
    await expect(page.getByRole('link', { name: signedIn ? 'Volver al workspace' : 'Ir al inicio de sesión' })).toBeVisible();
    if (!signedIn) {
      await page.reload();
      await expect(heading).toBeVisible();
    }
    await page.getByRole('link', { name: 'Todos los manuales' }).click();
  }
  await expect(catalog.getByRole('status')).toHaveText('11 manuales');
}
