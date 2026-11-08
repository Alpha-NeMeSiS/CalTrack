// Champ de formulaire du design system : libellé, champ, aide et erreur reliés
// pour les lecteurs d'écran (classes field-label / field-input).
import { forwardRef, InputHTMLAttributes, useId } from 'react';

export interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  /** Indication sous le champ */
  hint?: string;
  /** Message d'erreur (le champ est alors marqué invalide) */
  error?: string;
}

export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, hint, error, id, className = '', ...props },
  ref
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;

  return (
    <div>
      <label htmlFor={inputId} className="field-label mb-1">
        {label}
      </label>
      <input
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={['field-input w-full px-3 py-2', error ? 'border-danger-500' : '', className].filter(Boolean).join(' ')}
        {...props}
      />
      {error && (
        <p id={errorId} className="mt-1 text-sm text-danger-700">
          {error}
        </p>
      )}
      {hint && (
        <p id={hintId} className="mt-1 text-xs text-subtle">
          {hint}
        </p>
      )}
    </div>
  );
});
