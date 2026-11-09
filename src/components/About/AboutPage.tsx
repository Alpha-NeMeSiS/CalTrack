// Page « À propos » : présentation, avertissement santé, données enregistrées
// et sources (attribution exigée par les licences Ciqual et Open Food Facts).
// Accessible connecté ou depuis l'écran de connexion.
import { ReactNode, useEffect } from 'react';
import { ChevronLeft, ExternalLink } from 'lucide-react';
import { APP_VERSION } from '../../utils/appInfo';
import type { AboutSection } from '../../utils/navigation';
import { Button } from '../ui/Button';

interface AboutPageProps {
  /** Section vers laquelle défiler */
  section?: AboutSection;
  /** Change à chaque demande d'ouverture : relance le défilement vers la même section */
  scrollKey?: number;
  signedIn: boolean;
  /** Écran de connexion : retour au formulaire */
  onBack?: () => void;
  /** Ouvre la page Compte et sécurité (export, suppression) */
  onOpenAccount?: () => void;
}

const SECTION_TITLES: Record<AboutSection, string> = {
  app: 'CalTrack',
  health: 'Santé',
  data: 'Vos données',
  sources: 'Sources',
};

const sectionId = (section: AboutSection) => `about-${section}`;

function Section({ id, title, children, tone = 'default' }: { id: AboutSection; title: string; children: ReactNode; tone?: 'default' | 'warning' }) {
  return (
    <section
      id={sectionId(id)}
      aria-labelledby={`${sectionId(id)}-title`}
      className={`scroll-mt-24 space-y-2 p-4 sm:p-6 ${
        tone === 'warning' ? 'rounded-2xl border border-warning-200 bg-warning-50' : 'panel'
      }`}
    >
      <h2 id={`${sectionId(id)}-title`} className={`card-title ${tone === 'warning' ? 'text-warning-900' : ''}`}>
        {title}
      </h2>
      {children}
    </section>
  );
}

function ExternalSource({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 font-medium text-primary-700 underline underline-offset-2 hover:text-primary-800"
    >
      {children}
      <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
      <span className="sr-only">(nouvel onglet)</span>
    </a>
  );
}

export function AboutPage({ section, scrollKey, signedIn, onBack, onOpenAccount }: AboutPageProps) {
  // Défile jusqu'à la section demandée, y compris quand elle change sur la page
  useEffect(() => {
    if (!section) return;
    document.getElementById(sectionId(section))?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  }, [section, scrollKey]);

  const jumpTo = (target: AboutSection) =>
    document.getElementById(sectionId(target))?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {onBack && (
        <Button variant="ghost" size="sm" className="-ml-2 text-primary-700" onClick={onBack}>
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          Retour à la connexion
        </Button>
      )}
      <h1 className="page-title">À propos</h1>

      <nav aria-label="Sections de la page" className="flex flex-wrap gap-2">
        {(Object.keys(SECTION_TITLES) as AboutSection[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => jumpTo(key)}
            className="rounded-full bg-surface-sunken px-3 py-1.5 text-xs font-medium text-body hover:bg-surface-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
          >
            {SECTION_TITLES[key]}
          </button>
        ))}
      </nav>

      <Section id="app" title={SECTION_TITLES.app}>
        <p className="text-sm text-body">Suivi calorique personnalisé : journal, objectifs, pesées, eau et recettes.</p>
        <p className="text-xs text-subtle">Version {APP_VERSION} · projet personnel</p>
      </Section>

      <Section id="health" title={SECTION_TITLES.health} tone="warning">
        <p className="text-sm text-warning-900">
          Les calories, besoins et objectifs sont des <strong>estimations</strong>. CalTrack n’est pas un dispositif médical
          et ne remplace pas l’avis d’un médecin ou d’un diététicien, en particulier pendant une grossesse, en cas de trouble
          du comportement alimentaire ou de maladie.
        </p>
      </Section>

      <Section id="data" title={SECTION_TITLES.data}>
        <ul className="list-disc space-y-1 pl-5 text-sm text-body">
          <li>
            <strong>Ce qui est enregistré</strong> : compte (email, nom), profil (âge, taille, poids, composition corporelle),
            journal, pesées, eau, recettes, favoris, préférences et abonnements aux notifications.
          </li>
          <li>
            <strong>Où</strong> : chez Supabase, sur des serveurs à Paris (Union européenne). Le site est servi par Netlify.
          </li>
          <li>
            <strong>Qui y a accès</strong> : vous seul. Ni publicité, ni pistage, ni revente.
          </li>
          <li>
            <strong>Combien de temps</strong> : jusqu’à la suppression de votre compte.
          </li>
        </ul>
        {signedIn && onOpenAccount && (
          <div className="flex flex-wrap gap-2 pt-1">
            <Button variant="secondary" size="sm" onClick={onOpenAccount}>
              Télécharger mes données
            </Button>
            <Button variant="secondary" size="sm" onClick={onOpenAccount}>
              Supprimer mon compte
            </Button>
          </div>
        )}
      </Section>

      <Section id="sources" title={SECTION_TITLES.sources}>
        <ul className="list-disc space-y-1 pl-5 text-sm text-body">
          <li>
            <strong>Aliments génériques</strong> : <ExternalSource href="https://ciqual.anses.fr">table Ciqual de l’ANSES</ExternalSource>,
            sous Licence Ouverte 2.0.
          </li>
          <li>
            <strong>Produits du supermarché</strong> : <ExternalSource href="https://world.openfoodfacts.org">Open Food Facts</ExternalSource>,
            base collaborative sous licence ODbL ; des erreurs sont possibles.
          </li>
          <li>
            <strong>Calculs</strong> : métabolisme de base Mifflin-St Jeor (ou Katch-McArdle avec la masse grasse), eau 30 ml
            par kg.
          </li>
        </ul>
      </Section>
    </div>
  );
}
