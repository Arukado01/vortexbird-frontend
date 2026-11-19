import { BookOpen, CircleHelp } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { helpPath, manualFor } from './index';

export function HelpLink({ contextual, manualId, className }: { contextual?: boolean; manualId?: string; className?: string }) {
  const location = useLocation();
  const manual = contextual ? manualId ?? manualFor(location.pathname) : undefined;
  if (contextual && !manual) return null;
  const label = contextual ? 'Manual de este módulo' : 'Centro de ayuda';
  const Icon = contextual ? BookOpen : CircleHelp;
  return <Link className={className} to={helpPath(manual)} state={{ from: location.pathname + location.search + location.hash }} aria-label={label} title={label}>
    <Icon size={17} aria-hidden="true" /><span>{label}</span>
  </Link>;
}
