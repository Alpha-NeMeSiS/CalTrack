# UI phase 2 : nouveau look — spec

Date : 8 novembre 2026 · Statut : à valider

## Contexte et objectif

La phase 1 a normalisé les fondations : couleurs nommées par rôle (`theme.palette.js`), composants de base (`src/components/ui/`), contrastes WCAG AA et garde-fous (tests de jetons, test de contraste de la palette, contrôle axe dans la CI). Le look, lui, n'a pas changé : titres en police BD, boutons bleus et verts mélangés, cartes de styles différents.

Objectif de la phase 2 : une interface **moderne, lisible et cohérente**, agréable au quotidien sur téléphone, avec une **touche personnelle** (le logo). Les fonctionnalités, la mise en page et les textes ne changent pas.

### Décisions prises avec l'utilisateur

| Sujet | Décision |
| --- | --- |
| Personnalité | « Moderne + touche perso » : Inter partout, Bangers seulement pour le logo « CALTRACK » |
| Direction visuelle | Mix des maquettes : fond et macros de la direction A (« Frais »), journal du jour et barre du bas de la direction B (« Coloré ») |
| Couleur « en cours » | Vert de la marque (anneau, pastille, ligne et barre du jour) |
| Mise en œuvre | Approche 1 : palette et styles partagés, plus des retouches ciblées des composants |

## Système visuel

### Couleurs

| Rôle | Usage | Changement |
| --- | --- | --- |
| `primary` = vert de la marque (`brand`) | Actions : boutons principaux, liens, onglets actifs dans les fenêtres, focus | Était le bleu. `ROLE_SCALES.primary` passe de `blue` à `brand` |
| `accent` (orange) | Onglet actif des barres de navigation, intitulés de section | Ne sert plus aux titres de carte |
| `info` (bleu) | Messages et états d'information (bannières, carte d'ajustement, barre de temps de l'objectif) | Plus utilisé pour « en cours » |
| `success`, `warning`, `danger`, `orange` | États et données | Inchangés |
| `canvas` (nouveau) | Fond des pages | Clair : `#f3f6f5` (gris-vert très léger) ; sombre : même valeur que `surface-muted` |

Règles de nuance (contraste AA vérifié par le test de palette) :

- texte blanc sur vert : `primary-700` au minimum (survol `primary-800`) ; le vert du logo (`500`) est trop clair ;
- liens et texte vert sur fond clair : `primary-700` ;
- éléments graphiques verts (anneau de focus, courbes, anneau des calories) : `600` au minimum (3:1) ;
- bouton désactivé : `primary-300`.

### Typographie

- `h1`–`h4` : police Inter (plus de Bangers, plus d'espacement de lettres ni de couleur imposée par la base CSS).
- Logo « CALTRACK » (en-tête, écrans de connexion) : classe `font-display` (Bangers, `accent-700`) ; c'est le seul usage de Bangers.
- Nouvelles classes dans `src/index.css` :

| Classe | Style | Où |
| --- | --- | --- |
| `page-title` | `text-2xl font-bold text-ink` | Titres de page (`h1` : Mon profil, Paramètres, Objectif, Compte et sécurité) et titres des formulaires de connexion et d'accueil |
| `card-title` | `text-xl font-bold text-brand-800` | Titres de carte (`h2` : Journal du jour, Ma pesée, Tendances et historique, Ajouter un aliment, sections du profil, des paramètres, de l'objectif et du compte ; titre de la carte objectif) |
| `section-label` | `text-sm font-bold uppercase tracking-wide text-accent-700` | Intitulés de section dans une carte (`h3` : noms des repas, « Graphique des calories », « Évolution du poids », « Historique détaillé »…) |

Exceptions conservées : les titres des encadrés colorés gardent la couleur de leur état (encadré d'avertissement, d'information, de suppression du compte), et les intitulés « Récents » / « Favoris » de l'ajout d'aliment restent gris.

### Surfaces et formes

- **Fond de page** : `bg-canvas` (remplace le dégradé du `body` et les `bg-surface-muted` des conteneurs de page).
- **Cartes** : `panel` = `rounded-2xl bg-surface border border-line-subtle shadow-card`, avec `shadow-card` = `0 1px 2px rgb(16 24 40 / .04), 0 2px 8px rgb(16 24 40 / .05)` (thème Tailwind). Toutes les cartes passent par `panel` ; la classe `card-glass` et les variables `--glass-*` disparaissent.
- **Macros** (`MacroCard`) : sans bordure, `bg-surface-muted rounded-xl`.
- **Carte objectif** (`GoalProgressCard`) : perd son dégradé bleu et devient un `panel` ; son contenu garde ses couleurs (barre de poids verte, barre de temps bleue « info »).
- **Champ de date du journal** : `rounded-xl`.

### Navigation

- **En-tête** : plat, `bg-surface border-b border-line`, sans ombre ni flou.
- **Onglets du haut** (ordinateur) : plats comme l'en-tête ; onglet actif orange (inchangé).
- **Barre du bas** (mobile) : inchangée, onglet actif orange (`accent-700`).
- **Onglets des fenêtres** (Recherche / Saisie manuelle / Mes aliments) : actif en vert, via `primary`.

### États « en cours »

| Élément | Avant | Après |
| --- | --- | --- |
| Anneau des calories | `stroke-info-600` | `stroke-brand-600` |
| Pastille « En cours » | `bg-info-50 text-info-700` | `bg-brand-50 text-brand-700` |
| Ligne du jour (tendances) | `bg-info-50 text-info-700` | `bg-brand-50 text-brand-700` |
| Barre du jour et légende (graphique) | `bg-info-400` | `bg-brand-300 ring-1 ring-inset ring-brand-600` (vert pâle à contour foncé, distinct du vert plein « à l'objectif ») |

### Boutons et focus

- `btn-primary` : `bg-primary-700 hover:bg-primary-800 disabled:bg-primary-300`.
- `btn-brand` : mêmes couleurs que `btn-primary`, garde sa forme de pilule.
- Anneaux de focus : `ring-primary-500` et `ring-brand-500` deviennent `ring-primary-600` et `ring-brand-600`.
- Liens `text-primary-600` : deviennent `text-primary-700`.
- Courbe « moyenne 7 jours » du poids et sa légende : `brand-500` devient `brand-600`.

## Hors périmètre

- Mise en page, textes, parcours et fonctionnalités.
- Migration de tous les écrans vers les composants `Card` / `Button` : ils seront adoptés au fil des prochaines fonctionnalités (recettes, eau, copie de repas).
- Icônes, logo, manifeste de l'app et couleur de la barre d'état (`theme-color`).
- Refonte des graphiques au-delà de la couleur « en cours » et de la courbe de moyenne.

## Mise en œuvre

1. **Palette** (`theme.palette.js`) : `primary` sur `brand`, nouveau rôle `canvas`.
2. **Thème Tailwind** : ombre `shadow-card`.
3. **Styles communs** (`src/index.css`) : base des titres, `page-title`, `card-title`, `section-label`, nouveau `panel`, boutons, suppression de `card-glass`, fond `canvas`.
4. **Composants** : en-tête, onglets du haut, conteneurs de page (`App.tsx`), cartes du tableau de bord et de la pesée (`card-glass` → `panel`), `MacroCard`, `GoalProgressCard`, `CalorieRing`, `WeeklyTrends`, `dayStatus.ts`, `WeightChart`, logo en `font-display`, titres des écrans (classes ci-dessus).
5. **Remplacements mécaniques** : anneaux de focus `500` → `600`, liens `text-primary-600` → `text-primary-700`.
6. **Documentation** : `docs/design-system.md` (rôle `canvas`, `primary` vert, classes de titre, règles de nuance, « en cours » en vert).

## Vérifications

- **Test de contraste de la palette** (`src/test/paletteContrast.test.ts`), en clair et en sombre, avec les nouvelles paires :
  - texte : blanc sur `primary-700` et `primary-800` ; `primary-700` sur `surface` et `canvas` ; `brand-800` sur `surface` ; `brand-700` sur `brand-50` ; `ink`, `body`, `muted` et `subtle` sur `canvas` ;
  - graphique (3:1) : `primary-600` et `brand-600` sur `surface`.
- **Garde-fou des jetons** (`src/test/designTokens.test.ts`) : refuse aussi `card-glass`, `ring-primary-500`, `ring-brand-500`, `text-primary-600`, et la police Bangers ailleurs que dans le logo.
- **Tests existants** mis à jour quand ils vérifient une classe (statuts de journée, anneau des calories).
- **Contrôle axe** (`npm run test:a11y`) : les 32 contrôles restent verts (8 écrans, mobile et ordinateur, clair et sombre).
- **Captures avant/après** des 40 écrans, envoyées à l'utilisateur, et vérification sur ordinateur (en-tête, onglets du haut).
- Lint, types, Vitest, tests de la base et build.

## Critères d'acceptation

- Plus aucune police Bangers hors du logo ; plus aucun bouton ni lien bleu.
- Fond teinté, cartes uniformes (arrondi, liseré, ombre douce), en-tête plat, en clair et en sombre.
- Titres de carte en vert foncé, intitulés de section en petites majuscules orange, onglet actif de la barre du bas en orange.
- « En cours » en vert partout ; « à l'objectif » reste distinct (vert plein).
- Tous les garde-fous et tests verts, aucune régression d'accessibilité.
