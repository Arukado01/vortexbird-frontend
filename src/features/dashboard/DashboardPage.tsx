import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Activity, ArrowDownLeft, ArrowRight, ArrowUpRight, Boxes, Cable, Check, Clock3, CreditCard, Download, Layers, RefreshCw, ShoppingBag, Zap } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, BarChart, Bar, Cell } from 'recharts';
import { useState } from 'react';
import { api } from '../../services/api';
import type { Dashboard } from '../../types';
import { date, money, number, shortId, text } from '../../lib/format';
import { Button, Empty, ErrorState, PageTitle, Panel, SearchableSelect, Skeleton, Status } from '../../components/ui';
import { AnimatedNumber, Enter, RowItem, RowStagger, Stagger, StaggerItem } from '../../components/motion';
import { useAuth } from '../auth/AuthProvider';
const colors = ['#10b9b0', '#438ce4', '#f4a05a', '#8e7ee6', '#e46686'];
const periods = [{ value: '7', label: 'Últimos 7 días' }, { value: '30', label: 'Últimos 30 días' }, { value: '90', label: 'Últimos 90 días' }];
export function DashboardPage() {
  const [days, setDays] = useState('30'); const auth = useAuth();
  const query = useQuery({ queryKey: ['dashboard', days], queryFn: async () => (await api.get<Dashboard>('/dashboard', { params: { days } })).data, refetchInterval: 30000 });
  const d = query.data; const m = d?.metrics;
  return <>
    <PageTitle title="Tu operación, conectada." description="Una visión clara de tus integraciones y de todo lo que sucede entre ellas.">
      <span className="live-tag"><i />Actualización cada 30 s</span>
      <SearchableSelect ariaLabel="Período del dashboard" className="select-compact" value={days} onChange={setDays} options={periods} />
      <Button variant="secondary" aria-label="Actualizar dashboard" onClick={() => void query.refetch()}><RefreshCw size={16} /></Button>
    </PageTitle>
    <div className="demo-banner"><div><span className="demo-icon"><Layers size={18} /></span><span><strong>AndesRetail · Entorno de demostración</strong><small>Datos persistidos en la plataforma. ERP, WMS, OMS, CRM y pagos utilizan adaptadores simulados.</small></span></div><Link to="/integrations">Explorar conexiones<ArrowRight size={15} /></Link></div>
    {query.isPending ? <Skeleton rows={7} /> : query.error ? <ErrorState error={query.error} retry={() => void query.refetch()} /> : d && m ? <>
      <Stagger className="metric-grid" later={0.07}>{[
        { title: 'Órdenes procesadas', value: m.totalOrders, format: number, icon: ShoppingBag, foot: `${number(m.confirmedOrders)} confirmadas`, accent: 'teal' },
        { title: 'Valor de transacciones', value: m.totalRevenue, format: money, icon: CreditCard, foot: `${number(m.approvedPayments)} pagos aprobados`, accent: 'blue' },
        { title: 'Unidades disponibles', value: m.availableStock, format: number, icon: Boxes, foot: `${number(m.activeReservations)} reservas activas`, accent: 'orange' },
        { title: 'Integraciones saludables', value: m.healthyIntegrations, format: number, icon: Cable, foot: 'Adaptadores de la plataforma', accent: 'purple' },
      ].map(item => <StaggerItem key={item.title}><Panel className="metric-card">
        <div className="metric-top"><span>{item.title}</span><span className={`metric-icon ${item.accent}`}><item.icon size={18} /></span></div>
        <AnimatedNumber className="metric-value" value={Number(item.value ?? 0)} format={item.format} />
        <div className="metric-foot"><span className="metric-dot" />{item.foot}</div>
      </Panel></StaggerItem>)}</Stagger>
      <div className="dashboard-main">
        <Enter><Panel title="Flujo de órdenes" description="Volumen de órdenes recibidas por día" action={<span className="chart-legend"><i />Órdenes</span>}>
          <div className="chart-body">{d.ordersByDay?.length ? <ResponsiveContainer width="100%" height={245}><AreaChart data={d.ordersByDay} margin={{ top: 15, right: 18, bottom: 0, left: -22 }}><defs><linearGradient id="orderFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#10b9b0" stopOpacity={0.24} /><stop offset="100%" stopColor="#10b9b0" stopOpacity={0} /></linearGradient></defs><CartesianGrid strokeDasharray="3 5" vertical={false} stroke="var(--border)" /><XAxis dataKey="date" tickFormatter={v => String(v).slice(5, 10)} tickLine={false} axisLine={false} tick={{ fill: 'var(--muted)', fontSize: 11 }} dy={8} /><YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: 'var(--muted)', fontSize: 11 }} /><Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10 }} formatter={value => [number(value), 'Órdenes']} /><Area type="monotone" dataKey="count" stroke="#10b9b0" strokeWidth={2.5} fill="url(#orderFill)" animationDuration={700} /></AreaChart></ResponsiveContainer> : <Empty title="Sin órdenes en este período" detail="Crea una orden para observar el flujo de la plataforma." />}</div>
          <div className="chart-summary"><div><span>Pendientes</span><strong>{number(m.pendingOrders)}</strong></div><div><span>Confirmadas</span><strong className="text-teal">{number(m.confirmedOrders)}</strong></div><div><span>Canceladas</span><strong>{number(m.cancelledOrders)}</strong></div></div>
        </Panel></Enter>
        <Enter delay={0.08}><Panel title="Pulso de la plataforma" description="Estado actual del procesamiento" className="pulse-panel"><div className="pulse-list">{[{ label: 'Eventos pendientes', value: m.pendingEvents, icon: Zap, color: 'blue', path: '/events' }, { label: 'Webhooks fallidos', value: m.failedWebhooks, icon: ArrowUpRight, color: 'orange', path: '/webhooks' }, { label: 'Pagos aprobados', value: m.approvedPayments, icon: Check, color: 'teal', path: '/payments' }, { label: 'Pagos rechazados', value: m.rejectedPayments, icon: ArrowDownLeft, color: 'purple', path: '/payments' }].map(item => <Link to={item.path} key={item.label} className="pulse-item"><span className={`metric-icon ${item.color}`}><item.icon size={17} /></span><span>{item.label}</span><strong>{number(item.value)}</strong><ArrowRight size={14} /></Link>)}</div><div className="pulse-note"><ShieldIcon /><p>Cada operación conserva su identificador de correlación para seguir el flujo completo.</p></div></Panel></Enter>
      </div>
      <div className="dashboard-secondary">
        <Enter delay={0.05}><Panel title="Sistemas conectados" description="Adaptadores y estado reportado por la API" action={<Link className="text-link" to="/integrations">Ver todos<ArrowRight size={14} /></Link>}><div className="system-grid">{d.integrations?.length ? d.integrations.map((item, i) => <Link to="/integrations" className="system-card" key={text(item.id)}><span className="system-avatar" style={{ color: colors[i % colors.length] }}><Cable size={23} /></span><strong>{text(item.name ?? item.type)}</strong><span className="system-kind">Simulador</span><Status value={item.status ?? (item.failureMode === 'none' ? 'healthy' : 'unhealthy')} /></Link>) : <Empty title="Sin integraciones configuradas" />}</div></Panel></Enter>
        <Enter delay={0.12}><Panel title="Órdenes por canal" description="Distribución del volumen operativo"><div className="channel-chart">{d.ordersByChannel?.length ? <ResponsiveContainer width="100%" height={205}><BarChart data={d.ordersByChannel} layout="vertical" margin={{ left: 8, right: 20 }}><XAxis type="number" hide /><YAxis dataKey="channel" type="category" width={90} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--muted)' }} /><Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10 }} /><Bar dataKey="count" name="Órdenes" radius={[0, 5, 5, 0]} barSize={14} animationDuration={700}>{d.ordersByChannel.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}</Bar></BarChart></ResponsiveContainer> : <Empty title="Sin actividad por canal" />}</div></Panel></Enter>
      </div>
      <div className="dashboard-main">
        <Enter><Panel title="Últimas órdenes" description="Seguimiento desde la creación hasta la confirmación" action={<Link className="text-link" to="/orders">Ver órdenes<ArrowRight size={14} /></Link>}><div className="table-scroll"><table><thead><tr><th scope="col">Orden</th><th scope="col">Estado</th><th scope="col">Total</th><th scope="col">Fecha</th><th scope="col"><span className="sr-only">Detalle</span></th></tr></thead><RowStagger>{d.recentOrders?.map(row => <RowItem key={text(row.id)}><td><Link className="table-link" to={`/orders/${row.id}`}>#{shortId(row.id)}</Link></td><td><Status value={row.status} /></td><td>{money(row.total)}</td><td className="muted">{date(row.createdAt)}</td><td><Link aria-label={`Ver orden ${shortId(row.id)}`} to={`/orders/${row.id}`}><ArrowUpRight size={16} /></Link></td></RowItem>)}</RowStagger></table>{!d.recentOrders?.length && <Empty title="Tu próxima orden comienza aquí" detail="Valida stock, reserva inventario y sigue el pago en un mismo flujo.">{auth.can('orders.create') && <Link className="button button-primary" to="/orders">Crear primera orden<ArrowRight size={15} /></Link>}</Empty>}</div></Panel></Enter>
        <Enter delay={0.08}><Panel title="Actividad reciente" description="Trazabilidad en tiempo real" action={<Link className="text-link" to="/activity-logs" aria-label="Ver actividad reciente"><ArrowUpRight size={17} /></Link>}><div className="activity-list">{d.recentActivity?.length ? d.recentActivity.slice(0, 5).map(item => <div className="activity-item" key={text(item.id)}><span className="activity-mark"><Activity size={14} /></span><div><strong>{text(item.action)}</strong><p>{text(item.description ?? item.module)}</p><small><Clock3 size={11} />{date(item.createdAt ?? item.timestamp)}</small></div></div>) : <Empty title="Sin actividad reciente" />}</div></Panel></Enter>
      </div>
      <div className="dashboard-foot"><span><Activity size={14} />Las métricas representan datos almacenados, no una prueba de rendimiento.</span><Link to="/reports"><Download size={14} />Reportes operacionales</Link></div>
    </> : null}</>;
}
function ShieldIcon() { return <span className="pulse-shield"><Layers size={21} /></span>; }

