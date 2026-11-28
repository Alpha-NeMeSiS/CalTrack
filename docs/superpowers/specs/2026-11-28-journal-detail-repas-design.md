# Tableau de bord : logo cliquable, journal défilant, détail par repas

> Spec courte, validée par l'utilisateur le 28/11/2026 (« c'est bon, code »).
> Version visée : **2.3.0** (nouvelle fonctionnalité).

## Pourquoi

- **Logo** : en haut à gauche, le logo et le nom « CalTrack » ne mènent nulle
  part. L'utilisateur s'attend à revenir au tableau de bord en cliquant dessus.
- **Journal** : une journée chargée allonge la page sans fin. La pesée et la
  progression de l'objectif, placées dessous, se retrouvent tout en bas.
- **Détail** : l'utilisateur veut voir, repas par repas, « ce que tel repas m'a
  apporté » en calories et en macros. Aujourd'hui, le journal ne donne que les
  kcal par repas, et le bloc du haut seulement les totaux de la journée.

## Ce qui change

### 1. Logo cliquable

- Le logo et le nom deviennent un seul bouton, nommé « CalTrack, retour au
  tableau de bord » pour les lecteurs d'écran.
- Un clic affiche le tableau de bord **sur la date du jour** (comme un bouton
  « Accueil »), quelle que soit la vue ou la date affichée avant.

### 2. Journal du jour défilant

- La liste des aliments a une **hauteur maximale d'environ 60 % de l'écran** et
  sa propre barre de défilement. Une journée courte ne change pas d'aspect.
- L'en-tête du journal (titre, « Copier les repas de la veille ») et le message
  de confirmation restent **hors** de la zone qui défile.
- Même motif que l'historique de 30 jours (Tendances) : zone `role="region"`
  nommée par le titre, atteignable au clavier (`tabIndex={0}`), anneau de focus.
- Hauteur relative (vh) plutôt que fixe : sur téléphone, la page autour reste
  facile à faire défiler.

### 3. Bouton « Détail » et fenêtre « Détail par repas »

- Bouton « Détail » dans le bloc calories + macros, **seulement s'il y a au
  moins un aliment** dans la journée affichée.
- Il ouvre une fenêtre centrée (même modèle que « Ajouter un aliment » et
  « Quoi de neuf ? », avec `useModalFocus` : piège de focus, Échap, retour du
  focus au bouton, page figée).
- Contenu : un tableau, une ligne par repas **qui a des aliments**, dans l'ordre
  habituel, avec les **noms de repas personnalisés** :

  ```text
  ┌ Détail par repas ─────────────────────────────── ✕ ┐
  │ samedi 28 novembre                              │
  │                  kcal       Prot.  Lip.  Gluc. Fib.│
  │ Petit-déjeuner    420 (21%)  18 g  12 g  58 g  6 g │
  │ Déjeuner          780 (38%)  42 g  28 g  85 g  9 g │
  │ Dîner             650 (32%)  35 g  22 g  70 g  7 g │
  │ Collation         180  (9%)   4 g   9 g  20 g  2 g │
  │ ───────────────────────────────────────────────── │
  │ Total            2030        99 g  71 g 233 g 24 g │
  └───────────────────────────────────────────────────┘
  ```

  - kcal arrondies à l'unité, avec la **part des kcal de la journée** en % ;
  - grammes arrondis à l'unité ;
  - en-têtes abrégés (Prot., Lip., Gluc., Fib.) pour tenir sur téléphone, avec
    le nom complet pour les lecteurs d'écran ;
  - **pas de ligne « Objectif »** : l'anneau et les cartes l'affichent déjà.

## Non-objectifs

- Aucun changement de base de données ni de service : tout se calcule à partir
  des entrées déjà chargées par le tableau de bord.
- Pas de volet latéral ni de tableau déplié dans la page (écartés, voir plus bas).
- Pas de repas repliables dans le journal.

## Approches envisagées

| Partie | Retenue | Écartées |
| --- | --- | --- |
| Détail | **Fenêtre centrée** : modèle déjà présent, accessibilité partagée (`useModalFocus`), le moins de code nouveau | Volet latéral (nouveau type d'élément, variante mobile à créer, aucun gain pour un tableau qu'on lit puis ferme) ; tableau déplié sous les macros (rallonge la page, l'inverse du but) |
| Journal | **Hauteur max + barre de défilement** (demandé) | Repas repliables (des clics en plus pour revoir ses aliments) |

L'utilisateur a laissé le choix de la forme du détail (« volet ou pop-up comme
tu veux ») ; la fenêtre centrée est un choix de l'implémenteur.

## Laissé à l'implémentation

- Calcul pur et testé (`entries.ts`) : totaux par repas, part des kcal, total.
  Une part de 0 kcal sur une journée à 0 kcal ne doit pas diviser par zéro.
- Retour à la date du jour depuis le logo : à brancher dans `App.tsx`, qui
  détient la date du tableau de bord.
