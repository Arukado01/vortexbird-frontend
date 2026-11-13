import { lazy, Suspense } from 'react';
import type { ReactNode } from 'react';
import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import { AuthProvider, useAuth } from '../features/auth/AuthProvider';
const LoginPage=lazy(()=>import('../features/auth/LoginPage').then(module=>({default:module.LoginPage})));
const DashboardPage=lazy(()=>import('../features/dashboard/DashboardPage').then(module=>({default:module.DashboardPage})));
const ResourcePage=lazy(()=>import('../features/resources/ResourcePage').then(module=>({default:module.ResourcePage})));
import { resources } from '../features/resources/config';
const OrdersPage=lazy(()=>import('../features/orders/OrdersPage').then(module=>({default:module.OrdersPage})));
const OrderDetailPage=lazy(()=>import('../features/orders/OrdersPage').then(module=>({default:module.OrderDetailPage})));
const IntegrationsPage=lazy(()=>import('../features/integrations/IntegrationsPage').then(module=>({default:module.IntegrationsPage})));
const RolesPage=lazy(()=>import('../features/roles/RolesPage').then(module=>({default:module.RolesPage})));
const ReportsPage=lazy(()=>import('../features/reports/ReportsPage').then(module=>({default:module.ReportsPage})));
const SettingsPage=lazy(()=>import('../features/settings/SettingsPage').then(module=>({default:module.SettingsPage})));
import { Empty, Skeleton, ToastProvider } from '../components/ui';
import { Layout } from './Layout';
function Guard({permission,children}:{permission:string;children:ReactNode}){const auth=useAuth();return auth.can(permission)?children:<Empty title="Acceso restringido" detail="Tu perfil no tiene permisos para acceder a este módulo. Solicita el acceso a un administrador."/>;}
function AuthenticatedApp(){const auth=useAuth();if(auth.loading)return <div className="initial-loading"><Skeleton rows={4}/></div>;if(!auth.session)return <LoginPage/>;return <Routes><Route element={<Layout/>}><Route index element={<Guard permission="dashboard.read"><DashboardPage/></Guard>}/>{Object.entries(resources).map(([path,cfg])=><Route key={path} path={path} element={<Guard permission={cfg.permission}><ResourcePage key={path} resource={path}/></Guard>}/>)}<Route path="orders" element={<Guard permission="orders.read"><OrdersPage/></Guard>}/><Route path="orders/:id" element={<Guard permission="orders.read"><OrderDetailPage/></Guard>}/><Route path="integrations" element={<Guard permission="integrations.read"><IntegrationsPage/></Guard>}/><Route path="roles" element={<Guard permission="roles.read"><RolesPage/></Guard>}/><Route path="reports" element={<Guard permission="reports.read"><ReportsPage/></Guard>}/><Route path="settings" element={<Guard permission="settings.read"><SettingsPage/></Guard>}/><Route path="*" element={<Empty title="Esta página no existe" detail="Usa el menú para continuar en el workspace."><Link className="button button-primary" to="/">Volver al dashboard</Link></Empty>}/></Route></Routes>;}
export function App(){return <MotionConfig reducedMotion="user"><BrowserRouter><ToastProvider><AuthProvider><Suspense fallback={<Skeleton rows={6}/>}><AuthenticatedApp/></Suspense></AuthProvider></ToastProvider></BrowserRouter></MotionConfig>;}
