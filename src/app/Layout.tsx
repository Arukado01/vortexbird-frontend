import { Suspense, useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Activity, ArrowUpRight, Bell, Boxes, Cable, ChartNoAxesCombined, ChevronDown, ChevronLeft, ChevronRight, CircleDollarSign, CreditCard, FileChartColumn, Globe, LayoutDashboard, LogOut, Menu, Moon, Network, Package, Search, Settings2, ShieldCheck, ShoppingBag, Sun, Users, Webhook, X, Zap } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAuth } from '../features/auth/AuthProvider';
import { config } from '../lib/config';
import { Button, Skeleton, useToast } from '../components/ui';
const groups: Array<{ title: string; items: Array<{ path: string; title: string; icon: LucideIcon; permission: string }> }> = [
  { title: 'VISTA GENERAL', items: [{ path: '/', title: 'Dashboard', icon: LayoutDashboard, permission: 'dashboard.read' }, { path: '/integrations', title: 'Integraciones', icon: Cable, permission: 'integrations.read' }, { path: '/events', title: 'Eventos', icon: Zap, permission: 'events.read' }, { path: '/webhooks', title: 'Webhooks', icon: Webhook, permission: 'webhooks.read' }] },
  { title: 'OPERACIÓN', items: [{ path: '/orders', title: 'Órdenes', icon: ShoppingBag, permission: 'orders.read' }, { path: '/inventory', title: 'Inventario', icon: Boxes, permission: 'inventory.read' }, { path: '/pricing', title: 'Precios', icon: CircleDollarSign, permission: 'pricing.read' }, { path: '/products', title: 'Productos', icon: Package, permission: 'products.read' }, { path: '/payments', title: 'Pagos', icon: CreditCard, permission: 'payments.read' }] },
  { title: 'ADMINISTRACIÓN', items: [{ path: '/partners', title: 'Partners', icon: Network, permission: 'partners.read' }, { path: '/channels', title: 'Canales', icon: Globe, permission: 'channels.read' }, { path: '/users', title: 'Usuarios', icon: Users, permission: 'users.read' }, { path: '/roles', title: 'Roles y permisos', icon: ShieldCheck, permission: 'roles.read' }, { path: '/activity-logs', title: 'Activity Log', icon: Activity, permission: 'activity_logs.read' }, { path: '/reports', title: 'Reportes', icon: FileChartColumn, permission: 'reports.read' }, { path: '/settings', title: 'Configuración', icon: Settings2, permission: 'settings.read' }] }
];
export function Layout() {
  const auth = useAuth(); const notify = useToast();
  const [collapsed, setCollapsed] = useState(false); const [mobile, setMobile] = useState(false);
  const [smallViewport, setSmallViewport] = useState(() => matchMedia('(max-width: 760px)').matches);
  const [search, setSearch] = useState('');
  const [theme, setTheme] = useState(() => localStorage.getItem('vortex-theme') ?? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
  const sidebar = useRef<HTMLElement>(null); const searchInput = useRef<HTMLInputElement>(null); const main = useRef<HTMLElement>(null);
  const location = useLocation(); const navigate = useNavigate();
  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem('vortex-theme', theme); }, [theme]);
  useEffect(() => { const media = matchMedia('(max-width: 760px)'); const update = () => { setSmallViewport(media.matches); if (!media.matches) setMobile(false); }; media.addEventListener('change', update); return () => media.removeEventListener('change', update); }, []);
  useEffect(() => { setMobile(false); setSearch(''); const frame = requestAnimationFrame(() => main.current?.focus({ preventScroll: true })); return () => cancelAnimationFrame(frame); }, [location.pathname]);
  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setMobile(false); setSearch(''); }
      if (event.key === '/' && !(event.target instanceof HTMLInputElement) && !(event.target instanceof HTMLTextAreaElement) && !(event.target instanceof HTMLElement && event.target.isContentEditable) && !smallViewport) { event.preventDefault(); searchInput.current?.focus(); }
    };
    document.addEventListener('keydown', keyboard); return () => document.removeEventListener('keydown', keyboard);
  }, [smallViewport]);
  useEffect(() => {
    if (!mobile) return;
    const previous = document.activeElement as HTMLElement | null;
    const oldOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
    sidebar.current?.querySelector<HTMLElement>('a[aria-current="page"], a')?.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const focusable = Array.from(sidebar.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])') ?? []).filter(element => element.getClientRects().length > 0);
      const first = focusable[0]; const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', trap);
    return () => { document.body.style.overflow = oldOverflow; document.removeEventListener('keydown', trap); previous?.focus({ preventScroll: true }); };
  }, [mobile]);
  const current = groups.flatMap(group => group.items).find(item => item.path === location.pathname)?.title ?? ({ '/webhook-deliveries': 'Entregas de webhooks', '/integration-executions': 'Ejecuciones de integraciones' } as Record<string, string>)[location.pathname] ?? 'Detalle de orden';
  const matches = search.trim() ? groups.flatMap(group => group.items).filter(item => item.title.toLowerCase().includes(search.toLowerCase()) && auth.can(item.permission)) : [];
  const sessionAction = async (action: () => Promise<void>) => { try { await action(); } catch { notify('No fue posible completar la operación con el proveedor de identidad.', 'error'); } };
  return <div className={`app-shell ${collapsed ? 'is-collapsed' : ''}`}>
    <a className="skip-link" href="#main-content">Saltar al contenido</a>
    {mobile && <div className="sidebar-overlay" aria-hidden="true" onClick={() => setMobile(false)} />}
    <aside id="workspace-navigation" ref={sidebar} className={`sidebar ${mobile ? 'mobile-open' : ''}`} role={mobile ? 'dialog' : undefined} aria-modal={mobile || undefined} aria-label="Navegación principal" aria-hidden={smallViewport && !mobile} inert={smallViewport && !mobile}>
      {mobile && <Button className="drawer-close" variant="ghost" aria-label="Cerrar menú" onClick={() => setMobile(false)}><X size={19} /></Button>}
      <Link to="/" className="brand"><span className="brand-symbol"><Network size={24} /></span><span className="brand-text">Integration Platform<small>VORTEXBIRD / ANDESRETAIL</small></span></Link>
      <button className="workspace-selector" onClick={() => navigate('/partners')}><span className="workspace-avatar">A</span><span>AndesRetail<small>Centro de operaciones</small></span><ChevronDown size={14} /></button>
      <nav aria-label="Módulos del workspace">{groups.map(group => <div className="nav-group" key={group.title}><p>{group.title}</p>{group.items.filter(item => auth.can(item.permission)).map(item => <NavLink key={item.path} to={item.path} end={item.path === '/'} aria-label={item.title} title={collapsed ? item.title : undefined} className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}><item.icon size={18} /><span>{item.title}</span>{item.path === '/integrations' && <i className="nav-dot" />}</NavLink>)}</div>)}</nav>
      <div className="sidebar-bottom"><div className="environment"><span className="environment-dot" /><span>Entorno de demostración<small>Adaptadores simulados</small></span></div><button className="collapse-button" onClick={() => setCollapsed(!collapsed)} aria-expanded={!collapsed} aria-label={collapsed ? 'Expandir menú' : 'Contraer menú'}>{collapsed ? <ChevronRight size={16} /> : <><ChevronLeft size={16} /><span>Contraer menú</span></>}</button></div>
    </aside>
    <div className="main-shell" inert={mobile}>
      <header className="topbar"><div className="breadcrumbs"><Button variant="ghost" className="mobile-menu" aria-label="Abrir menú" aria-expanded={mobile} aria-controls="workspace-navigation" onClick={() => setMobile(true)}><Menu size={20} /></Button><span>Workspace</span><ChevronRight size={13} /><strong>{current}</strong></div>
        <div className="topbar-actions"><div className="global-search"><Search size={16} /><input ref={searchInput} aria-label="Buscar módulo" aria-keyshortcuts="/" placeholder="Buscar en el workspace…" value={search} onChange={event => setSearch(event.target.value)} /><kbd aria-hidden="true">/</kbd>{search.trim() && <div className="search-results" role="region" aria-label="Resultados de búsqueda de módulos">{matches.length ? matches.map(item => <button key={item.path} onClick={() => { navigate(item.path); setSearch(''); }}><item.icon size={16} />{item.title}<ArrowUpRight size={13} /></button>) : <p role="status">No hay módulos coincidentes.</p>}</div>}</div>
          <Button variant="ghost" aria-label={theme === 'dark' ? 'Activar tema claro' : 'Activar tema oscuro'} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}</Button>
          <Button variant="ghost" aria-label="Ver actividad reciente" onClick={() => navigate('/activity-logs')}><Bell size={19} /></Button><div className="header-divider" />
          <details className="profile-menu"><summary aria-label="Menú de sesión"><span className="avatar">{auth.session?.user.displayName?.slice(0, 2).toUpperCase() ?? 'AR'}</span><ChevronDown size={13} /></summary><div><strong>{auth.session?.user.displayName}</strong><small>{auth.session?.user.email}</small>{!config.demoAuth && <button onClick={() => void sessionAction(auth.changePassword)}><ShieldCheck size={15} />Administrar cuenta</button>}<button onClick={() => void sessionAction(auth.logout)}><LogOut size={15} />Cerrar sesión</button></div></details>
        </div>
      </header>
      <main ref={main} id="main-content" className="page-content" tabIndex={-1}><Suspense fallback={<Skeleton rows={6} />}><Outlet /></Suspense></main>
      <footer className="app-footer"><span><ChartNoAxesCombined size={13} />VortexBird Integration Platform</span><span>AndesRetail · Sandbox de interoperabilidad</span></footer>
    </div>
  </div>;
}
