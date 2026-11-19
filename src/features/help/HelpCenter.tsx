import { useEffect, useRef } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Network, Printer, Search } from 'lucide-react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ThemeToggle } from '../../components/ThemeToggle';
import { Button, Empty, SearchableSelect } from '../../components/ui';
import { Stagger, StaggerItem } from '../../components/motion';
import { useAuth } from '../auth/AuthProvider';
import { helpPath, manualByRoute } from './index';
import { audiences, categories, findManuals, manuals, type Manual } from './manuals';
import './help.css';

function formattedDate(iso: string) {
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(iso));
}

function returnPath(value: unknown) {
  if (typeof value !== 'string' || !value.startsWith('/') || /^[/\\]{2}/.test(value)) return '/';
  const path = value.split(/[?#]/, 1)[0];
  const known = Object.hasOwn(manualByRoute, path) || ['/register', '/forgot-password'].includes(path) || /^\/orders\/[^/\\]+$/.test(path);
  return known ? value : '/';
}

export function HelpCenter() {
  const auth = useAuth();
  const location = useLocation();
  const { manualId } = useParams();
  const [filters, setFilters] = useSearchParams();
  const heading = useRef<HTMLHeadingElement>(null);
  const manual = manuals.find(item => item.id === manualId);
  const workspace = returnPath(location.state?.from);
  const catalogUrl = helpPath() + (filters.size ? `?${filters}` : '');
  const returnState = { from: workspace };

  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }, [manualId]);

  const updateFilter = (key: string, value: string) => {
    const next = new URLSearchParams(filters);
    if (value) next.set(key, value); else next.delete(key);
    setFilters(next, { replace: true, state: returnState });
  };
  const results = findManuals(filters.get('q') ?? '', filters.get('category') ?? '', filters.get('audience') ?? '');

  return <div className="help-shell">
    <a className="skip-link" href="#help-content">Saltar al contenido</a>
    <header className="help-header">
      <Link to={catalogUrl} state={returnState} className="help-brand"><span className="brand-symbol"><Network size={22} /></span><span>VortexBird <small>Integration Platform</small></span></Link>
      <div className="help-header-actions">
        <Link to={workspace} className="button button-secondary"><ArrowLeft size={15} />{auth.session ? 'Volver al workspace' : 'Ir al inicio de sesión'}</Link>
        <ThemeToggle />
      </div>
    </header>
    <main id="help-content" className="help-main">
      {manualId
        ? <>
          <Link className="back-link help-no-print" to={catalogUrl} state={returnState}><ArrowLeft size={15} />Todos los manuales</Link>
          {manual
            ? <ManualDetail manual={manual} heading={heading} />
            : <><h1 className="help-title" ref={heading} tabIndex={-1}>Manual no encontrado</h1><Empty title="Consulta el catálogo de manuales" detail="Es posible que el enlace haya cambiado."><Link className="button button-primary" to={catalogUrl} state={returnState}>Ver catálogo</Link></Empty></>}
        </>
        : <>
          <motion.div className="help-hero" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}>
            <span className="help-mark"><BookOpen size={24} aria-hidden="true" /></span>
            <h1 className="help-title" ref={heading} tabIndex={-1}>Centro de ayuda</h1>
            <p>Encuentra guías para acceder a VortexBird y operar cada módulo.</p>
          </motion.div>
          <div className="help-catalog">
            <aside className="help-index" aria-label="Filtros de manuales">
              <h2>Filtrar manuales</h2>
              <SearchableSelect label="Módulo" clearable placeholder="Todos los módulos" value={filters.get('category') ?? ''} onChange={value => updateFilter('category', value)} options={categories.map(category => ({ value: category, label: category }))} />
              <SearchableSelect label="Tipo de usuario" clearable placeholder="Todos los perfiles" value={filters.get('audience') ?? ''} onChange={value => updateFilter('audience', value)} options={audiences.map(audience => ({ value: audience, label: audience }))} />
              {filters.size > 0 && <Button variant="ghost" onClick={() => setFilters({}, { replace: true, state: returnState })}>Limpiar filtros</Button>}
              <p className="help-index-note">Los manuales se actualizan con cada versión de la plataforma.</p>
            </aside>
            <section className="help-results" aria-label="Manuales disponibles">
              <label className="help-search">Buscar en los manuales<span><Search size={18} aria-hidden="true" /><input type="search" value={filters.get('q') ?? ''} placeholder="Ej. restablecer contraseña" onChange={event => updateFilter('q', event.target.value)} /></span></label>
              <p className="help-count" role="status">{results.length} {results.length === 1 ? 'manual' : 'manuales'}</p>
              {results.length
                ? <Stagger className="help-cards" later={0.05}>{results.map(item => <StaggerItem key={item.id}><Link className="help-card" to={helpPath(item.id) + (filters.size ? `?${filters}` : '')} state={returnState}>
                  <div><span className="help-chip">{item.category}</span><h2>{item.title}</h2><p>{item.summary}</p></div>
                  <div className="help-card-foot"><span>v{item.history[0].version} · {formattedDate(item.history[0].date)}</span><ArrowRight size={17} aria-hidden="true" /></div>
                </Link></StaggerItem>)}</Stagger>
                : <Empty title="No encontramos manuales" detail="Prueba otras palabras o cambia los filtros." />}
            </section>
          </div>
        </>}
    </main>
  </div>;
}

function ManualDetail({ manual, heading }: { manual: Manual; heading: React.RefObject<HTMLHeadingElement | null> }) {
  const auth = useAuth();
  const { sections, faq, illustration: image } = manual;
  const latest = manual.history[0];

  return <>
    <div className="help-manual-title">
      <div><p className="help-category">{manual.module}</p><h1 className="help-title" ref={heading} tabIndex={-1}>{manual.title}</h1><p>{manual.summary}</p></div>
      <Button variant="secondary" className="help-no-print" onClick={() => window.print()}><Printer size={17} />Imprimir o guardar en PDF</Button>
    </div>
    <dl className="help-metadata">
      <div><dt>Versión</dt><dd>{latest.version}</dd></div>
      <div><dt>Actualizado</dt><dd><time dateTime={latest.date}>{formattedDate(latest.date)}</time></dd></div>
      <div><dt>Público objetivo</dt><dd>{manual.audiences.join(', ')}</dd></div>
      <div><dt>Responsable</dt><dd>{manual.owner}</dd></div>
    </dl>
    <div className="help-reading">
          <nav className="help-index help-no-print" aria-label="Índice del manual">
            <h2>En esta guía</h2>
            {sections.map(section => <a key={section.id} href={`#${section.id}`}>{section.title}</a>)}
            {faq.length > 0 && <a href="#preguntas">Preguntas frecuentes</a>}
            <a href="#historial">Historial de cambios</a>
          </nav>
          <article className="help-article">
            {image && <figure className="help-illustration"><img src={`${import.meta.env.BASE_URL}help-media/${image.file}`} alt={image.alt} loading="lazy" /><figcaption>{image.caption}</figcaption></figure>}
            {manual.flow && <ol className="help-flow" aria-label="Diagrama del proceso">{manual.flow.map(step => <li key={step}>{step}</li>)}</ol>}
            {sections.map(section => <section id={section.id} key={section.id}>
              <h2>{section.title}</h2>
              {section.permission && <p className="muted">Permiso para realizar la operación: <code>{section.permission}</code></p>}
              <ol>{section.steps.map(step => <li key={step}>{step}</li>)}</ol>
              {section.route && auth.session && (!section.permission || auth.can(section.permission)) && <Link className="back-link help-no-print" to={section.route}>Ir al módulo <ArrowRight size={15} /></Link>}
            </section>)}
            {faq.length > 0 && <section id="preguntas"><h2>Preguntas frecuentes</h2><dl className="help-faq">{faq.map(item => <div key={item.question}><dt>{item.question}</dt><dd>{item.answer}</dd></div>)}</dl></section>}
            <section id="historial"><h2>Historial de cambios</h2><dl className="help-faq">{manual.history.map(entry => <div key={entry.version}><dt>v{entry.version} · <time dateTime={entry.date}>{formattedDate(entry.date)}</time></dt><dd>{entry.description}</dd></div>)}</dl></section>
          </article>
        </div>
  </>;
}
