// Pastille de statut du design system (classes badge + badge-<ton>).
import { HTMLAttributes } from 'react';

export type BadgeTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

export function Badge({ tone = 'neutral', className = '', ...props }: BadgeProps) {
  return <span className={['badge', `badge-${tone}`, className].filter(Boolean).join(' ')} {...props} />;
}
