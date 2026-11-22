// Squelette des pages d'information (« À propos », « Guide ») : titre, intro,
// actions, raccourcis vers les sections et défilement vers une section demandée.
import { ReactNode, useEffect } from 'react';
import { ChevronLeft } from 'lucide-react';
import { Button } from './Button';

export interface InfoSectionDef<S extends string> {
  id: S;
  title: string;
  tone?: 'default' | 'warning';
  content: ReactNode;
}

interface InfoPageProps<S extends string> {
  title: string;
  intro?: ReactNode;
  sections: InfoSectionDef<S>[];
  /** Section vers laquelle défiler */
  section?: S;
  /** Change à chaque demande d'ouverture : relance le défilement vers la même section */
  scrollKey?: number;
  /** Préfixe des id de section (`${idPrefix}-${id}`) */
  idPrefix: string;
  /** Écran de connexion : retour au formulaire */
  onBack?: () => void;
  /** Boutons sous le titre */
  actions?: ReactNode;
}

export function InfoPage<S extends string>({
  title,
  intro,
  sections,
  section,
  scrollKey,
  idPrefix,
  onBack,
  actions,
}: InfoPageProps<S>) {
  const sectionId = (id: S) => `${idPrefix}-${id}`;
  const firstId = sections[0]?.id;

  // La première section s'ouvre en haut de page, avec le titre et les raccourcis
  const scrollToSection = (target: S) => {
    if (target === firstId) {
      window.scrollTo?.({ top: 0, behavior: 'smooth' });
      return;
    }
    document.getElementById(sectionId(target))?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  };

  // Défile jusqu'à la section demandée, y compris quand elle change sur la page
  useEffect(() => {
    if (section) scrollToSection(section);
    // Défilement relancé à chaque demande (section ou scrollKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section, scrollKey]);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {onBack && (
        <Button variant="ghost" size="sm" className="-ml-2 text-primary-700" onClick={onBack}>
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          Retour à la connexion
        </Button>
      )}
      <h1 className="page-title">{title}</h1>
      {intro && <p className="text-sm text-muted">{intro}</p>}
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}

      <nav aria-label="Sections de la page" className="flex flex-wrap gap-2">
        {sections.map(({ id, title: sectionTitle }) => (
          <button
            key={id}
            type="button"
            onClick={() => scrollToSection(id)}
            className="rounded-full bg-surface-sunken px-3 py-1.5 text-xs font-medium text-body hover:bg-surface-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
          >
            {sectionTitle}
          </button>
        ))}
      </nav>

      {sections.map(({ id, title: sectionTitle, tone = 'default', content }) => (
        <section
          key={id}
          id={sectionId(id)}
          aria-labelledby={`${sectionId(id)}-title`}
          className={`scroll-mt-24 space-y-2 p-4 sm:p-6 ${
            tone === 'warning' ? 'rounded-2xl border border-warning-200 bg-warning-50' : 'panel'
          }`}
        >
          <h2 id={`${sectionId(id)}-title`} className={`card-title ${tone === 'warning' ? 'text-warning-900' : ''}`}>
            {sectionTitle}
          </h2>
          {content}
        </section>
      ))}
    </div>
  );
}
