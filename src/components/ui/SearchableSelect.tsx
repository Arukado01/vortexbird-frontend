import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronDown, Loader2, Search, X } from 'lucide-react';
import { clsx } from 'clsx';
import { EASE_VORTEX, duration } from '../motion';

export interface SelectOption { value: string; label: string; hint?: string; disabled?: boolean }

interface SearchableSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  label?: string;
  ariaLabel?: string;
  placeholder?: string;
  emptyText?: string;
  loadingText?: string;
  loading?: boolean;
  disabled?: boolean;
  required?: boolean;
  clearable?: boolean;
  className?: string;
  id?: string;
}

const normalize = (text: string) => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
const POPOVER_GAP = 6;
const MIN_POPOVER_WIDTH = 250;
const POPOVER_MAX_HEIGHT = 296;

/**
 * Global searchable selector. Replaces every native <select> in the platform.
 * - Filters in real time (accent-insensitive) without changing the submitted value.
 * - Fixed-position popover: stays inside the viewport, works inside modals and
 *   scrollable containers because it is never clipped by ancestor overflow.
 * - Full keyboard support: Arrows / Home / End / Enter / Escape / Tab.
 * - Required validation is enforced on the owning form submit event.
 */
export function SearchableSelect({
  value, onChange, options, label, ariaLabel, placeholder = 'Selecciona…',
  emptyText = 'Sin resultados', loadingText = 'Cargando opciones…',
  loading = false, disabled = false, required = false, clearable = false, className, id,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [error, setError] = useState('');
  const [rect, setRect] = useState<{ top: number; left: number; width: number; up: boolean } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const optionId = useId();
  const above = rect?.up;

  const selected = options.find(option => option.value === value);
  const filtered = useMemo(() => {
    const terms = normalize(query).trim().split(/\s+/).filter(Boolean);
    if (!terms.length) return options;
    return options.filter(option => {
      const corpus = normalize(`${option.label} ${option.hint ?? ''}`);
      return terms.every(term => corpus.includes(term));
    });
  }, [options, query]);

  const measure = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const box = trigger.getBoundingClientRect();
    const width = Math.max(box.width, MIN_POPOVER_WIDTH);
    const left = Math.min(Math.max(6, box.left), window.innerWidth - width - 6);
    const below = window.innerHeight - box.bottom;
    const up = below < Math.min(POPOVER_MAX_HEIGHT + POPOVER_GAP, 240) && box.top > below;
    const top = up ? Math.max(6, box.top - POPOVER_GAP) : box.bottom + POPOVER_GAP;
    setRect({ top, left, width, up });
  }, []);

  useLayoutEffect(() => { if (open) measure(); }, [open, measure]);
  useEffect(() => {
    if (!open) return;
    let frame = 0;
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure); };
    document.addEventListener('scroll', schedule, true);
    window.addEventListener('resize', schedule);
    return () => { cancelAnimationFrame(frame); document.removeEventListener('scroll', schedule, true); window.removeEventListener('resize', schedule); };
  }, [open, measure]);

  const close = useCallback((focusBack = true) => {
    setOpen(false);
    setQuery('');
    if (focusBack) requestAnimationFrame(() => triggerRef.current?.focus({ preventScroll: true }));
  }, []);

  const openPopup = useCallback((silent = false) => {
    if (disabled) return;
    if (!silent) setError('');
    setActive(Math.max(0, filtered.findIndex(option => option.value === value)));
    setOpen(true);
  }, [disabled, filtered, value]);

  // Close on outside interaction.
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!(event.target instanceof Node) || rootRef.current?.contains(event.target)) return;
      setOpen(false); setQuery('');
    };
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [open]);

  // Required validation on the owning form, mirroring native select semantics.
  useEffect(() => {
    const trigger = triggerRef.current;
    const form = trigger?.closest('form');
    if (!form || !required) return;
    const onSubmit = (event: Event) => {
      if (value) return;
      // Mirror native constraint validation: block the submit before any listener
      // (including React's delegated handler) can run the mutation.
      event.preventDefault();
      event.stopImmediatePropagation();
      openPopup(true);
      setError('Selecciona una opción.');
      triggerRef.current?.focus({ preventScroll: true });
    };
    form.addEventListener('submit', onSubmit);
    return () => form.removeEventListener('submit', onSubmit);
  }, [required, value, open, openPopup]);

  const choose = (option: SelectOption) => {
    onChange(option.value);
    setError('');
    close();
  };

  const onTriggerKeyDown = (event: React.KeyboardEvent) => {
    if (open) return;
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
      event.preventDefault();
      openPopup();
    }
  };

  const onPopupKeyDown = (event: React.KeyboardEvent) => {
    const count = filtered.length;
    const move = (delta: number) => { event.preventDefault(); setActive(current => count ? (current + delta + count) % count : 0); };
    switch (event.key) {
      case 'ArrowDown': move(1); break;
      case 'ArrowUp': move(-1); break;
      case 'Home': event.preventDefault(); setActive(0); break;
      case 'End': event.preventDefault(); setActive(Math.max(0, count - 1)); break;
      case 'Enter':
        event.preventDefault();
        if (filtered[active] && !filtered[active].disabled) choose(filtered[active]);
        break;
      case 'Escape':
      case 'Tab':
        // Escape must not bubble: the surrounding dialog would close too.
        if (event.key === 'Escape') event.preventDefault();
        event.stopPropagation();
        close(event.key === 'Escape');
        break;
    }
  };

  // Keep the active option visible while navigating with the keyboard.
  useEffect(() => {
    if (!open) return;
    const target = listRef.current?.querySelector('[data-active="true"]');
    if (target && typeof target.scrollIntoView === 'function') target.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  const popStyle: React.CSSProperties | undefined = open && rect ? {
    top: above ? undefined : rect.top,
    bottom: above ? window.innerHeight - rect.top : undefined,
    left: rect.left,
    width: rect.width,
  } : undefined;

  const displayName = label ?? ariaLabel;
  const describedBy = error ? `${optionId}-error` : undefined;
  const trigger = <button
    ref={triggerRef}
    id={id}
    type="button"
    role="combobox"
    aria-expanded={open}
    aria-haspopup="listbox"
    aria-controls={open ? listId : undefined}
    aria-activedescendant={open && filtered[active] ? `${optionId}-${active}` : undefined}
    aria-invalid={!!error || undefined}
    aria-describedby={describedBy}
    aria-label={label || ariaLabel}
    aria-required={required || undefined}
    disabled={disabled}
    data-invalid={!!error || undefined}
    className={clsx('select-trigger', value && 'has-value', className)}
    onClick={() => (open ? close() : openPopup())}
    onKeyDown={onTriggerKeyDown}>
    <span className={clsx('select-value', !selected && 'is-placeholder')}>{selected?.label ?? placeholder}</span>
    <span className="select-affordances">
      {clearable && !!value && !disabled && <span role="button" tabIndex={-1} aria-label="Limpiar selección" className="select-clear" onClick={event => { event.stopPropagation(); onChange(''); setError(''); }}><X size={14} /></span>}
      <ChevronDown size={15} className={clsx('select-chevron', open && 'is-open')} aria-hidden="true" />
    </span>
  </button>;

  return <div ref={rootRef} className="searchable-select">
    {trigger}
    {error && <small id={`${optionId}-error`} className="field-error" role="alert">{error}</small>}
    <AnimatePresence>
      {open && <motion.div
        key="popover"
        className={clsx('select-popover', above && 'opens-up')}
        style={popStyle}
        role="dialog"
        aria-label={displayName ? `Buscar en ${displayName}` : 'Buscar opciones'}
        initial={{ opacity: 0, y: above ? 6 : -6, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: above ? 4 : -4, scale: 0.99 }}
        transition={{ duration: duration.fast + 0.04, ease: EASE_VORTEX }}
        onKeyDown={onPopupKeyDown}>
        <div className="select-search">
          <Search size={15} aria-hidden="true" />
          <input
            ref={searchRef}
            type="text"
            role="searchbox"
            autoFocus
            aria-label={displayName ? `Buscar en ${displayName}` : 'Buscar opciones'}
            placeholder="Buscar…"
            value={query}
            onChange={event => { setQuery(event.target.value); setActive(0); }}
          />
          {query && <button type="button" className="select-clear" aria-label="Limpiar búsqueda" onClick={() => { setQuery(''); searchRef.current?.focus(); }}><X size={13} /></button>}
        </div>
        <div className="select-list" ref={listRef} role="listbox" id={listId} aria-label={label ?? ariaLabel}>
          {loading
            ? <div className="select-loading" role="status"><Loader2 size={15} className="spin" aria-hidden="true" />{loadingText}</div>
            : filtered.length
              ? filtered.map((option, index) => <div
                key={option.value}
                id={`${optionId}-${index}`}
                role="option"
                aria-selected={option.value === value}
                aria-disabled={option.disabled || undefined}
                data-active={index === active || undefined}
                className={clsx('select-option', index === active && 'is-active', option.value === value && 'is-selected', option.disabled && 'is-disabled')}
                onPointerMove={() => setActive(index)}
                onClick={() => { if (!option.disabled) choose(option); }}>
                <span className="select-option-label">{option.label}{option.hint && <small>{option.hint}</small>}</span>
                {option.value === value && <Check size={14} aria-hidden="true" />}
              </div>)
              : <div className="select-empty" role="status">{emptyText}</div>}
        </div>
      </motion.div>}
    </AnimatePresence>
  </div>;
}
