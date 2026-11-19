import { readFileSync } from 'node:fs';

export interface LiveEnvironment {
  frontend: URL;
  api: URL;
  issuer: URL;
  primary: { username: string; password: string; permissions: string[] };
  restricted?: { username: string; password: string; permissions: string[] };
  restrictedRoute: string;
  restrictedApi: string;
  deniedPermission: string;
  refreshMaxWaitSeconds: number;
}

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Falta la variable requerida ${name}. Consulta docs/testing/live-auth.md.`);
  return value;
}

function endpoint(name: string, fallback?: string) {
  let url: URL;
  try { url = new URL(process.env[name] || fallback || required(name)); }
  catch { throw new Error(`${name} debe contener una URL válida sin credenciales.`); }
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) || url.username || url.password || url.search || url.hash) {
    throw new Error(`${name}: se exige HTTPS, o HTTP exclusivamente en loopback, sin credenciales ni parámetros.`);
  }
  url.pathname = url.pathname.replace(/\/$/, '');
  return url;
}

function permissions(name: string, fallback: string) {
  const values = (process.env[name] || fallback).split(',').map(value => value.trim()).filter(Boolean);
  if (!values.length || values.some(value => !/^[a-z_]+\.[a-z_]+$/.test(value))) throw new Error(`${name}: usa permisos módulo.acción separados por coma.`);
  return values;
}

function localSettings() {
  const file = process.env.LIVE_LOCAL_ENV_FILE;
  if (!file) return undefined;
  let source: string;
  try { source = readFileSync(file, 'utf8'); }
  catch { throw new Error('No se pudo leer LIVE_LOCAL_ENV_FILE. Indica el .env local usado por el lanzador.'); }
  const allowed = new Set(['DEMO_EMAIL', 'DEMO_PASSWORD', 'FRONTEND_PORT', 'KEYCLOAK_PORT', 'VITE_API_BASE_URL']);
  const values: Record<string, string> = {};
  for (const line of source.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match || !allowed.has(match[1])) continue;
    let value = match[2];
    if (value.startsWith('"')) {
      try { value = JSON.parse(value) as string; }
      catch { throw new Error('El archivo local contiene un valor entre comillas inválido. No se mostrarán valores.'); }
    } else if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    else value = value.replace(/\s+#.*$/, '').trim();
    values[match[1]] = value;
  }
  return values;
}

function localPort(value: string | undefined, fallback: number) {
  const port = Number(value ?? fallback);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('El puerto de configuración local es inválido.');
  return port;
}

export function loadLiveEnvironment(): LiveEnvironment {
  const local = localSettings();
  const frontend = endpoint('LIVE_FRONTEND_URL', local ? `http://localhost:${localPort(local.FRONTEND_PORT, 5173)}` : undefined);
  if (frontend.pathname !== '/') throw new Error('LIVE_FRONTEND_URL debe ser el origen del portal, sin ruta adicional.');
  const api = endpoint('LIVE_API_BASE_URL', new URL(local?.VITE_API_BASE_URL || '/api/v1', frontend.origin).href);
  const issuer = endpoint('LIVE_OIDC_ISSUER', local ? `http://localhost:${localPort(local.KEYCLOAK_PORT, 8080)}/realms/vortexbird` : undefined);
  if (!/^(?:\/auth)?\/realms\/[^/]+$/.test(issuer.pathname)) throw new Error('LIVE_OIDC_ISSUER debe usar /realms/NOMBRE o /auth/realms/NOMBRE.');
  if (local && [frontend, api, issuer].some(url => !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) {
    throw new Error('LIVE_LOCAL_ENV_FILE solo puede usarse con portal, API y proveedor en loopback. En staging configura LIVE_* explícitamente.');
  }
  const primary = {
    username: process.env.LIVE_QA_USERNAME || local?.DEMO_EMAIL || required('LIVE_QA_USERNAME'),
    password: process.env.LIVE_QA_PASSWORD || local?.DEMO_PASSWORD || required('LIVE_QA_PASSWORD'),
    permissions: permissions('LIVE_QA_PERMISSIONS', 'dashboard.read,users.read'),
  };
  const restrictedUsername = process.env.LIVE_RESTRICTED_USERNAME;
  const restrictedPassword = process.env.LIVE_RESTRICTED_PASSWORD;
  if (Boolean(restrictedUsername) !== Boolean(restrictedPassword)) throw new Error('Configura ambas variables LIVE_RESTRICTED_USERNAME y LIVE_RESTRICTED_PASSWORD, o ninguna.');
  const restricted = restrictedUsername && restrictedPassword ? {
    username: restrictedUsername, password: restrictedPassword,
    permissions: permissions('LIVE_RESTRICTED_PERMISSIONS', 'dashboard.read,orders.read'),
  } : undefined;
  if (primary.username === restricted?.username) throw new Error('Las dos identidades QA deben ser distintas.');
  const refreshMaxWaitSeconds = Number(process.env.LIVE_REFRESH_MAX_WAIT_SECONDS ?? '660');
  if (!Number.isInteger(refreshMaxWaitSeconds) || refreshMaxWaitSeconds < 60 || refreshMaxWaitSeconds > 1800) {
    throw new Error('LIVE_REFRESH_MAX_WAIT_SECONDS debe estar entre 60 y 1800. No se altera el reloj ni el TTL del proveedor.');
  }
  return { frontend, api, issuer, primary, restricted, restrictedRoute: '/users', restrictedApi: '/users', deniedPermission: 'users.read', refreshMaxWaitSeconds };
}
