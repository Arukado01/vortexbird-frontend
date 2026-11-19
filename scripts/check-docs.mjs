import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import console from 'node:console';
import process from 'node:process';
import { URL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');
const compare = (a, b) => {
  const from = a.split('.').map(Number);
  const to = b.split('.').map(Number);
  for (let i = 0; i < from.length; i++) {
    if (from[i] !== to[i]) return from[i] - to[i];
  }
  return 0;
};
const manualFolder = 'docs/user-manuals/';
const manifest = 'src/features/help/index.ts';
const changelog = 'DOCUMENTATION_CHANGELOG.md';
const manualByFeature = {
  auth: 'acceso',
  dashboard: 'dashboard',
  integrations: 'integraciones-configuracion',
  orders: 'ordenes',
  payments: 'pagos',
  reports: 'reportes',
  roles: 'usuarios-permisos',
  settings: 'integraciones-configuracion',
};
const columns = ['id', 'title', 'module', 'category', 'summary', 'owner'];
const parseMap = source => new Map([...source.matchAll(/^\s*'(\/[^']*)':\s*'([a-z-]+)'/gm)].map(([, route, manual]) => [route, manual]));
const mapping = parseMap(read(manifest));
const appPaths = [...read('src/app/App.tsx').matchAll(/<Route path="([a-z-]+)"/g)].map(match => `/${match[1]}`);
const resourcePaths = [...read('src/features/resources/config.ts').matchAll(/^\s{2}['"]?([a-z-]+)['"]?\s*:/gm)].map(match => `/${match[1]}`);
for (const route of ['/', ...appPaths, ...resourcePaths]) assert(mapping.has(route), `Route ${route} needs contextual help.`);

const manuals = new Map();
for (const file of readdirSync(new URL(manualFolder, root)).filter(name => name.endsWith('.json'))) {
  const manual = JSON.parse(read(manualFolder + file));
  assert.equal(file, manual.id + '.json');
  assert(/^[a-z]+(?:-[a-z]+)*$/.test(manual.id) && manual.visibility === 'public', 'Invalid public manual ' + file);
  assert(columns.every(key => typeof manual[key] === 'string' && manual[key].trim()), `Missing metadata in ${file}.`);
  assert(manual.audiences.length > 0 && manual.sections.length > 0 && manual.faq.length > 0 && manual.history.length > 0, `Incomplete manual ${file}.`);
  const ids = new Set(['preguntas', 'historial', 'help-content']);
  for (const section of manual.sections) {
    assert(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(section.id) && section.title && !ids.has(section.id)
      && section.steps.length > 0 && section.steps.every(step => typeof step === 'string' && step.trim()), `Invalid or duplicated section in ${file}.`);
    ids.add(section.id);
    assert(!section.route || mapping.get(section.route) === manual.id, `Unknown section route in ${file}.`);
    assert(!manual.permissions.length || section.permission, `Operational section missing permission in ${file}.`);
  }
  for (const [index, entry] of manual.history.entries()) {
    const date = Date.parse(entry.date);
    assert(/^\d+\.\d+\.\d+$/.test(entry.version) && /^\d{4}-\d{2}-\d{2}$/.test(entry.date)
      && Number.isFinite(date) && new Date(date).toISOString().startsWith(entry.date) && entry.description?.trim(), `Invalid release in ${file}.`);
    if (index > 0) assert(compare(manual.history[index - 1].version, entry.version) > 0 && manual.history[index - 1].date >= entry.date, `Invalid release order in ${file}.`);
  }
  if (manual.illustration) {
    const { file: image, alt, caption } = manual.illustration;
    assert(/^[a-z-]+\.png$/.test(image) && alt && caption, `Invalid illustration in ${file}.`);
    const path = new URL('public/help-media/' + image, root);
    assert(existsSync(path), `Missing screenshot ${image}.`);
    const png = readFileSync(path);
    assert(png.subarray(1, 4).equals(Buffer.from('PNG')) && png.readUInt32BE(16) >= 390, `Invalid screenshot ${image}.`);
  }
  manuals.set(manual.id, manual);
}
for (const [route, id] of mapping) assert(manuals.has(id), `Missing guide ${id} for ${route}.`);
assert.equal(manuals.get('acceso')?.permissions.length, 0, 'The access guide must be public.');

const base = process.argv[2];
if (base) {
  assert(/^[0-9a-f]{40}$/i.test(base), 'Provide a full commit SHA as the base.');
  const changed = [...new Set([
    ...gitPaths(['diff', '--name-only', '-z', base]),
    ...gitPaths(['ls-files', '--others', '--exclude-standard', '-z']),
  ])];
  const edits = changed.filter(path => path.startsWith(manualFolder) && path.endsWith('.json') && existsSync(new URL(path, root)));
  const functional = changed.filter(path => /^(src\/(features|app|services)\/|src\/lib\/config\.ts|public\/config\.js|nginx(?:-api-proxy)?\.conf|docker-entrypoint\.sh)/.test(path) && !/\.(test|spec)\.[cm]?[jt]sx?$/.test(path));
  const priorLog = fromBase(changelog);
  const currentLog = read(changelog);
  const logEdits = priorLog === undefined ? currentLog : execFileSync('git', ['diff', '--unified=0', base, '--', changelog], { encoding: 'utf8' })
    .split('\n').filter(line => line.startsWith('+') && !line.startsWith('+++')).join('\n');
  if (functional.length || edits.length) assert(currentLog !== priorLog, 'Update DOCUMENTATION_CHANGELOG.md.');
  if (functional.length && !edits.length) assert(/Sin impacto(?: \[[a-z-]+\])?:\s*\S.{12,}/i.test(logEdits), 'Update the affected guide or record the reason under Sin impacto.');
  const affected = new Set(functional.map(path => manualByFeature[path.split('/')[2]]).filter(Boolean));
  for (const id of affected) {
    const reason = new RegExp('Sin impacto \\[' + id + '\\]:\\s*\\S.{12,}', 'i');
    assert(edits.includes(manualFolder + id + '.json') || reason.test(logEdits), 'Update ' + id + ' or document why it is unaffected.');
  }
  for (const path of edits) {
    const current = JSON.parse(read(path));
    assert(logEdits.includes(current.id), `Log the update for ${current.id}.`);
    const previous = fromBase(path);
    if (!previous) continue;
    const old = JSON.parse(previous).history;
    assert.deepEqual(current.history.slice(-old.length), old, `Keep the published history for ${current.id}.`);
    assert(compare(current.history[0].version, old[0].version) > 0, `Increment the version of ${current.id}.`);
  }
  for (const path of changed.filter(path => path.startsWith('public/help-media/'))) {
    const image = path.split('/').at(-1);
    const illustrated = [...manuals.values()].find(manual => manual.illustration?.file === image);
    if (illustrated) assert(edits.includes(manualFolder + illustrated.id + '.json'), `Update the manual for screenshot ${image}.`);
  }
}
console.log(`Validated ${manuals.size} manuals and ${mapping.size} contextual routes.`);

function gitPaths(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).split('\0').filter(Boolean);
}

function fromBase(path) {
  try {
    return execFileSync('git', ['show', `${base}:${path}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch (error) {
    if (error.status !== 128) throw error;
    return undefined;
  }
}
