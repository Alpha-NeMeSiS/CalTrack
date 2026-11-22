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
