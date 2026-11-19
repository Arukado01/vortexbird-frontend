import { expect } from '@playwright/test';
import { choose, test } from './fixtures';
import type { Page } from '@playwright/test';
// Explicit API fixtures for isolated UI tests. Production components never import these.
const partner='11111111-1111-1111-1111-111111111111';const channel='22222222-2222-2222-2222-222222222222';
function paged(items:unknown[]){return{items,page:1,pageSize:10,totalCount:items.length,totalPages:1,hasNextPage:false,hasPreviousPage:false};}
async function fixtures(page:Page){await page.addInitScript(()=>{window.__VORTEX_CONFIG__={VITE_DEMO_AUTH:'true'};});await page.route('**/api/v1/**',async route=>{const path=new URL(route.request().url()).pathname.replace('/api/v1','');const session={accessToken:'fixture-token',user:{id:'test-user',email:'admin@test.local',displayName:'Andes Admin'},permissions:['*'],expiresAt:new Date(Date.now()+3600000).toISOString()};const data=path.startsWith('/auth/')?session:path==='/dashboard'?{metrics:{totalOrders:248,confirmedOrders:231,pendingOrders:12,cancelledOrders:5,approvedPayments:231,rejectedPayments:5,totalRevenue:38650000,availableStock:2840,activeReservations:12,healthyIntegrations:4,pendingEvents:3,failedWebhooks:0},ordersByDay:[{date:'2026-11-09',count:28,total:4000000},{date:'2026-11-10',count:51,total:8000000},{date:'2026-11-11',count:42,total:6000000},{date:'2026-11-12',count:68,total:11000000},{date:'2026-11-13',count:59,total:9650000}],ordersByStatus:[{status:'confirmed',count:231}],ordersByChannel:[{channel:'E-commerce',count:190},{channel:'Marketplace',count:58}],recentOrders:[{id:'a1111111-1111-1111-1111-111111111111',status:'confirmed',total:129900,createdAt:'2026-11-13T15:00:00Z'}],recentActivity:[{id:'log1',action:'CreateOrder',module:'Orders',description:'Orden confirmada',createdAt:'2026-11-13T15:00:00Z'}],integrations:['ERP','WMS','OMS','CRM'].map((name,i)=>({id:String(i),name,status:'healthy'}))}:path==='/partners'?paged([{id:partner,name:'AndesRetail',code:'ANDES',enabled:true}]):path==='/channels'?paged([{id:channel,partnerId:partner,name:'E-commerce',code:'WEB',enabled:true}]):path==='/customers'?paged([{id:'customer1',externalId:'CUST-001',displayName:'Cliente de prueba',partnerId:partner}]):path==='/products'?paged([{id:'p1',sku:'SKU-001',name:'Café de origen',category:'Alimentos',active:true}]):path==='/inventory'?paged([{id:'i1',sku:'SKU-001',storeId:'BOG-01',onHand:120,reserved:5,available:115}]):path==='/roles'?paged([{id:'role1',name:'OPERATIONS',description:'Operación comercial',permissions:['orders.read'],permissionCount:1,protected:false}]):path==='/permissions'?paged([{name:'orders.read',module:'orders'},{name:'orders.create',module:'orders'}]):path==='/integrations'?paged(['ERP','WMS','OMS','CRM'].map((name,i)=>({id:String(i),name,system:name,status:'healthy',failureMode:'none',latencyMs:22,lastCheckedAt:'2026-11-13T15:00:00Z'}))):paged([]);await route.fulfill({json:data});});}
async function login(page:Page){await fixtures(page);await page.goto('/');await page.getByLabel('Correo electrónico').fill('admin@andesretail.local');await page.getByLabel('Contraseña',{exact:true}).fill('test-only-password');await page.getByRole('button',{name:'Iniciar sesión',exact:true}).click();await expect(page.getByRole('heading',{name:'Tu operación, conectada.'})).toBeVisible();}
async function navigate(page:Page,title:string){const opener=page.getByRole('button',{name:'Abrir menú'});if(await opener.isVisible())await opener.click();await page.getByRole('navigation').getByRole('link',{name:title,exact:true}).click();}

test('restores the session on reload without ever painting the login screen', async ({ page }) => {
  await fixtures(page);
  await page.addInitScript(() => {
    const flag = window as typeof window & { __loginFlash?: boolean };
    flag.__loginFlash = false;
    const scan = () => { if (document.body?.textContent?.includes('Todo empieza conectado.')) flag.__loginFlash = true; };
    const start = () => { scan(); new MutationObserver(scan).observe(document.body, { childList: true, subtree: true }); };
    if (document.body) start(); else document.addEventListener('DOMContentLoaded', start, { once: true });
  });
  await page.goto('/');
  await page.getByLabel('Correo electrónico').fill('admin@andesretail.local');
  await page.getByLabel('Contraseña', { exact: true }).fill('test-only-password');
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Tu operación, conectada.' })).toBeVisible();
  await navigate(page, 'Órdenes');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Órdenes', exact: true })).toBeVisible();
  expect(await page.evaluate(() => (window as typeof window & { __loginFlash?: boolean }).__loginFlash)).toBe(false);
});

test('keeps the demo session and theme on reload and clears the session on logout', async ({ page }) => {
  await fixtures(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Activar tema oscuro' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByLabel('Correo electrónico').fill('admin@andesretail.local');
  await page.getByLabel('Contraseña', { exact: true }).fill('test-only-password');
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Tu operación, conectada.' })).toBeVisible();

  const restored = page.waitForRequest(request => request.url().endsWith('/api/v1/auth/me'));
  await page.reload();
  expect((await restored).headers().authorization).toBe('Bearer fixture-token');
  await expect(page.getByRole('heading', { name: 'Tu operación, conectada.' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  await page.getByLabel('Menú de sesión').click();
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Todo empieza conectado.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Activar tema claro' })).toBeVisible();
});
test('renders backend aggregates, theme and responsive navigation',async({page},info)=>{await login(page);await expect(page.getByText('248',{exact:true})).toBeVisible();await expect(page.getByText('Datos persistidos en la plataforma.',{exact:false})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBeTruthy();await page.screenshot({path:info.outputPath('dashboard.png'),fullPage:true});await page.getByRole('button',{name:'Activar tema oscuro'}).click();await expect(page.locator('html')).toHaveAttribute('data-theme','dark');await navigate(page,'Integraciones');await expect(page.getByRole('heading',{name:'Un ecosistema conectado.'})).toBeVisible();await page.screenshot({path:info.outputPath('integrations-dark.png'),fullPage:true});});
test('loads a role permission matrix and persists changes',async({page})=>{await login(page);await navigate(page,'Roles y permisos');await page.getByRole('button',{name:'Seleccionar rol OPERATIONS'}).click();await page.getByLabel('orders.create',{exact:true}).check();const request=page.waitForRequest(r=>r.url().endsWith('/roles/role1/permissions')&&r.method()==='PUT');await page.getByRole('button',{name:'Guardar permisos'}).click();expect((await request).postDataJSON()).toEqual({permissions:['orders.read','orders.create']});});
test('retains idempotency key after a failed order request',async({page})=>{await login(page);await navigate(page,'Órdenes');await page.getByRole('button',{name:'Crear orden',exact:true}).click();await choose(page,'Partner','AndesRetail');await choose(page,'Canal','E-commerce');await choose(page,'Tienda','BOG-01');await choose(page,'Cliente','CUST-001');await choose(page,'Producto 1','SKU-001');const keys:string[]=[];await page.route('**/api/v1/orders',async route=>{if(route.request().method()==='POST'){keys.push(route.request().headers()['idempotency-key']);await route.fulfill({status:503,json:{title:'Servicio temporalmente no disponible',detail:'Fallo simulado de prueba'}});}else await route.fallback();});await page.getByRole('dialog').getByRole('button',{name:'Crear orden',exact:true}).click();await expect(page.getByRole('alert')).toContainText('Fallo simulado');await page.getByRole('dialog').getByRole('button',{name:'Crear orden',exact:true}).click();await expect.poll(()=>keys.length).toBe(2);expect(keys[0]).toBeTruthy();expect(keys[0]).toBe(keys[1]);});

