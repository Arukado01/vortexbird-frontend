import { EntityEditor } from './EntityEditor';
export { EntityEditor } from './EntityEditor';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, Download, Filter, History, Pencil, Plus, RefreshCw, Search, Send, ShieldCheck, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api, apiError } from '../../services/api';
import { date, money, number, safeCsvCell, shortId, text } from '../../lib/format';
import { Button, Empty, ErrorState, Modal, PageTitle, Pagination, Panel, Skeleton, Status, useToast } from '../../components/ui';
import { resources } from './config';
import type { Column } from './config';
import type { Entity, Page } from '../../types';
import { useAuth } from '../auth/AuthProvider';

export function Cell({ column, row }: { column: Column; row: Entity }) {
  const value = row[column.key];
  if (column.type === 'status') return <Status value={value} />;
  if (column.type === 'date') return <span className="muted">{date(value)}</span>;
  if (column.type === 'money') return <strong>{money(value, String(row.currency ?? 'COP'))}</strong>;
  if (column.type === 'number') return <span className="tabular">{number(value)}</span>;
  if (column.type === 'id') return <code title={text(value)}>{shortId(value)}</code>;
  return <span title={text(value)} className={column.key === 'sku' ? 'sku' : 'cell-text'}>{text(value)}</span>;
}

export function ResourcePage({ resource }: { resource: string }) {
  const cfg = resources[resource]; const auth = useAuth(); const notify = useToast(); const qc = useQueryClient();
  const [page, setPage] = useState(1); const [searchInput, setSearchInput] = useState(''); const [search, setSearch] = useState('');
  const [editor, setEditor] = useState<Entity | null>(null); const [detail, setDetail] = useState<Entity | null>(null);
  const [showFilters, setShowFilters] = useState(false); const [filters, setFilters] = useState<Record<string, string>>({});
  const [paymentDecision, setPaymentDecision] = useState<{ payment: Entity; outcome: 'approved' | 'rejected' } | null>(null);
  const [paymentError, setPaymentError] = useState('');
  const filterKeys = cfg.filterKeys ?? (resource === 'activity-logs' ? ['userId', 'module', 'action', 'result', 'from', 'to'] : resource === 'inventory' ? ['sku', 'storeId', 'channelId'] : resource === 'pricing' ? ['sku', 'channelId', 'customerId'] : ['status', 'partnerId']);
  const query = useQuery({ queryKey: [resource, page, search, filters], queryFn: async () => (await api.get<Page>(`/${cfg.endpoint ?? resource}`, { params: { page, pageSize: 15, ...(cfg.searchable === false ? {} : { search }), ...filters } })).data });
  const retry = useMutation({ mutationFn: (id: string) => api.post(`/events/${id}/retry`), onSuccess: () => { notify('Evento programado para reintento.'); void qc.invalidateQueries({ queryKey: [resource] }); }, onError: error => notify(apiError(error).message, 'error') });
  const resolvePayment = useMutation({ mutationFn: () => api.post(`/payments/${paymentDecision?.payment.id}/simulate`, { outcome: paymentDecision?.outcome }), onSuccess: () => {
    notify(paymentDecision?.outcome === 'approved' ? 'Pago simulado aprobado. La saga confirmará la orden.' : 'Pago simulado rechazado. La saga ejecutará la compensación.');
    setPaymentDecision(null);
    for (const key of ['payments', 'orders', 'order', 'dashboard', 'inventory', 'events', 'activity-logs']) void qc.invalidateQueries({ queryKey: [key] });
  }, onError: error => setPaymentError(apiError(error).message) });
  const exportPage = () => {
    const rows = query.data?.items ?? [];
    const csv = [cfg.columns.map(column => safeCsvCell(column.label)).join(','), ...rows.map(row => cfg.columns.map(column => safeCsvCell(row[column.key])).join(','))].join('\r\n');
    const url = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${resource}-pagina-${page}.csv`; anchor.click(); URL.revokeObjectURL(url);
    notify(`Exportados ${rows.length} registros de esta página.`);
  };
  const beginDecision = (payment: Entity, outcome: 'approved' | 'rejected') => { setPaymentError(''); setPaymentDecision({ payment, outcome }); };
  const parent = resource === 'webhook-deliveries' ? { to: '/webhooks', name: 'Webhooks' } : resource === 'integration-executions' ? { to: '/integrations', name: 'Integraciones' } : null;

  return <>
    {parent && <Link className="back-link" to={parent.to}><ArrowLeft size={15} />Volver a {parent.name}</Link>}
    <PageTitle title={cfg.title} description={cfg.description}>
      {resource === 'webhooks' && <Link className="button button-secondary" to="/webhook-deliveries"><History size={15} />Historial de entregas</Link>}
      <Button variant="secondary" onClick={exportPage} disabled={!query.data?.items.length}><Download size={15} />Exportar página</Button>
      {!cfg.editOnly && cfg.fields && cfg.writePermission && auth.can(cfg.writePermission) && <Button onClick={() => setEditor({})}><Plus size={16} />Crear {cfg.singular}</Button>}
    </PageTitle>
    {resource === 'payments' && <div className="notice"><ShieldCheck size={17} />Transacciones de demostración. Solo los pagos pendientes del proveedor simulator permiten aprobar o rechazar el resultado manualmente. No se realizan cobros reales.</div>}
    <Panel>
      <div className="table-toolbar">
        {cfg.searchable !== false ? <form className="table-search" onSubmit={event => { event.preventDefault(); setSearch(searchInput); setPage(1); }}><Search size={17} /><input placeholder={`Buscar ${cfg.title.toLowerCase()}…`} aria-label={`Buscar ${cfg.title.toLowerCase()}`} value={searchInput} onChange={event => setSearchInput(event.target.value)} /><button type="submit">Buscar</button></form> : <span className="muted">Historial paginado · Todos los registros autorizados</span>}
        <div>{filterKeys.length > 0 && <Button variant="secondary" onClick={() => setShowFilters(!showFilters)}><Filter size={15} />Filtros</Button>}<Button variant="ghost" aria-label="Actualizar listado" onClick={() => void query.refetch()}><RefreshCw size={16} /></Button></div>
      </div>
      {showFilters && filterKeys.length > 0 && <div className="filters-row">{filterKeys.map(key => <label key={key}>{({ userId: 'Usuario', module: 'Módulo', action: 'Acción', result: 'Resultado', from: 'Desde', to: 'Hasta', sku: 'SKU', storeId: 'Tienda', channelId: 'Canal', customerId: 'Cliente', status: 'Estado', partnerId: 'Partner' } as Record<string, string>)[key]}<input type={key === 'from' || key === 'to' ? 'date' : 'text'} value={filters[key] ?? ''} onChange={event => { setFilters({ ...filters, [key]: event.target.value }); setPage(1); }} /></label>)}<Button variant="ghost" onClick={() => { setFilters({}); setPage(1); }}>Limpiar</Button></div>}
      {query.isPending ? <Skeleton rows={6} /> : query.error ? <ErrorState error={query.error} retry={() => void query.refetch()} /> : <>
        <div className="table-scroll"><table><thead><tr>{cfg.columns.map(column => <th key={column.key}>{column.label}</th>)}<th className="actions-cell">Acciones</th></tr></thead><tbody>{query.data?.items.map((row, index) => <tr key={String(row.id ?? index)}>{cfg.columns.map(column => <td key={column.key}>{column.key === 'orderId' && row.orderId ? <Link className="table-link" to={`/orders/${row.orderId}`}><Cell row={row} column={column} /></Link> : <Cell row={row} column={column} />}</td>)}<td className="actions-cell">
          <Button variant="ghost" onClick={() => setDetail(row)}>Ver</Button>
          {cfg.fields && cfg.writePermission && auth.can(cfg.writePermission.replace('.create', '.update')) && <Button variant="ghost" aria-label={`Editar ${cfg.singular}`} onClick={() => setEditor(row)}><Pencil size={14} /></Button>}
          {resource === 'events' && auth.can('events.manage') && <Button variant="ghost" disabled={retry.isPending || row.status !== 'dead_letter'} onClick={() => retry.mutate(String(row.id))} aria-label="Reintentar evento"><Send size={14} /></Button>}
          {resource === 'payments' && auth.can('payments.manage') && row.provider === 'simulator' && row.status === 'pending' && <><Button variant="ghost" aria-label={`Aprobar pago de prueba ${shortId(row.id)}`} onClick={() => beginDecision(row, 'approved')}><Check size={14} />Aprobar</Button><Button variant="ghost" aria-label={`Rechazar pago de prueba ${shortId(row.id)}`} onClick={() => beginDecision(row, 'rejected')}><X size={14} />Rechazar</Button></>}
        </td></tr>)}</tbody></table>{query.data?.items.length === 0 && <Empty title="Sin resultados" detail={search || Object.values(filters).some(Boolean) ? 'Prueba otros filtros o términos de búsqueda.' : `No hay ${cfg.title.toLowerCase()} registrados.`} />}</div>
        {query.data && <Pagination page={query.data} onChange={setPage} />}
      </>}
    </Panel>
    {editor && <EntityEditor cfg={cfg} resource={resource} entity={editor} onClose={() => setEditor(null)} />}
    {detail && <Modal title={`Detalle de ${cfg.singular}`} onClose={() => setDetail(null)} wide><dl className="detail-grid">{Object.entries(detail).map(([key, value]) => <div key={key}><dt>{cfg.columns.find(column => column.key === key)?.label ?? key}</dt><dd>{typeof value === 'object' ? <pre>{JSON.stringify(value, null, 2)}</pre> : text(value)}</dd></div>)}</dl></Modal>}
    {paymentDecision && <Modal title={`${paymentDecision.outcome === 'approved' ? 'Aprobar' : 'Rechazar'} pago de prueba`} description={`Transacción #${shortId(paymentDecision.payment.id)} · Orden #${shortId(paymentDecision.payment.orderId)} · ${money(paymentDecision.payment.amount)}`} onClose={() => { if (!resolvePayment.isPending) setPaymentDecision(null); }}>
      <div className="form-fields"><div className="notice"><ShieldCheck size={17} />{paymentDecision.outcome === 'approved' ? 'La plataforma registrará la aprobación simulada y continuará la confirmación de la orden.' : 'La plataforma registrará el rechazo simulado y liberará las reservas mediante la saga.'}</div></div>
      {paymentError && <p className="form-error" role="alert">{paymentError}</p>}
      <div className="modal-actions"><Button variant="secondary" disabled={resolvePayment.isPending} onClick={() => setPaymentDecision(null)}>Volver</Button><Button variant={paymentDecision.outcome === 'rejected' ? 'danger' : 'primary'} disabled={resolvePayment.isPending} onClick={() => resolvePayment.mutate()}>{resolvePayment.isPending ? 'Procesando…' : 'Confirmar resultado de prueba'}</Button></div>
    </Modal>}
  </>;
}
