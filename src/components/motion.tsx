import { useEffect, useRef } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'framer-motion';
import type { Transition, Variants } from 'framer-motion';

/**
 * Global motion guide for VortexBird.
 * - Durations: fast (0.16s) for interactions, base (0.3s) for components, slow (0.5s) for page entry.
 * - Curves: the "vortex" easing accelerates quickly and settles softly.
 * - Only transform/opacity are animated; layout properties stay untouched.
 * - MotionConfig reducedMotion="user" plus the global CSS rule honor prefers-reduced-motion.
 */
export const EASE_VORTEX = [0.22, 1, 0.36, 1] as const;
export const duration = { fast: 0.16, base: 0.3, slow: 0.5 } as const;
export const pageTransition: Transition = { duration: duration.slow, ease: EASE_VORTEX };

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: pageTransition },
};
export const fadeDown: Variants = {
  hidden: { opacity: 0, y: -10 },
  show: { opacity: 1, y: 0, transition: { duration: duration.base, ease: EASE_VORTEX } },
};
export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: duration.base, ease: EASE_VORTEX } },
};
export const popIn: Variants = {
  hidden: { opacity: 0, scale: 0.96, y: 8 },
  show: { opacity: 1, scale: 1, y: 0, transition: { duration: duration.base, ease: EASE_VORTEX } },
};
/** Staggered container: children reveal one after another on mount only. */
export const stagger = (delay = 0.06, later = 0.02): Variants => ({
  hidden: {},
  show: { transition: { delayChildren: delay, staggerChildren: later } },
});
export const rowContainer = (later = 0.035): Variants => ({ hidden: {}, show: { transition: { staggerChildren: later } } });
export const rowItem: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: duration.base, ease: EASE_VORTEX } },
};

/** One-shot reveal wrapper: animates on mount, never on re-render. */
export function Reveal({ children, variant = fadeUp, className, style, delay = 0, once = true, amount = 0.12 }: {
  children: ReactNode; variant?: Variants; className?: string; style?: CSSProperties; delay?: number; once?: boolean; amount?: number;
}) {
  return <motion.div className={className} style={style} variants={variant} initial="hidden" whileInView="show" viewport={{ once, amount }} transition={{ delay, duration: duration.base, ease: EASE_VORTEX }}>{children}</motion.div>;
}

/** Mount-based entrance for above-the-fold compositions: no scroll dependency. */
export function Enter({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  return <motion.div className={className} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: duration.slow, delay, ease: EASE_VORTEX }}>{children}</motion.div>;
}

/** Staggered group for grids and card collections. */
export function Stagger({ children, className, style, delay = 0, later = 0.05, amount = 0.15 }: {
  children: ReactNode; className?: string; style?: CSSProperties; delay?: number; later?: number; amount?: number;
}) {
  return <motion.div className={className} style={style} variants={stagger(delay, later)} initial="hidden" whileInView="show" viewport={{ once: true, amount }}>{children}</motion.div>;
}
export function StaggerItem({ children, className, style, variant = fadeUp }: { children: ReactNode; className?: string; style?: CSSProperties; variant?: Variants }) {
  return <motion.div className={className} style={style} variants={variant}>{children}</motion.div>;
}

/** Route swap wrapper: keyed by location so entry plays once per navigation. */
export function PageSwap({ swapKey, children, className }: { swapKey: string; children: ReactNode; className?: string }) {
  return <motion.div className={className} key={swapKey} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={pageTransition}>{children}</motion.div>;
}

/** Animated counter: springs from zero on first load, tweens between updates. */
export function AnimatedNumber({ value, format, className }: { value: number; format: (value: number) => string; className?: string }) {
  const reduced = useReducedMotion();
  const raw = useMotionValue(reduced ? value : 0);
  const spring = useSpring(raw, { stiffness: 150, damping: 30, mass: 0.8 });
  // Whole units only: intermediate frames must never show decimal noise.
  const text = useTransform(spring, latest => format(Math.max(0, Math.round(latest))));
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => { raw.set(value); }, [value, raw]);
  useEffect(() => text.on('change', latest => { if (ref.current) ref.current.textContent = latest; }), [text]);
  return <motion.span ref={ref} className={className}>{format(value)}</motion.span>;
}

/** Staggered table body: subtle row entrance for data tables. */
export function RowStagger({ children, className }: { children: ReactNode; className?: string }) {
  return <motion.tbody className={className} variants={rowContainer()} initial="hidden" animate="show">{children}</motion.tbody>;
}
export function RowItem({ children, className }: { children: ReactNode; className?: string }) {
  return <motion.tr className={className} variants={rowItem}>{children}</motion.tr>;
}
