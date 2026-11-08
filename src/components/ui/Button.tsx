// Bouton du design system : variantes et tailles nommées (classes btn-* de
// src/index.css). Pour les nouveaux écrans, préférer ce composant aux classes
// recopiées à la main.
import { ButtonHTMLAttributes, forwardRef } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'brand' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  danger: 'btn-danger',
  brand: 'btn-brand',
  ghost: 'text-body transition-colors hover:bg-surface-muted disabled:opacity-60',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2',
  lg: 'px-4 py-3',
};

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-md font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-2';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', type = 'button', className = '', ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      className={[BASE, VARIANTS[variant], SIZES[size], className].filter(Boolean).join(' ')}
      {...props}
    />
  );
});
