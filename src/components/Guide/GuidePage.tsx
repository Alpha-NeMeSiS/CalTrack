// Page « Guide » : le fonctionnement de CalTrack pas à pas (pense-bêtes courts).
// Accessible connecté (avec « Revoir la visite ») ou depuis l'écran de connexion.
import { PlayCircle } from 'lucide-react';
import type { GuideSection } from '../../utils/navigation';
import { Button } from '../ui/Button';
import { InfoPage, InfoSectionDef } from '../Info/InfoPage';

interface GuidePageProps {
  section?: GuideSection;
  scrollKey?: number;
  signedIn: boolean;
  /** Écran de connexion : retour au formulaire */
  onBack?: () => void;
  /** Relance la visite guidée sur le journal (connecté) */
  onReplayTour?: () => void;
}

const text = 'text-sm text-body';
const list = 'space-y-1 pl-5 text-sm text-body';

const SECTIONS: InfoSectionDef<GuideSection>[] = [
  {
    id: 'start',
    title: 'Premiers pas',
    content: (
      <ol className={`list-decimal ${list}`}>
        <li>Votre profil et votre objectif sont créés à l’inscription.</li>
        <li>Notez vos repas au fil de la journée.</li>
        <li>Pesez-vous une à deux fois par semaine.</li>
        <li>Après une semaine, regardez vos tendances.</li>
      </ol>
    ),
  },
  {
    id: 'meals',
    title: 'Noter un repas',
    content: (
      <>
        <ol className={`list-decimal ${list}`}>
          <li>Touchez + (ou « Ajouter » sur ordinateur).</li>
          <li>
            Onglet Recherche : aliments génériques et produits du commerce, bouton pour scanner un code-barres ; vos
            favoris (★) et vos aliments récents s’affichent en haut. Autres onglets : Saisie manuelle, Mes aliments,
            Recettes.
          </li>
          <li>Choisissez la quantité et le repas.</li>
        </ol>
        <p className={text}>
          Dans le journal, « Modifier » et « Supprimer » corrigent une ligne ; « Copier les repas de la veille » reprend
          la journée d’hier.
        </p>
        <p className={text}>
          Un produit scanné n’a pas de valeurs ? CalTrack propose une estimation d’après des produits proches :
          vérifiez-la avec l’étiquette.
        </p>
      </>
    ),
  },
  {
    id: 'water',
    title: 'Eau',
    content: (
      <p className={text}>
        « + 250 ml » pour un verre, « + 500 ml » pour une bouteille, « Autre… » pour une quantité libre, « Annuler le
        dernier » en cas d’erreur. L’objectif suit votre poids (30 ml par kg) ; vous pouvez le fixer dans Paramètres.
      </p>
    ),
  },
  {
    id: 'weight',
    title: 'Pesée et composition',
    content: (
      <p className={text}>
        Notez votre poids dans « Ma pesée », de préférence le matin. Avec une balance impédancemètre, ajoutez la
        composition (masse grasse, muscles…) dans « Composition (facultatif) ». Les courbes sont dans Tendances.
      </p>
    ),
  },
  {
    id: 'goal',
    title: 'Objectif et calories',
    content: (
      <p className={text}>
        Votre cible du jour part de votre métabolisme de base et de votre activité, puis retire ou ajoute un
        pourcentage selon votre objectif (perte, maintien, prise). Après au moins deux semaines de repas notés et trois
        pesées, CalTrack peut proposer d’ajuster vos calories d’après votre dépense réelle : vous acceptez ou non. À la
        date de fin, vos journées passent en maintien.
      </p>
    ),
  },
  {
    id: 'trends',
    title: 'Tendances',
    content: (
      <p className={text}>
        Les 7 derniers jours (calories et protéines moyennes, régularité, série en cours, eau), le graphique des
        calories, l’évolution du poids et de la composition, et l’historique détaillé des 30 derniers jours.
      </p>
    ),
  },
  {
    id: 'settings',
    title: 'Réglages et compte',
    content: (
      <ul className={`list-disc ${list}`}>
        <li>« Mon profil » : identité, photo, email, mot de passe, données corporelles.</li>
        <li>
          « Paramètres » : thème, affichage des calories et des macros, noms des repas, rappels, objectif d’eau.
        </li>
        <li>« Compte et sécurité » : export de vos données, déconnexion de tous les appareils, suppression du compte.</li>
      </ul>
    ),
  },
  {
    id: 'install',
    title: 'Installer l’app sur le téléphone',
    content: (
      <ul className={`list-disc ${list}`}>
        <li>iPhone : dans Safari, Partager → « Sur l’écran d’accueil ».</li>
        <li>Android : dans Chrome, menu ⋮ → « Installer l’application ».</li>
        <li>Sur iPhone, les rappels ne fonctionnent qu’une fois l’app installée.</li>
      </ul>
    ),
  },
];

export function GuidePage({ section, scrollKey, signedIn, onBack, onReplayTour }: GuidePageProps) {
  return (
    <InfoPage
      title="Guide"
      intro="Les bases de CalTrack en quelques minutes."
      idPrefix="guide"
      sections={SECTIONS}
      section={section}
      scrollKey={scrollKey}
      onBack={onBack}
      actions={
        signedIn && onReplayTour ? (
          <Button variant="secondary" size="sm" onClick={onReplayTour}>
            <PlayCircle className="h-4 w-4" aria-hidden="true" />
            Revoir la visite
          </Button>
        ) : undefined
      }
    />
  );
}
