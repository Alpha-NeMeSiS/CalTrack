// Page « À propos » : présentation, avertissement santé, données enregistrées
// et sources (attribution exigée par les licences Ciqual et Open Food Facts).
// Accessible connecté ou depuis l'écran de connexion.
import { ReactNode } from 'react';
import { ExternalLink } from 'lucide-react';
import { APP_VERSION } from '../../utils/appInfo';
import type { AboutSection } from '../../utils/navigation';
import { Button } from '../ui/Button';
import { InfoPage, InfoSectionDef } from '../Info/InfoPage';

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
  const sections: InfoSectionDef<AboutSection>[] = [
    {
      id: 'app',
      title: 'CalTrack',
      content: (
        <>
          <p className="text-sm text-body">Suivi calorique personnalisé : journal, objectifs, pesées, eau et recettes.</p>
          <p className="text-xs text-subtle">Version {APP_VERSION} · projet personnel</p>
        </>
      ),
    },
    {
      id: 'health',
      title: 'Santé',
      tone: 'warning',
      content: (
        <p className="text-sm text-warning-900">
          Les calories, besoins et objectifs sont des <strong>estimations</strong>. CalTrack n’est pas un dispositif médical
          et ne remplace pas l’avis d’un médecin ou d’un diététicien, en particulier pendant une grossesse, en cas de trouble
          du comportement alimentaire ou de maladie.
        </p>
      ),
    },
    {
      id: 'data',
      title: 'Vos données',
      content: (
        <>
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
        </>
      ),
    },
    {
      id: 'sources',
      title: 'Sources',
      content: (
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
      ),
    },
  ];

  return (
    <InfoPage title="À propos" idPrefix="about" sections={sections} section={section} scrollKey={scrollKey} onBack={onBack} />
  );
}
