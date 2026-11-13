import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, LockKeyhole, Plus, Save, Search, ShieldCheck, Trash2, Users } from 'lucide-react';
import { api, apiError } from '../../services/api';
import type { Entity, Page } from '../../types';
import { text } from '../../lib/format';
import { Button, Empty, ErrorState, Modal, PageTitle, Pagination, Panel, Skeleton, useToast } from '../../components/ui';
import { EntityEditor } from '../resources/ResourcePage';
import { useAuth } from '../auth/AuthProvider';
import type { Resource } from '../resources/config';

const roleCfg: Resource = { title: 'Roles', singular: 'rol', description: '', permission: 'roles.read', columns: [], fields: [{ key: 'name', label: 'Nombre del rol', required: true }, { key: 'description', label: 'Descripción', required: true }] };
const permissionCfg: Resource = { title: 'Permisos', singular: 'permiso', description: '', permission: 'permissions.read', columns: [], fields: [{ key: 'name', label: 'Nombre del permiso', required: true, help: 'Usa el formato módulo.acción, por ejemplo integrations.replay. Crear el permiso no implementa un endpoint nuevo; debe estar aplicado también por la API.' }] };

export function RolesPage() {
  const auth = useAuth(); const notify = useToast(); const qc = useQueryClient();
  const [selected, setSelected] = useState<Entity | null>(null);
  const [checked, setChecked] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [editor, setEditor] = useState<Entity | null>(null);
  const [permissionEditor, setPermissionEditor] = useState(false);
  const [deleting, setDeleting] = useState<Entity | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [users, setUsers] = useState<Entity | null>(null);
  const [usersPage, setUsersPage] = useState(1);
  const [rolePage, setRolePage] = useState(1);
  const roles = useQuery({ queryKey: ['roles', rolePage], queryFn: async () => (await api.get<Page>('/roles', { params: { page: rolePage, pageSize: 30 } })).data });
  const permissions = useQuery({ queryKey: ['permissions'], queryFn: async () => {
    const all: Entity[] = []; let page = 1; let next = true;
    while (next) { const response = (await api.get<Page>('/permissions', { params: { page, pageSize: 100 } })).data; all.push(...response.items); next = response.hasNextPage; page++; }
    return all;
  } });
  const save = useMutation({ mutationFn: () => api.put(`/roles/${selected?.id}/permissions`, { permissions: checked }), onSuccess: () => { notify('Permisos actualizados. La autorización se aplica en el backend.'); setSelected(current => current ? { ...current, permissions: checked, permissionCount: checked.length } : null); void qc.invalidateQueries({ queryKey: ['roles'] }); void auth.refresh(); }, onError: error => notify(apiError(error).message, 'error') });
  const remove = useMutation({ mutationFn: () => api.delete(`/roles/${deleting?.id}`), onSuccess: () => { notify('Rol eliminado.'); if (selected?.id === deleting?.id) setSelected(null); setDeleting(null); void qc.invalidateQueries({ queryKey: ['roles'] }); }, onError: error => setDeleteError(apiError(error).message) });
  const allPermissions = (permissions.data ?? []).map(permission => String(permission.name));
  const grouped = allPermissions.filter(permission => permission.toLowerCase().includes(search.toLowerCase())).reduce<Record<string, string[]>>((result, permission) => { const group = permission.split('.')[0]; (result[group] ??= []).push(permission); return result; }, {});
  const select = (role: Entity) => { setSelected(role); setChecked(Array.isArray(role.permissions) ? role.permissions.map(String) : []); };
  const roleUsers = useQuery({ queryKey: ['role-users', users?.id, usersPage], enabled: !!users, queryFn: async () => (await api.get<Page>(`/roles/${users?.id}/users`, { params: { page: usersPage, pageSize: 15 } })).data });
  const canEditPermissions = auth.can('roles.assign_permissions') && !selected?.protected;

  return <>
    <PageTitle title="Roles y permisos" description="Define accesos precisos por responsabilidad, módulo y operación.">
      {auth.can('permissions.create') && <Button variant="secondary" onClick={() => setPermissionEditor(true)}><Plus size={16} />Crear permiso</Button>}
      {auth.can('roles.create') && <Button onClick={() => setEditor({})}><Plus size={16} />Crear rol</Button>}
    </PageTitle>
    <div className="roles-layout">
      <Panel title="Roles del workspace" description="Selecciona un rol para administrar su alcance.">
        {roles.isPending ? <Skeleton rows={6} /> : roles.error ? <ErrorState error={roles.error} retry={() => void roles.refetch()} /> : <>
          <div className="roles-list">{roles.data?.items.map(role => <button aria-label={`Seleccionar rol ${text(role.name)}`} key={text(role.id)} className={`role-item ${selected?.id === role.id ? 'selected' : ''}`} onClick={() => select(role)}><span className="role-icon"><ShieldCheck size={19} /></span><span><strong>{text(role.name)}</strong><small>{Number(role.permissionCount ?? (role.permissions as unknown[])?.length ?? 0)} permisos</small></span>{Boolean(role.protected) && <LockKeyhole size={13} aria-label="Rol protegido" />}</button>)}</div>
          {roles.data && roles.data.totalPages > 1 && <Pagination page={roles.data} onChange={setRolePage} />}
        </>}
      </Panel>
      <Panel title={selected ? text(selected.name) : 'Matriz de permisos'} description={selected ? text(selected.description) : 'Elige un rol de la lista para ver y editar sus permisos.'} action={selected && <div className="inline-actions">
        {auth.can('users.read') && <Button variant="ghost" onClick={() => { setUsers(selected); setUsersPage(1); }}><Users size={15} />Usuarios</Button>}
        {auth.can('roles.update') && !selected.protected && <Button variant="ghost" onClick={() => setEditor(selected)}>Editar</Button>}
        {auth.can('roles.delete') && !selected.protected && <Button variant="danger" aria-label={`Eliminar rol ${text(selected.name)}`} onClick={() => { setDeleteError(''); setDeleting(selected); }}><Trash2 size={14} /></Button>}
      </div>}>
        {!selected ? <Empty title="Cada rol, el acceso que necesita" detail="Los permisos se agrupan por módulo y se validan en cada solicitud de la API." /> : permissions.isPending ? <Skeleton rows={5} /> : permissions.error ? <ErrorState error={permissions.error} retry={() => void permissions.refetch()} /> : <>
          {Boolean(selected.protected) && <div className="notice"><LockKeyhole size={16} />Este rol está protegido. Sus permisos se muestran para consulta.</div>}
          <div className="permission-search"><Search size={16} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Filtrar permisos…" aria-label="Filtrar permisos" /><span>{checked.length} seleccionados</span></div>
          <div className="permission-groups">{Object.entries(grouped).map(([group, list]) => <fieldset key={group}><legend>{group}<button type="button" onClick={() => setChecked(list.every(permission => checked.includes(permission)) ? checked.filter(permission => !list.includes(permission)) : [...new Set([...checked, ...list])])} disabled={!canEditPermissions}>{list.every(permission => checked.includes(permission)) ? 'Quitar grupo' : 'Seleccionar grupo'}</button></legend>{list.map(permission => <label className="permission-check" key={permission}><input type="checkbox" checked={checked.includes(permission)} disabled={!canEditPermissions} onChange={event => setChecked(event.target.checked ? [...checked, permission] : checked.filter(item => item !== permission))} /><span>{permission}</span>{checked.includes(permission) && <Check size={13} />}</label>)}</fieldset>)}</div>
          <div className="permission-footer"><span><ShieldCheck size={15} />Los cambios quedan registrados en auditoría.</span>{canEditPermissions && <Button disabled={save.isPending} onClick={() => save.mutate()}><Save size={15} />{save.isPending ? 'Guardando…' : 'Guardar permisos'}</Button>}</div>
        </>}
      </Panel>
    </div>
    {editor && <EntityEditor cfg={roleCfg} resource="roles" entity={editor} onClose={() => setEditor(null)} />}
    {permissionEditor && <EntityEditor cfg={permissionCfg} resource="permissions" entity={{}} onClose={() => setPermissionEditor(false)} />}
    {deleting && <Modal title={`Eliminar rol ${text(deleting.name)}`} description="El rol se eliminará permanentemente. La API rechazará la operación si está protegido o todavía tiene usuarios asignados." onClose={() => { if (!remove.isPending) setDeleting(null); }}>
      {deleteError && <p className="form-error" role="alert">{deleteError}</p>}
      <div className="modal-actions"><Button variant="secondary" disabled={remove.isPending} onClick={() => setDeleting(null)}>Conservar rol</Button><Button variant="danger" disabled={remove.isPending} onClick={() => remove.mutate()}>{remove.isPending ? 'Eliminando…' : 'Confirmar eliminación'}</Button></div>
    </Modal>}
    {users && <Modal title={`Usuarios con rol ${text(users.name)}`} onClose={() => setUsers(null)}>{roleUsers.isPending ? <Skeleton /> : roleUsers.error ? <ErrorState error={roleUsers.error} retry={() => void roleUsers.refetch()} /> : <>{roleUsers.data?.items.length ? <div className="role-users">{roleUsers.data.items.map(user => <div key={text(user.id)}><Users size={17} /><strong>{text(user.displayName)}</strong><span>{text(user.email)}</span></div>)}</div> : <Empty title="No hay usuarios asociados" />}{roleUsers.data && <Pagination page={roleUsers.data} onChange={setUsersPage} />}</>}</Modal>}
  </>;
}
