import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ShieldCheck, ArrowRight, Network, LockKeyhole, Mail, Lock, Workflow, Compass } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from './AuthProvider';
import { config, usesCognito } from '../../lib/config';
import { apiError } from '../../services/api';
import { Button } from '../../components/ui';
import { ThemeToggle } from '../../components/ThemeToggle';
import { HelpLink } from '../help/HelpLink';

const schema = z.object({ email: z.email('Introduce un correo válido.'), password: z.string().min(1, 'Introduce la contraseña.') });

export function LoginPage() {
  const { pathname } = useLocation();
  const recovery = !config.demoAuth && !usesCognito && pathname === '/forgot-password';
  const registration = !config.demoAuth && !usesCognito && pathname === '/register';
  const auth = useAuth(); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { email: '', password: '' } });
  const runAuth = async (action: () => Promise<void>) => { setBusy(true); setError(''); try { await action(); } catch (failure) { setError(apiError(failure).message); } finally { setBusy(false); } };
  const login = (values?: z.infer<typeof schema>) => runAuth(() => auth.login(values?.email, values?.password));
  return <div className="login-page">
    <section className="login-brand" aria-label="Presentación de la plataforma">
      <div className="brand-lockup"><Network size={28} /><span>VortexBird<small>INTEGRATION PLATFORM</small></span></div>
      <div className="login-hero"><p className="eyebrow">CONEXIONES QUE MUEVEN TU NEGOCIO</p><h2>Todos tus sistemas.<br /><em>Una sola operación.</em></h2><p>Órdenes, inventario, pagos y eventos conectados en un mismo centro de operaciones, con visibilidad completa de cada integración.</p>
        <ul className="login-nodes">
          <li><Network aria-hidden="true" /><span>Conecta</span><small>Adaptadores ERP, WMS, OMS y CRM</small></li>
          <li><Workflow aria-hidden="true" /><span>Orquesta</span><small>Sagas con compensación automática</small></li>
          <li><ShieldCheck aria-hidden="true" /><span>Controla</span><small>Permisos por partner y canal</small></li>
        </ul>
      </div>
      <p className="login-footer">VortexBird Integration Platform · AndesRetail</p>
    </section>
    <main className="login-panel"><div className="login-card">
      <div className="login-form-tools">
        <span className="login-shield"><LockKeyhole size={26} /></span>
        <ThemeToggle />
      </div>
      <p className="eyebrow">BIENVENIDO A TU WORKSPACE</p><h1>{registration ? 'Crear cuenta' : recovery ? 'Recuperar contraseña' : 'Todo empieza conectado.'}</h1>
      <p className="subtitle">{registration || recovery ? 'Continúa en el proveedor de identidad de la plataforma.' : 'Accede al centro de operaciones de AndesRetail.'}</p>
      {registration || recovery ? <>
        <Button className="login-cta" disabled={busy} onClick={() => void runAuth(registration ? auth.register : auth.resetPassword)}>{busy ? 'Abriendo el proveedor…' : 'Continuar con Keycloak'}<ArrowRight size={16} /></Button>
        <Link className="back-link login-back" to="/">Volver al inicio de sesión</Link>
      </> : config.demoAuth ? <form onSubmit={handleSubmit(login)} noValidate aria-busy={busy}>
        <div className="notice login-env-note">Entorno de demostración · Autenticación local de desarrollo</div>
        <label htmlFor="login-email">Correo electrónico
          <span className="input-icon"><Mail size={16} aria-hidden="true" /><input id="login-email" {...register('email')} autoComplete="username" type="email" placeholder="tu.correo@empresa.com" aria-invalid={!!errors.email} aria-describedby={errors.email ? 'login-email-error' : undefined} /></span>
          {errors.email && <small id="login-email-error" className="field-error" role="alert">{errors.email.message}</small>}
        </label>
        <label htmlFor="login-password">Contraseña
          <span className="input-icon"><Lock size={16} aria-hidden="true" /><input id="login-password" {...register('password')} type="password" autoComplete="current-password" placeholder="Tu contraseña" aria-invalid={!!errors.password} aria-describedby={errors.password ? 'login-password-error' : undefined} /></span>
          {errors.password && <small id="login-password-error" className="field-error" role="alert">{errors.password.message}</small>}
        </label>
        <Button className="login-cta" disabled={busy} type="submit">{busy ? 'Validando acceso…' : 'Iniciar sesión'}{!busy && <ArrowRight size={16} />}</Button>
      </form> : <>
        <Button className="login-cta" disabled={busy} onClick={() => void login()} aria-busy={busy}>{busy ? 'Abriendo el acceso seguro…' : 'Iniciar sesión'}{!busy && <ArrowRight size={16} />}</Button>
        {!usesCognito && <div className="auth-links"><Link to="/register">Crear cuenta</Link><Link to="/forgot-password">Recuperar contraseña</Link></div>}
      </>}
      {(error || auth.error) && <p className="form-error" role="alert">{error || auth.error}</p>}
      <nav className="login-secondary" aria-label="Ayuda de acceso">
        <HelpLink className="login-secondary-link" />
        <HelpLink contextual manualId="acceso" className="login-secondary-link" />
      </nav>
      <div className="login-security"><Compass size={15} /><span>Centro de ayuda y manual de acceso siempre disponibles · Acceso protegido por permisos</span></div>
    </div></main>
  </div>;
}
