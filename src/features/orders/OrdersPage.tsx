import { usePaymentSimulation } from '../payments/usePaymentSimulation';
import { PaymentCheckoutDialog } from '../payments/PaymentCheckoutDialog';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, ArrowUpRight, Check, Clock3, Copy, Plus, RefreshCw, Search, ShieldCheck, Trash2, X } from 'lucide-react';
import { api, apiError } from '../../services/api';
import { date, money, shortId, text } from '../../lib/format';
import type { Entity, Page } from '../../types';
import { Button, Empty, ErrorState, Modal, PageTitle, Pagination, Panel, SearchableSelect, Skeleton, Status, useToast } from '../../components/ui';
import { Enter, RowItem, RowStagger } from '../../components/motion';
import { useAuth } from '../auth/AuthProvider';
const statusOptions = [
  { value: '', label: 'Todos los estados' },
  { value: 'confirmed', label: 'Confirmadas' },
  { value: 'awaiting_payment', label: 'Pago pendiente' },
  { value: 'cancelled', label: 'Canceladas' },
  { value: 'failed', label: 'Fallidas' },
];
export function OrdersPage() {
  const [page, setPage] = useState(1); const [search, setSearch] = useState(''); const [status, setStatus] = useState(''); const [create, setCreate] = useState(false);
  const auth = useAuth();
  const query = useQuery({ queryKey: ['orders', page, search, status], queryFn: async () => (await api.get<Page>('/orders', { params: { page, pageSize: 10, search, status } })).data });
  return <>
    <PageTitle title="Órdenes" description="Sigue cada orden desde la reserva de inventario hasta el resultado del pago.">{auth.can('orders.create') && <Button onClick={() => setCreate(true)}><Plus size={16} />Crear orden</Button>}</PageTitle>
    <div className="flow-strip">{['Validación', 'Reserva de stock', 'Pago', 'Confirmación'].map((step, i) => <div key={step}><span>{i + 1}</span>{step}{i < 3 && <ArrowRight size={14} />}</div>)}<small>Flujo con compensación automática</small></div>
    <Panel>
      <div className="table-toolbar">
        <div className="table-search"><Search size={17} /><input aria-label="Buscar órdenes" placeholder="Buscar por orden o cliente…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} /></div>
        <div><SearchableSelect ariaLabel="Estado de la orden" className="select-compact" clearable value={status} onChange={value => { setStatus(value); setPage(1); }} options={statusOptions} /><Button variant="ghost" aria-label="Actualizar órdenes" onClick={() => void query.refetch()}><RefreshCw size={16} /></Button></div>
      </div>
      {query.isPending ? <Skeleton rows={6} /> : query.error ? <ErrorState error={query.error} retry={() => void query.refetch()} /> : <>
        <div className="table-scroll"><table><thead><tr><th scope="col">Orden</th><th scope="col">Cliente</th><th scope="col">Canal</th><th scope="col">Estado</th><th scope="col">Total</th><th scope="col">Fecha</th><th /></tr></thead><RowStagger>{query.data?.items.map(row => <RowItem key={text(row.id)}><td><Link className="table-link" to={`/orders/${row.id}`}>#{shortId(row.id)}</Link></td><td>{text(row.customerId)}</td><td><code>{shortId(row.channelId)}</code></td><td><Status value={row.status} /></td><td><strong>{money(row.total)}</strong></td><td className="muted">{date(row.createdAt)}</td><td><Link to={`/orders/${row.id}`} aria-label={`Ver orden ${shortId(row.id)}`}><ArrowUpRight size={17} /></Link></td></RowItem>)}</RowStagger></table>{!query.data?.items.length && <Empty title="Sin órdenes para mostrar" detail="Crea una orden y observa el recorrido entre los sistemas." />}</div>
        {query.data && <Pagination page={query.data} onChange={setPage} />}
      </>}
    </Panel>
    {create && <CreateOrder onClose={() => setCreate(false)} />}
  </>;
}
function CreateOrder({ onClose }: { onClose: () => void }) {
  const auth = useAuth(); const qc = useQueryClient(); const notify = useToast();
  const [values, setValues] = useState({ partnerId: auth.session?.user.partnerId ?? '', channelId: '', storeId: '', customerId: '' });
  const [paymentOutcome, setPaymentOutcome] = useState('approved');
  const simulation = usePaymentSimulation();
  const [items, setItems] = useState([{ sku: '', quantity: 1 }]);
  const [key] = useState(() => crypto.randomUUID());
  const [error, setError] = useState('');
  const query = useQuery({ queryKey: ['order-options'], queryFn: async () => { const [partners, channels, products, inventory, customers] = await Promise.all(['/partners', '/channels', '/products', '/inventory', '/customers'].map(path => api.get<Page>(path, { params: { pageSize: 100 } }))); return { partners: partners.data.items, channels: channels.data.items, products: products.data.items, customers: customers.data.items, stores: [...new Set(inventory.data.items.map(i => String(i.storeId)))] }; } });
  const mutation = useMutation({ mutationFn: () => api.post(simulation.data ? '/simulations/orders' : '/orders', { ...values, items, ...(simulation.data ? { paymentOutcome } : {}) }, { headers: { 'Idempotency-Key': key } }), onSuccess: () => { notify('Orden procesada. Consulta el detalle para seguir la saga.'); void qc.invalidateQueries({ queryKey: ['orders'] }); void qc.invalidateQueries({ queryKey: ['dashboard'] }); onClose(); }, onError: e => setError(apiError(e).message) });
  const options = (list: Entity[] | undefined, toValue: (item: Entity) => string, toLabel: (item: Entity) => string) => (list ?? []).map(item => ({ value: toValue(item), label: toLabel(item) }));
  return <Modal title="Crear orden" description="El flujo valida el catálogo, reserva stock e inicia el pago de prueba." onClose={onClose} wide>
    <form className="entity-form" onSubmit={e => { e.preventDefault(); setError(''); mutation.mutate(); }}>
      {query.error && <ErrorState error={query.error} retry={() => void query.refetch()} />}
      <div className="form-fields two-columns">
        <label>Partner<SearchableSelect required ariaLabel="Partner" value={values.partnerId} onChange={value => setValues({ ...values, partnerId: value, channelId: '', customerId: '' })} loading={query.isPending} options={options(query.data?.partners, p => text(p.id), p => text(p.name))} placeholder="Selecciona un partner" /></label>
        <label>Canal<SearchableSelect required ariaLabel="Canal" value={values.channelId} onChange={value => setValues({ ...values, channelId: value })} loading={query.isPending} options={options(query.data?.channels?.filter(c => !values.partnerId || c.partnerId === values.partnerId), c => text(c.id), c => text(c.name))} placeholder="Selecciona un canal" /></label>
        <label>Tienda<SearchableSelect required ariaLabel="Tienda" value={values.storeId} onChange={value => setValues({ ...values, storeId: value })} loading={query.isPending} options={(query.data?.stores ?? []).map(s => ({ value: s, label: s }))} placeholder="Selecciona una tienda" /></label>
        <label>Cliente<SearchableSelect required ariaLabel="Cliente" value={values.customerId} onChange={value => setValues({ ...values, customerId: value })} loading={query.isPending} options={options(query.data?.customers?.filter(c => !values.partnerId || c.partnerId === values.partnerId), c => text(c.externalId), c => `${text(c.displayName)} (${text(c.externalId)})`)} placeholder="Selecciona un cliente" /></label>
      </div>
      <div className="line-items">
        <h3>Productos</h3>
        {items.map((item, i) => <div className="line-item" key={i}>
          <SearchableSelect required ariaLabel={`Producto ${i + 1}`} value={item.sku} onChange={value => setItems(items.map((x, n) => n === i ? { ...x, sku: value } : x))} loading={query.isPending} options={options(query.data?.products, p => text(p.sku), p => `${text(p.sku)} · ${text(p.name)}`)} placeholder="Selecciona un producto" />
          <input aria-label={`Cantidad producto ${i + 1}`} required type="number" min="1" max="1000" value={item.quantity} onChange={e => setItems(items.map((x, n) => n === i ? { ...x, quantity: Number(e.target.value) } : x))} />
          <Button variant="ghost" type="button" aria-label={`Eliminar producto ${i + 1}`} disabled={items.length === 1} onClick={() => setItems(items.filter((_, n) => n !== i))}><Trash2 size={16} /></Button>
        </div>)}
        <Button type="button" variant="ghost" onClick={() => setItems([...items, { sku: '', quantity: 1 }])}><Plus size={15} />Añadir producto</Button>
      </div>
      {simulation.data && <label>Resultado del simulador de pago<SearchableSelect ariaLabel="Resultado del simulador de pago" value={paymentOutcome} onChange={setPaymentOutcome} options={[{ value: 'approved', label: 'Aprobado · confirmar orden' }, { value: 'rejected', label: 'Rechazado · liberar inventario' }, { value: 'pending', label: 'Pendiente · esperar confirmación' }]} /></label>}
      <div className="notice"><ShieldCheck size={16} />No se realizan cobros reales. La misma clave de idempotencia se conserva al reintentar.</div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="modal-actions"><Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button><Button disabled={mutation.isPending || query.isPending || simulation.isPending} type="submit">{mutation.isPending ? 'Procesando orden.' : 'Crear orden'}<ArrowRight size={15} /></Button></div>
    </form>
  </Modal>;
}
export function OrderDetailPage() {
  const { id } = useParams(); const auth = useAuth(); const notify = useToast(); const qc = useQueryClient(); const [cancel, setCancel] = useState(false); const [checkout, setCheckout] = useState(false);
  const query = useQuery({ queryKey: ['order', id], queryFn: async () => (await api.get<Entity>(`/orders/${id}`)).data, refetchInterval: 15000 });
  const mutation = useMutation({ mutationFn: () => api.post(`/orders/${id}/cancel`), onSuccess: () => { notify('Orden cancelada y compensación solicitada.'); setCancel(false); void qc.invalidateQueries({ queryKey: ['order', id] }); void qc.invalidateQueries({ queryKey: ['orders'] }); }, onError: e => notify(apiError(e).message, 'error') });
  const row = query.data; const items = (row?.items ?? []) as Entity[]; const timeline = (row?.timeline ?? []) as Entity[];
  return <>
    <Link className="back-link" to="/orders"><ArrowLeft size={15} />Volver a órdenes</Link>
    <PageTitle title={`Orden #${shortId(id)}`} description="Seguimiento de la operación y sus decisiones de negocio.">
      <Button variant="secondary" onClick={() => void query.refetch()}><RefreshCw size={15} />Actualizar</Button>
      {row && auth.can('payments.read') && <Button variant="secondary" onClick={() => setCheckout(true)}>Pago y checkout</Button>}
      {row && auth.can('orders.cancel') && ['reserved', 'awaiting_payment'].includes(String(row.status).toLowerCase()) && <Button variant="danger" onClick={() => setCancel(true)}><X size={15} />Cancelar orden</Button>}
    </PageTitle>
    {query.isPending ? <Skeleton rows={6} /> : query.error ? <ErrorState error={query.error} retry={() => void query.refetch()} /> : row ? <>
      <div className="order-summary"><Panel><span>Estado de la orden</span><Status value={row.status} /></Panel><Panel><span>Valor total</span><strong>{money(row.total)}</strong></Panel><Panel><span>Estado del pago</span><Status value={row.paymentStatus} /></Panel><Panel><span>Creada</span><strong className="small-value">{date(row.createdAt)}</strong></Panel></div>
      <div className="dashboard-main">
        <Enter><Panel title="Productos de la orden"><div className="table-scroll"><table><thead><tr><th scope="col">SKU</th><th scope="col">Cantidad</th><th scope="col">Precio unitario</th><th scope="col">Total</th></tr></thead><RowStagger>{items.map((item, i) => <RowItem key={i}><td className="sku">{text(item.sku)}</td><td>{text(item.quantity)}</td><td>{money(item.unitPrice)}</td><td>{money(item.total ?? Number(item.unitPrice) * Number(item.quantity))}</td></RowItem>)}</RowStagger></table></div>
          <dl className="detail-grid"><div><dt>Partner</dt><dd>{text(row.partnerId)}</dd></div><div><dt>Canal</dt><dd>{text(row.channelId)}</dd></div><div><dt>Cliente</dt><dd>{text(row.customerId)}</dd></div><div><dt>Tienda</dt><dd>{text(row.storeId)}</dd></div></dl></Panel></Enter>
        <Enter delay={0.08}><Panel title="Timeline de la operación" description="Eventos y transiciones de estado"><div className="timeline">{timeline.length ? timeline.map((event, i) => <div className="timeline-item" key={i}><span className="timeline-dot">{i === timeline.length - 1 ? <Clock3 size={13} /> : <Check size={13} />}</span><div><strong>{text(event.status ?? event.action ?? event.eventType)}</strong><p>{text(event.description ?? event.reason)}</p><small>{date(event.createdAt ?? event.timestamp)}</small></div></div>) : <Empty title="Sin transiciones registradas" />}</div></Panel></Enter>
      </div>
      <Enter><Panel title="Correlación de extremo a extremo"><div className="correlation"><code>{text(row.correlationId)}</code><Button variant="ghost" onClick={() => { void navigator.clipboard.writeText(text(row.correlationId)).then(() => notify('Identificador copiado.')).catch(() => notify('No fue posible copiar. Selecciona el identificador manualmente.', 'error')); }}><Copy size={15} />Copiar</Button></div></Panel></Enter>
    </> : null}
    {checkout && id && <PaymentCheckoutDialog orderId={id} onClose={() => setCheckout(false)} />}
    {cancel && <Modal title="Cancelar esta orden" description="La plataforma ejecutará las compensaciones que correspondan, incluida la liberación de reservas." onClose={() => setCancel(false)}><div className="modal-actions"><Button variant="secondary" onClick={() => setCancel(false)}>Conservar orden</Button><Button variant="danger" disabled={mutation.isPending} onClick={() => mutation.mutate()}>{mutation.isPending ? 'Cancelando.' : 'Confirmar cancelación'}</Button></div></Modal>}
  </>;
}

