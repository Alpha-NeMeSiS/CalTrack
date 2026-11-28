// Notes de version affichées dans la fenêtre « Quoi de neuf ? », écrites pour
// l'utilisateur (sans jargon). La plus récente en premier ; un test vérifie que
// la version de package.json y figure. Le CHANGELOG reste le document technique.

export interface ReleaseNote {
  /** MAJEUR.MINEUR.CORRECTIF */
  version: string;
  /** Date de mise en ligne, AAAA-MM-JJ */
  date: string;
  /** 1 à 5 phrases courtes */
  items: string[];
}

export const RELEASES: readonly ReleaseNote[] = [
  {
    version: '2.4.0',
    date: '2026-11-28',
    items: [
      'Pesée du matin : dans « Ma pesée », indiquez si vous vous pesez le matin à jeun ou plus tard dans la journée. Seule la pesée du matin, la plus fiable, sert à votre suivi (poids du profil, besoins, objectif, courbe).',
      'Une pesée du soir reste visible sur la courbe (point creux) sans fausser votre tendance, et ne remplace jamais la pesée du matin du même jour.',
      'Une ancienne pesée faite le soir ? Revenez sur ce jour dans le journal, choisissez « Plus tard dans la journée » puis « Mettre à jour ».',
    ],
  },
  {
    version: '2.3.0',
    date: '2026-11-28',
    items: [
      'Nouveau bouton « Détail » sous vos macros : voyez ce que chaque repas vous a apporté (calories, part de la journée, protéines, lipides, glucides, fibres).',
      'Le journal du jour garde une taille raisonnable : une longue journée défile dans sa propre zone, la pesée reste à portée de main.',
      'Touchez le logo CalTrack, en haut, pour revenir au journal du jour depuis n’importe où.',
    ],
  },
  {
    version: '2.2.3',
    date: '2026-11-28',
    items: [
      'Votre objectif calorique ne descend plus jamais sous le seuil de sécurité, quel que soit le type d’objectif.',
      'Votre photo de profil n’est plus visible que par vous.',
      'Au clavier, la fenêtre d’ajout d’aliment garde le focus, et il revient au bon endroit quand on la ferme.',
      'L’application s’ouvre plus vite, et une erreur affiche un message avec un bouton pour recharger au lieu d’une page blanche.',
    ],
  },
  {
    version: '2.2.2',
    date: '2026-11-27',
    items: [
      'Recherche de produits par nom : les produits du supermarché sont de nouveau trouvés, avec leurs valeurs.',
      'Vous pouvez chercher avec la marque (« jus multifruits Paquito ») et avec les petits mots (« jus de pomme »).',
      'Un produit affiché « Valeurs chargées au choix » se choisit normalement : ses valeurs sont chargées à ce moment-là, comme après un scan.',
    ],
  },
  {
    version: '2.2.1',
    date: '2026-11-23',
    items: [
      'Boissons : la portion du fabricant en ml ou en cl est maintenant proposée, par exemple « 1 portion (200 ml) ».',
      'Scanner et recherche : CalTrack réessaie tout seul quand Open Food Facts ne répond pas du premier coup.',
    ],
  },
  {
    version: '2.2.0',
    date: '2026-11-22',
    items: [
      'Produit scanné sans valeurs : CalTrack propose une estimation d’après les produits les plus proches, à vérifier avec l’étiquette.',
      'Les aliments enregistrés avec des valeurs estimées portent le badge « Estimé ».',
    ],
  },
  {
    version: '2.1.1',
    date: '2026-11-22',
    items: [
      'Supprimer une ligne du journal se confirme maintenant directement dans la ligne.',
      'Notifications de rappel : le logo CalTrack s’affiche correctement sur Android.',
    ],
  },
  {
    version: '2.1.0',
    date: '2026-11-22',
    items: [
      'Visite guidée : 5 bulles pour découvrir le journal, à relancer quand vous voulez depuis le Guide.',
      'Nouvelle page « Guide » : le fonctionnement de l’app, pas à pas.',
      'Cette fenêtre vous présente maintenant chaque mise à jour.',
    ],
  },
  {
    version: '2.0.0',
    date: '2026-11-22',
    items: [
      'Nouveau look : couleur verte, nouvelle police et thème sombre.',
      'Scanner de code-barres pour retrouver un produit en un instant.',
      'Favoris, récents, « Mes aliments » et recettes maison en parts.',
      'Suivi de l’eau, des pesées et de la composition corporelle.',
      'Ajout de plusieurs aliments à la suite, rappels et application installable.',
    ],
  },
];
