import { motion } from 'framer-motion';
import { Network } from 'lucide-react';

/**
 * Branded initialization screen. Shown while the authentication session is
 * being restored so no login form is ever painted during a valid-session reload.
 */
export function AuthSplash({ detail = 'Preparando tu workspace…' }: { detail?: string }) {
  return <div className="auth-splash" role="status" aria-live="polite" aria-label="Restaurando sesión">
    <motion.div className="auth-splash-mark"
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}>
      <span className="auth-splash-ring" aria-hidden="true" />
      <Network size={30} aria-hidden="true" />
    </motion.div>
    <p className="auth-splash-title">VortexBird <small>Integration Platform</small></p>
    <p className="auth-splash-detail">{detail}</p>
    <span className="auth-splash-bar" aria-hidden="true" />
  </div>;
}
