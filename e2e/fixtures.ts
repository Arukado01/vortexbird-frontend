import { test as base } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';

/** Chooses an option from the global searchable select by accessible name. */
export async function choose(page: Page, name: string, option: string | RegExp) {
  await page.getByRole('combobox', { name, exact: true }).click();
  const search = page.getByRole('searchbox', { name: new RegExp(`Buscar en ${name}`) });
  if (typeof option === 'string') await search.fill(option);
  await page.getByRole('option', { name: option }).first().click();
}

// The isolated mode exercises the production UI bundle with the API fixtures
// declared by each spec. It is NOT a live API, OIDC or database integration test.
export const test = base.extend({
  page: async ({ page }, runTest, testInfo) => {
    if (testInfo.config.metadata.offlineBuild === true) {
      const assets = resolve(process.cwd(), 'dist');
      const types: Record<string, string> = {
        '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
        '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2',
      };
      await page.route('https://vortexbird.test/**', async route => {
        const path = new URL(route.request().url()).pathname;
        if (path.startsWith('/api/')) return route.fulfill({ status: 404 });
        if (path === '/config.js') return route.fulfill({
          contentType: 'application/javascript',
          body: "window.__VORTEX_CONFIG__ = { VITE_DEMO_AUTH: 'true' };",
        });
        const file = resolve(assets, '.' + (extname(path) ? decodeURIComponent(path) : '/index.html'));
        if (!file.startsWith(assets + sep)) return route.abort();
        try {
          return await route.fulfill({ body: await readFile(file), contentType: types[extname(file)] });
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code === 'ENOENT') return route.fulfill({ status: 404 });
          throw error;
        }
      });
    }
    await runTest(page);
  },
});
