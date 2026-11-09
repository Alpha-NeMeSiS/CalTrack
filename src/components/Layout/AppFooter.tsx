// Pied de page : version de l'app et accès à la page « À propos » (sections).
import { APP_VERSION } from '../../utils/appInfo';
import type { AboutSection } from '../../utils/navigation';

interface AppFooterProps {
  onOpen: (section: AboutSection) => void;
  /** Ligne d'attribution des sources nutritionnelles (app connectée) */
  showAttribution?: boolean;
}

const LINKS: { section: AboutSection; label: string }[] = [
  { section: 'app', label: 'À propos' },
  { section: 'data', label: 'Vos données' },
  { section: 'sources', label: 'Sources' },
];

export function AppFooter({ onOpen, showAttribution = false }: AppFooterProps) {
  return (
    <footer className="mt-10 pb-2 text-center text-xs text-subtle">
      <nav aria-label="Informations sur l’application" className="flex flex-wrap items-center justify-center gap-x-1 gap-y-1">
        <span>CalTrack v{APP_VERSION}</span>
        {LINKS.map(({ section, label }) => (
          <span key={section} className="flex items-center gap-x-1">
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={() => onOpen(section)}
              className="rounded text-primary-700 underline underline-offset-2 hover:text-primary-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
            >
              {label}
            </button>
          </span>
        ))}
      </nav>
      {showAttribution && <p className="mt-1">Données nutritionnelles : Ciqual (ANSES), Open Food Facts (ODbL)</p>}
    </footer>
  );
}
