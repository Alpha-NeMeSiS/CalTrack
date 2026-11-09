# Visite guidée et page « Guide » — spec

Date : 9 novembre 2026 · Statut : à valider

## Objectif

Qu'un nouvel arrivant comprenne CalTrack sans qu'on le lui explique. Il doit savoir noter un repas, de l'eau et une pesée, et savoir où trouver les tendances et les réglages. Aujourd'hui, après l'inscription et le formulaire d'accueil (2 étapes), il arrive sur le journal sans aucune explication.

### Décisions prises avec l'utilisateur

| Sujet | Décision |
| --- | --- |
| Forme | Courte visite guidée (5 bulles) au premier passage sur le journal, plus une page « Guide » à relire quand on veut |
| Mémorisation | Par compte, dans la base : une seule fois, même sur un autre appareil. Les comptes existants la voient aussi une fois |
| Approche | Visite maison (aucune dépendance), dans le style de l'app et contrôlée par axe |
| Accès au Guide | Pied de page (aussi sur l'écran de connexion) et menu de l'avatar ; « Revoir la visite » sur la page, une fois connecté |

## Visite guidée

### Étapes (`src/utils/tour.ts`)

`TOUR_STEPS: TourStep[]`, avec `TourStep = { id: TourTarget; title: string; body: string }` et `type TourTarget = 'calories' | 'add' | 'water' | 'weight' | 'nav'`. La cible d'une étape est l'élément visible portant `data-tour="<id>"`.

| # | `id` | Élément ciblé | Titre | Texte |
| --- | --- | --- | --- | --- |
| 1 | `calories` | Anneau des calories | Votre journée en un coup d’œil | L’anneau compare les calories mangées à votre objectif du jour. Juste dessous : protéines, lipides, glucides et fibres. Tout se met à jour à chaque aliment noté. |
| 2 | `add` | Bouton flottant « + » (mobile) ou bouton « Ajouter » (ordinateur) | Noter ce que vous mangez | Touchez + pour chercher un aliment, scanner un code-barres, ou reprendre un favori ou une recette. Choisissez ensuite la quantité et le repas. |
| 3 | `water` | Carte « Eau » | Votre eau | Un verre : + 250 ml. Une bouteille : + 500 ml. L’objectif est calculé d’après votre poids ; vous pouvez le changer dans Paramètres. |
| 4 | `weight` | Carte « Ma pesée » | Votre pesée | Notez votre poids ici, de préférence le matin. Vos pesées font avancer l’objectif et servent à ajuster vos calories. |
| 5 | `nav` | Barre d'onglets (en bas sur mobile, en haut sur ordinateur) | Aller plus loin | Tendances : vos moyennes et votre historique. Objectif : votre progression. Profil, Paramètres et ce guide sont dans le menu de votre avatar, en haut à droite. |

Le compteur « Étape N sur M » compte uniquement les étapes dont la cible est présente : une étape sans cible est sautée (par exemple la carte « Ma pesée » absente).

### Placement (`placeBubble`, fonction pure de `src/utils/tour.ts`)

`placeBubble(target: Rect, bubbleHeight: number, viewport: { width: number; height: number }, opts: { bottomInset: number }): BubblePlacement`

- Résultat : `{ top?: number; bottom?: number; left: number; width: number }` (en px, position `fixed`).
- **Largeur** : sous 640 px de large (mobile), la bulle prend toute la largeur moins 16 px de marge de chaque côté. Au-delà, elle fait 360 px, alignée sur le bord gauche de la cible, et reste à au moins 16 px des bords de l'écran.
- **Position verticale**, première règle qui convient :
  1. dessous, si la place sous la cible suffit (hauteur de la bulle + 12 px d'écart + 16 px de marge) ;
  2. au-dessus, si la place au-dessus de la cible suffit ;
  3. sinon en bas de l'écran, à `bottomInset` du bord : 88 px sur mobile (au-dessus de la barre d'onglets), 16 px sur ordinateur.
- Découpe : rectangle de la cible agrandi de 6 px, coins arrondis de 18 px.

### Composant (`src/components/Tour/GuidedTour.tsx`)

`GuidedTour({ steps: TourStep[]; onFinish: (reason: 'done' | 'skipped') => void })`

- **Défilement** : au début de chaque étape, la cible dans le flux de la page défile pour placer son haut à 120 px du haut de l'écran (sous l'en-tête). Les cibles fixes (bouton « + », barre d'onglets) ne font pas défiler la page. Le défilement est animé, sauf si l'appareil demande moins d'animations (`prefers-reduced-motion`).
- **Rendu** :
  - une couche transparente plein écran qui bloque les clics sur la page ;
  - la découpe, avec une ombre très large qui assombrit le reste de l'écran et un contour de 2 px dans la couleur primaire (visible en clair comme en sombre) ;
  - la bulle (`panel`).
- **Bulle** :
  - `role="dialog"`, `aria-modal="true"`, `aria-labelledby` sur le titre et `aria-describedby` sur le texte ;
  - « Étape N sur M » (`section-label`), titre (`card-title`), texte (`text-sm text-body`) ;
  - boutons : « Passer » (discret, à gauche), « Précédent » (à partir de l'étape 2), puis « Suivant », remplacé par « Terminer » à la dernière étape.
- **Clavier** :
  - le focus va sur « Suivant » (ou « Terminer ») à chaque étape ;
  - Tab reste dans la bulle ;
  - Échap = « Passer ».
- **Fin** :
  - « Passer » et Échap appellent `onFinish('skipped')`, « Terminer » appelle `onFinish('done')` ;
  - le focus revient sur le corps de la page ;
  - si aucune étape n'a de cible, `onFinish('skipped')` est appelé sans rien afficher.
- **Recalcul** : la position est recalculée au redimensionnement, à la rotation de l'écran et au défilement.

### Démarrage et mémorisation

- **Base** : migration `tour_completed_at timestamptz` (nullable, vide = visite pas encore vue) dans `user_preferences`.
  - Les règles RLS de la table s'appliquent telles quelles.
  - L'export RGPD l'inclut déjà (ligne de préférences complète).
- **Préférences** :
  - `UserPreferences` gagne `tourCompletedAt: string | null` (défaut `null`), lu et écrit par `preferencesFromRow` et `preferencesToRow` ;
  - le contexte expose `status: 'loading' | 'ready' | 'error'`. `ready` une fois la lecture terminée, qu'une ligne existe ou non ; `error` si elle échoue ;
  - le contexte expose aussi `markTourCompleted(): Promise<void>`.
- **Service** : `markTourCompleted(userId)` (`src/services/preferences.ts`) n'écrit que `{ user_id, tour_completed_at: now }`. L'écriture se fait en upsert sur `user_id` : les autres préférences ne bougent pas, et les valeurs par défaut de la table s'appliquent si la ligne n'existait pas.
- **`App.tsx`** :
  - état `tourRequest: 'auto' | 'manual' | null` ;
  - `'auto'` quand l'utilisateur est connecté avec un profil, `status === 'ready'` et `tourCompletedAt === null` ; jamais quand `status` vaut `error` ;
  - `'manual'` après « Revoir la visite », qui affiche aussi la vue journal.
- **`Dashboard`** :
  - nouvelles props `tourActive: boolean` et `onTourFinish: (reason) => void` ;
  - affiche `<GuidedTour>` seulement quand `tourActive` est vrai et que son contenu est chargé (fin du chargement, cible du jour présente), pour que les cibles existent.
- **À la fin** :
  - `tourRequest` repasse à `null` ;
  - en mode `'auto'`, `markTourCompleted()` est appelé. Un échec est noté dans la console sans rien afficher : la visite reviendra au prochain chargement ;
  - en mode `'manual'`, rien n'est enregistré.
  - Pendant la session, la visite automatique ne se relance pas, même si l'enregistrement a échoué.
- **Cibles** : `data-tour="calories"` sur le conteneur de l'anneau ; `data-tour="add"` sur le bouton flottant et sur le bouton « Ajouter » de l'en-tête du journal ; `data-tour="water"` sur la carte Eau ; `data-tour="weight"` sur la carte Ma pesée ; `data-tour="nav"` sur les deux barres de navigation. La cible retenue est le premier élément visible (taille non nulle).

## Page « Guide »

### Code partagé avec « À propos » (`src/components/Info/InfoPage.tsx`)

`InfoPage<S extends string>({ title, intro?, sections: { id: S; title: string; tone?: 'default' | 'warning'; content: ReactNode }[], section?: S, scrollKey?: number, idPrefix: string, onBack?, actions? })`

- C'est l'actuel squelette de `AboutPage`, extrait pour servir aux deux pages :
  - bouton « Retour à la connexion » si `onBack` ;
  - titre `page-title` ;
  - intro facultative ;
  - `actions` (des boutons sous le titre) ;
  - raccourcis `<nav aria-label="Sections de la page">` ;
  - une `<section>` par entrée, avec l'`id` `${idPrefix}-${id}` ;
  - le même défilement : la première section remonte en haut de page, les autres font `scrollIntoView`, et le défilement est relancé quand `scrollKey` change.
- `AboutPage` devient une liste de sections passée à `InfoPage`. Son rendu et ses tests ne changent pas.

### `GuidePage` (`src/components/Guide/GuidePage.tsx`)

`GuidePage({ section?: GuideSection; scrollKey?: number; signedIn: boolean; onBack?: () => void; onReplayTour?: () => void })`

- Titre « Guide », intro « Les bases de CalTrack en quelques minutes. »
- Une fois connecté (`onReplayTour` fourni) : bouton secondaire « Revoir la visite » sous le titre.
- Sections (`type GuideSection = 'start' | 'meals' | 'water' | 'weight' | 'goal' | 'trends' | 'settings' | 'install'`) :

| `GuideSection` | Titre | Contenu |
| --- | --- | --- |
| `start` | Premiers pas | 1. Votre profil et votre objectif sont créés à l’inscription. 2. Notez vos repas au fil de la journée. 3. Pesez-vous une à deux fois par semaine. 4. Après une semaine, regardez vos tendances. |
| `meals` | Noter un repas | 1. Touchez + (ou « Ajouter » sur ordinateur). 2. Onglet Recherche : aliments génériques et produits du commerce, bouton pour scanner un code-barres ; vos favoris (★) et vos aliments récents s’affichent en haut. Autres onglets : Saisie manuelle, Mes aliments, Recettes. 3. Choisissez la quantité et le repas. Dans le journal, « Modifier » et « Supprimer » corrigent une ligne ; « Copier les repas de la veille » reprend la journée d’hier. |
| `water` | Eau | « + 250 ml » pour un verre, « + 500 ml » pour une bouteille, « Autre… » pour une quantité libre, « Annuler le dernier » en cas d’erreur. L’objectif suit votre poids (30 ml par kg) ; vous pouvez le fixer dans Paramètres. |
| `weight` | Pesée et composition | Notez votre poids dans « Ma pesée », de préférence le matin. Avec une balance impédancemètre, ajoutez la composition (masse grasse, muscles…) dans « Composition (facultatif) ». Les courbes sont dans Tendances. |
| `goal` | Objectif et calories | Votre cible du jour part de votre métabolisme de base et de votre activité, puis retire ou ajoute un pourcentage selon votre objectif (perte, maintien, prise). Après au moins deux semaines de repas notés et trois pesées, CalTrack peut proposer d’ajuster vos calories d’après votre dépense réelle : vous acceptez ou non. À la date de fin, vos journées passent en maintien. |
| `trends` | Tendances | Les 7 derniers jours (calories et protéines moyennes, régularité, série en cours, eau), le graphique des calories, l’évolution du poids et de la composition, et l’historique détaillé des 30 derniers jours. |
| `settings` | Réglages et compte | Menu de l’avatar : « Mon profil » (identité, photo, email, mot de passe, données corporelles), « Paramètres » (thème, affichage des calories et des macros, noms des repas, rappels, objectif d’eau), « Compte et sécurité » (export de vos données, déconnexion de tous les appareils, suppression du compte). |
| `install` | Installer l’app sur le téléphone | iPhone : dans Safari, Partager → « Sur l’écran d’accueil ». Android : dans Chrome, menu ⋮ → « Installer l’application ». Sur iPhone, les rappels ne fonctionnent qu’une fois l’app installée. |

Les listes numérotées sont des `<ol>`. Le reste est en paragraphes ou en `<ul>`, en `text-sm text-body`.

## Navigation et accès

- **`src/utils/navigation.ts`** :
  - `AppView` gagne `'guide'` ;
  - `GuideSection` et `GUIDE_SECTIONS`, avec `isGuideSection(value)` ;
  - `NavigateEventDetail.section` devient `AboutSection | GuideSection`, validé selon la vue.
- **Pied de page** : `AppFooter({ onOpen(page: 'about' | 'guide', section?) })`. Les liens deviennent « CalTrack v1.0.0 · Guide · À propos · Vos données · Sources » ; « Guide » ouvre `('guide')`.
- **Menu de l'avatar** (`AccountMenu`) : entrée « Guide » (icône d'aide) avant « Se déconnecter ». Elle ouvre la vue `guide`.
- **`App.tsx`, connecté** :
  - vue `'guide'`, avec la section et `scrollKey` comme pour « À propos » ;
  - `onReplayTour` affiche le journal et met `tourRequest` à `'manual'`.
- **`App.tsx`, sans connexion** :
  - l'état `guestAbout` devient `guestInfo: { page: 'about' | 'guide'; section? } | null` ;
  - quand il est renseigné, la page demandée remplace le formulaire, avec « Retour à la connexion » ;
  - la page Guide s'affiche sans « Revoir la visite ».

## Tests

- **`tour.ts`** :
  - `placeBubble` : dessous ; au-dessus quand la place manque dessous ; en bas de l'écran quand aucune ne suffit (88 px sur mobile, 16 px sur ordinateur) ;
  - largeur mobile (écran − 32 px), et 360 px gardés dans l'écran sur ordinateur ;
  - textes des 5 étapes.
- **`GuidedTour`** :
  - étape 1 affichée en dialogue, avec titre et « Étape 1 sur 5 », et focus sur « Suivant » ;
  - Suivant et Précédent ;
  - « Terminer » → `onFinish('done')` ; « Passer » et Échap → `onFinish('skipped')` ;
  - étape sans cible sautée et compteur ajusté ;
  - aucune cible → `onFinish('skipped')` ;
  - Tab reste dans la bulle.
- **`App`, démarrage** :
  - visite affichée si `tourCompletedAt` est vide et les préférences prêtes ;
  - pas affichée si elle est déjà vue, si les préférences sont en chargement ou en erreur ;
  - fin → `markTourCompleted` appelé une fois, puis plus de visite ;
  - « Revoir la visite » relance la visite sur le journal sans rien enregistrer.
- **Préférences** : `tourCompletedAt` lu et écrit ; `status` passe à `ready` quand aucune ligne n'existe, et à `error` en cas d'échec.
- **`InfoPage`, « À propos » et `GuidePage`** :
  - les tests actuels de « À propos » passent sans changement ;
  - Guide : les 8 sections ; « Revoir la visite » seulement une fois connecté ; défilement vers une section ;
  - pied de page : « Guide » ouvre le Guide, aussi depuis l'écran de connexion ;
  - menu : entrée « Guide ».
- **Base** (`supabase/tests/09_tour.sql`) : colonne présente et vide par défaut ; un utilisateur remplit la sienne ; il ne peut pas modifier celle d'un autre.
- **e2e** :
  - le Supabase simulé renvoie par défaut une visite déjà vue, pour que les tests existants ne soient pas gênés ;
  - un test dédié la remet à vide : parcours complet (Suivant jusqu'à « Terminer », écriture de `tour_completed_at`), axe sur les étapes 1 et 5 ;
  - axe sur la page Guide, connecté et depuis l'écran de connexion ;
  - tous ces contrôles en thème clair et sombre, sur mobile et ordinateur.

## Hors champ

- Pas de visite sur les autres écrans (Tendances, Objectif, Paramètres) : la page Guide les explique.
- Pas d'illustrations ni de captures dans la page Guide.
- Pas de traduction (application en français uniquement).
