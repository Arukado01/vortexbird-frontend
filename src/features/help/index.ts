export const manualByRoute: Readonly<Record<string, string>> = {
  '/': 'dashboard',
  '/users': 'usuarios-permisos',
  '/roles': 'usuarios-permisos',
  '/partners': 'partners-canales',
  '/channels': 'partners-canales',
  '/products': 'catalogo-inventario-precios',
  '/inventory': 'catalogo-inventario-precios',
  '/pricing': 'catalogo-inventario-precios',
  '/orders': 'ordenes',
  '/payments': 'pagos',
  '/events': 'eventos-webhooks',
  '/webhooks': 'eventos-webhooks',
  '/webhook-deliveries': 'eventos-webhooks',
  '/activity-logs': 'auditoria',
  '/integrations': 'integraciones-configuracion',
  '/integration-executions': 'integraciones-configuracion',
  '/settings': 'integraciones-configuracion',
  '/reports': 'reportes',
};

export function manualFor(path: string) {
  const module = path.split('/')[1];
  return manualByRoute[`/${module}`];
}

export function helpPath(manualId?: string) {
  return manualId ? `/help/${manualId}` : '/help';
}
