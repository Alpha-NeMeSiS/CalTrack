// Carte du design system (fond de surface, arrondi, ombre : classe `panel`).
import { HTMLAttributes } from 'react';

export interface CardProps extends HTMLAttributes<HTMLElement> {
  /** Élément rendu : section pour un bloc titré, div sinon */
  as?: 'div' | 'section' | 'article';
  /** Marge intérieure (par défaut : 1 rem, 1,5 rem sur grand écran) */
  padded?: boolean;
}

export function Card({ as: Tag = 'div', padded = true, className = '', ...props }: CardProps) {
  return <Tag className={['panel', padded ? 'p-4 sm:p-6' : '', className].filter(Boolean).join(' ')} {...props} />;
}
