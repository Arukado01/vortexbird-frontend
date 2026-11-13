import { useState } from 'react';
import { ShieldCheck, ArrowRight, Network, LockKeyhole, Workflow } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from './AuthProvider';
import { config } from '../../lib/config';
import { apiError } from '../../services/api';
import { Button } from '../../components/ui';

const schema = z.object({ email: z.email('Introduce un correo válido.'), password: z.string().min(1, 'Introduce la contraseña.') });

export function LoginPage() {
  const auth = useAuth(); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { email: 'admin@andesretail.local', password: '' } });
  const runAuth = async (action: () => Promise<void>) => { setBusy(true); setError(''); try { await action(); } catch (failure) { setError(apiError(failure).message); } finally { setBusy(false); } };
  const login = (values?: z.infer<typeof schema>) => runAuth(() => auth.login(values?.email, values?.password));
  return <div className="login-page">
    <section className="login-brand" aria-label="Presentación de la plataforma">
      <div className="brand-lockup"><Network size={28} /><span>Integration Platform<small>ANDESRETAIL WORKSPACE</small></span></div>
      <div className="login-hero"><p className="eyebrow">CONEXIONES QUE MUEVEN TU NEGOCIO</p><h2>Todos tus sistemas.<br /><em>Una sola operación.</em></h2><p>Órdenes, inventario, pagos y eventos conectados. Una perspectiva completa de cada integración.</p><div className="login-nodes"><div><Network /><span>Conecta</span></div><span className="node-line" /><div><Workflow /><span>Orquesta</span></div><span className="node-line" /><div><ShieldCheck /><span>Controla</span></div></div></div>
      <p className="login-footer">VortexBird Integration Platform · Assessment de arquitectura</p>
    </section>
    <main className="login-panel"><div className="login-form">
      <span className="login-shield"><LockKeyhole size={26} /></span><p className="eyebrow">BIENVENIDO A TU WORKSPACE</p><h1>Todo empieza conectado.</h1><p className="subtitle">Accede al centro de operaciones de AndesRetail.</p>
      {config.demoAuth ? <form onSubmit={handleSubmit(login)} noValidate aria-busy={busy}>
        <div className="notice">Entorno de demostración · Autenticación local de desarrollo</div>
        <label htmlFor="login-email">Correo electrónico</label><input id="login-email" {...register('email')} autoComplete="username" type="email" aria-invalid={!!errors.email} aria-describedby={errors.email ? 'login-email-error' : undefined} />{errors.email && <small id="login-email-error" className="field-error" role="alert">{errors.email.message}</small>}
        <label htmlFor="login-password">Contraseña</label><input id="login-password" {...register('password')} type="password" autoComplete="current-password" placeholder="Contraseña configurada en el entorno" aria-invalid={!!errors.password} aria-describedby={errors.password ? 'login-password-error' : undefined} />{errors.password && <small id="login-password-error" className="field-error" role="alert">{errors.password.message}</small>}
        <Button disabled={busy} type="submit">{busy ? 'Validando acceso…' : 'Iniciar sesión'}<ArrowRight size={16} /></Button>
      </form> : <>
        <Button disabled={busy} onClick={() => void login()}>Iniciar sesión con Keycloak<ArrowRight size={16} /></Button>
        <div className="auth-links"><button disabled={busy} onClick={() => void runAuth(auth.register)}>Crear cuenta</button><button disabled={busy} onClick={() => void runAuth(auth.resetPassword)}>Recuperar contraseña</button></div>
      </>}
      {(error || auth.error) && <p className="form-error" role="alert">{error || auth.error}</p>}
      <div className="login-security"><ShieldCheck size={16} /><span>Acceso protegido · Permisos por partner y canal</span></div>
    </div></main>
  </div>;
}
