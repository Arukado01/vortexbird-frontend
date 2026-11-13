import { lazy, Suspense } from 'react';
import type { ReactNode } from 'react';
import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import { AuthProvider, useAuth } from '../features/auth/AuthProvider';
import { LoginPage } from '../features/auth/LoginPage';
const DashboardPage=lazy(()=>import('../features/dashboard/DashboardPage').then(module=>({default:module.DashboardPage})));
import { ResourcePage } from '../features/resources/ResourcePage';
import { resources } from '../features/resources/config';
import { OrdersPage, OrderDetailPage } from '../features/orders/OrdersPage';
import { IntegrationsPage } from '../features/integrations/IntegrationsPage';
import { RolesPage } from '../features/roles/RolesPage';
import { ReportsPage } from '../features/reports/ReportsPage';
import { SettingsPage } from '../features/settings/SettingsPage';
import { Empty, Skeleton, ToastProvider } from '../components/ui';
import { Layout } from './Layout';
function Guard({permission,children}:{permission:string;children:ReactNode}){const auth=useAuth();return auth.can(permission)?children:<Empty title="Acceso restringido" detail="Tu perfil no tiene permisos para acceder a este módulo. Solicita el acceso a un administrador."/>;}
function AuthenticatedApp(){const auth=useAuth();if(auth.loading)return <div className="initial-loading"><Skeleton rows={4}/></div>;if(!auth.session)return <LoginPage/>;return <Routes><Route element={<Layout/>}><Route index element={<Guard permission="dashboard.read"><DashboardPage/></Guard>}/>{Object.entries(resources).map(([path,cfg])=><Route key={path} path={path} element={<Guard permission={cfg.permission}><ResourcePage key={path} resource={path}/></Guard>}/>)}<Route path="orders" element={<Guard permission="orders.read"><OrdersPage/></Guard>}/><Route path="orders/:id" element={<Guard permission="orders.read"><OrderDetailPage/></Guard>}/><Route path="integrations" element={<Guard permission="integrations.read"><IntegrationsPage/></Guard>}/><Route path="roles" element={<Guard permission="roles.read"><RolesPage/></Guard>}/><Route path="reports" element={<Guard permission="reports.read"><ReportsPage/></Guard>}/><Route path="settings" element={<Guard permission="settings.read"><SettingsPage/></Guard>}/><Route path="*" element={<Empty title="Esta página no existe" detail="Usa el menú para continuar en el workspace."><Link className="button button-primary" to="/">Volver al dashboard</Link></Empty>}/></Route></Routes>;}
export function App(){return <MotionConfig reducedMotion="user"><BrowserRouter><ToastProvider><AuthProvider><Suspense fallback={<Skeleton rows={6}/>}><AuthenticatedApp/></Suspense></AuthProvider></ToastProvider></BrowserRouter></MotionConfig>;}

