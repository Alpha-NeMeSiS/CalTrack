# Visite guidée, page « Guide » et fenêtre « Quoi de neuf ? » (v2.1.0) — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** une visite de 5 bulles au premier passage sur le journal (mémorisée par compte), une page « Guide », et une fenêtre « Quoi de neuf ? » à chaque nouvelle version, une fois par compte ; l'app passe en 2.1.0.

**Architecture :**
- Une colonne `user_preferences.tour_completed_at`, lue par le contexte des préférences, qui expose aussi `status` et `markTourCompleted`.
- La visite est un composant maison, `GuidedTour`, qui cible des attributs `data-tour`. Le placement de la bulle est calculé par une fonction pure.
- `App` décide quand demander une visite ; `Dashboard` ne l'affiche qu'une fois son contenu chargé.
- La page Guide réutilise le squelette de « À propos », extrait dans `InfoPage`.

**Tech stack :** React 18 + TS, Tailwind, Supabase (migration via l'outil MCP, tests SQL `npm run test:db`), Vitest + Testing Library, Playwright + axe.

**Spec :** `docs/superpowers/specs/2026-11-09-guide-design.md` et `docs/superpowers/specs/2026-11-22-nouveautes-design.md`. La seconde l'emporte en cas d'écart (signature de `markTourCompleted`, nom du test SQL, colonnes non écrites par `preferencesToRow`).

## Global Constraints

- **« Quoi de neuf ? »** : textes de la fenêtre et notes 2.0.0 / 2.1.0 au caractère près (spec du 22/11). Au lancement, la visite passe en premier si elle n'a pas été vue. Sinon, « Quoi de neuf ? » s'affiche si `lastSeenVersion` est vide, invalide ou plus ancien qu'`APP_VERSION`. Jamais les deux dans la même session.
- **Textes** : ceux de la spec, au caractère près (titres et textes des 5 étapes, intro du Guide, 8 sections, libellés « Passer », « Précédent », « Suivant », « Terminer », « Étape N sur M », « Revoir la visite », « Guide »).
- **Aucune dépendance ajoutée.** Les couleurs passent par les classes de rôle (`panel`, `card-title`, `section-label`, `text-body`, `primary-*`), contrôlées par `src/test/designTokens.test.ts`.
- **Placement de la bulle** :
  - largeur pleine moins 2 × 16 px sous 640 px, sinon 360 px gardés à 16 px des bords ;
  - écart de 12 px, découpe agrandie de 6 px, rayon de 18 px ;
  - `bottomInset` de 88 px sur mobile et 16 px sur ordinateur ;
  - défilement : haut de la cible à 120 px.
- **Mémorisation** :
  - seule la visite automatique écrit `tour_completed_at` ;
  - « Revoir la visite » n'écrit rien ;
  - un échec d'enregistrement est seulement noté dans la console.
- **Décision du plan** (écart à la spec, à valider) : `preferencesToRow` n'écrit **pas** `tour_completed_at`. Seul `markTourCompleted` l'écrit, pour qu'un enregistrement des Paramètres ne puisse jamais l'effacer. `preferencesFromRow` le lit.

## Review Focus

1. **Journal sans objectif** (écran « Définir un objectif ») : la visite ne démarre pas et n'est pas marquée vue ; elle démarrera quand le journal aura un objectif. → test tâche 6.
2. **Cible en double** (« + » caché sur ordinateur, « Ajouter » caché sur mobile) : c'est l'élément visible qui est montré, jamais un rectangle vide. → test tâche 3.
3. **Rotation ou redimensionnement** pendant la visite : la bulle est replacée. → test tâche 3.
4. **Paramètres enregistrés après la visite** : `tour_completed_at` n'est pas effacé. → test tâche 1.
5. **« Revoir la visite » une seconde fois** après l'avoir terminée : elle redémarre à l'étape 1. → test tâche 8.

---

### Task 1: Base et préférences (« visite vue »)

**Ajouts « Quoi de neuf ? »** (spec du 22/11, prioritaire) :
- **Migration** : nom `tour_and_last_seen_version`, avec `ADD COLUMN tour_completed_at timestamptz, ADD COLUMN last_seen_version text`.
- **Test SQL** : il s'appelle `supabase/tests/09_tour_and_version.sql` et couvre aussi `last_seen_version` (vide par défaut ; on remplit le sien, pas celui d'un autre).
- **Préférences** :
  - `UserPreferences.lastSeenVersion: string | null` (défaut `null`), lu par `preferencesFromRow` ;
  - `preferencesToRow` n'écrit ni `tour_completed_at` ni `last_seen_version` (test).
- **Services** :
  - `markTourCompleted(userId, version, now?)` envoie exactement `{ user_id, tour_completed_at, last_seen_version: version }` ;
  - `markVersionSeen(userId, version)` envoie exactement `{ user_id, last_seen_version }`, en upsert sur `user_id`.
- **Contexte** :
  - `markTourCompleted()` passe `APP_VERSION` et met à jour `tourCompletedAt` et `lastSeenVersion` ;
  - `markVersionSeen(version)` met à jour `lastSeenVersion` ;
  - hors fournisseur, ces fonctions n'ont aucun effet.

**Fichiers :**
- Créer :
  - `supabase/migrations/<version>_tour_completed.sql` (appliquée avec `mcp__Supabase__apply_migration`, nom `tour_completed`, puis fichier renommé à la version enregistrée) ;
  - `supabase/tests/09_tour.sql`.
- Modifier :
  - `src/utils/preferences.ts` ;
  - `src/services/preferences.ts` ;
  - `src/contexts/preferencesContextValue.ts` ;
  - `src/contexts/PreferencesContext.tsx`.
- Tests :
  - `src/utils/preferences.test.ts` ;
  - `src/services/preferences.test.ts` ;
  - `src/contexts/PreferencesContext.test.tsx`.

**Interfaces :**
- Produit :
  - `UserPreferences.tourCompletedAt: string | null` (défaut `null` dans `DEFAULT_PREFERENCES`) ;
  - `UserPreferencesRow.tour_completed_at?: string | null` ;
  - `markTourCompleted(userId: string, now?: Date): Promise<string>`, qui renvoie l'horodatage enregistré ;
  - dans le contexte, `status: 'loading' | 'ready' | 'error'` et `markTourCompleted: () => Promise<void>`. Hors fournisseur : `status: 'ready'` et `markTourCompleted` sans effet.

- [ ] **Étape 1 : tests qui échouent**
  - **`09_tour.sql`** :
    - après `test.create_user('alice')` et une ligne de préférences, `tour_completed_at` est `NULL` ;
    - Alice remplit la sienne (`test.affected(UPDATE …) = 1`) ;
    - Alice ne modifie pas celle de Bob (`= 0`).
  - **`preferences.test.ts`** :
    - `preferencesFromRow({ tour_completed_at: '2026-11-17T10:00:00Z' }).tourCompletedAt === '2026-11-17T10:00:00Z'` ;
    - absent → `null` ;
    - `'tour_completed_at' in preferencesToRow('u', {...DEFAULT_PREFERENCES, tourCompletedAt: 'x'}) === false` (Review Focus 4).
  - **`services/preferences.test.ts`** : `markTourCompleted('user-1', new Date('2026-11-17T10:00:00Z'))` fait un upsert sur `user_preferences` avec exactement `{ user_id: 'user-1', tour_completed_at: '2026-11-17T10:00:00.000Z' }` et `onConflict: 'user_id'`.
  - **`PreferencesContext.test.tsx`** :
    - `status` vaut `'loading'` puis `'ready'` quand aucune ligne n'existe, et `'error'` quand la lecture échoue ;
    - `markTourCompleted()` appelle le service et met `preferences.tourCompletedAt` à jour.
- [ ] **Étape 2 : vérifier l'échec.** Lancer `npx vitest run src/utils/preferences.test.ts src/services src/contexts`, puis `PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres npm run test:db`. Attendu : les tests ci-dessus échouent (colonne et fonctions absentes).
- [ ] **Étape 3 : implémenter.**
  - Migration : `ALTER TABLE public.user_preferences ADD COLUMN tour_completed_at timestamptz;`, commentée en français.
  - Contexte : `status` repasse à `'loading'` à chaque changement d'utilisateur.
- [ ] **Étape 4 : vérifier la réussite.** Mêmes commandes : PASS, et « Tous les tests de la base sont passés ».
- [ ] **Étape 5 : commit** avec le message « Guide : colonne tour_completed_at, état et enregistrement de la visite dans les préférences ».

### Task 2: Étapes et placement (`src/utils/tour.ts`)

**Fichiers :** créer `src/utils/tour.ts` ; test `src/utils/tour.test.ts`.

**Interfaces :**
- Produit :
  - `type TourTarget = 'calories' | 'add' | 'water' | 'weight' | 'nav'` ;
  - `interface TourStep { id: TourTarget; title: string; body: string }` ;
  - `TOUR_STEPS: readonly TourStep[]` (5 étapes, textes de la spec) ;
  - `interface Rect { top: number; left: number; width: number; height: number }` ;
  - `interface BubblePlacement { top?: number; bottom?: number; left: number; width: number }` ;
  - `placeBubble(target: Rect, bubbleHeight: number, viewport: { width: number; height: number }, opts: { bottomInset: number }): BubblePlacement` ;
  - `TOUR_HOLE_PADDING = 6`, `TOUR_GAP = 12`, `TOUR_MARGIN = 16`, `TOUR_SCROLL_TOP = 120`, `TOUR_BUBBLE_WIDTH = 360`, `TOUR_MOBILE_MAX = 640`.

- [ ] **Étape 1 : tests qui échouent** (`tour.test.ts`, viewport 412 × 839 sauf mention)
  - Textes : les 5 `id` dans l'ordre `calories, add, water, weight, nav`, et `TOUR_STEPS[0].title === 'Votre journée en un coup d’œil'`.
  - Dessous : cible `{top:120,left:16,width:380,height:200}`, bulle de 220 → `{ top: 120+200+6+12, left: 16, width: 380 }`.
  - Au-dessus : cible `{top:600,…,height:120}`, bulle de 220 → `bottom === 839 - 600 + 6 + 12`.
  - En bas : cible `{top:100,…,height:640}`, bulle de 220, `bottomInset: 88` → `{ bottom: 88 }`.
  - Ordinateur (1280 × 720) : largeur 360 ; une cible à `left: 1100` donne `left = 1280 - 16 - 360`.
- [ ] **Étape 2 : vérifier l'échec.** `npx vitest run src/utils/tour.test.ts` échoue (module absent).
- [ ] **Étape 3 : implémenter.** Règles « dessous si `viewport.height - (bottom de la cible + 6) >= bulle + 12 + 16` », puis « au-dessus si `top de la cible - 6 >= bulle + 12 + 16` », sinon `{ bottom: bottomInset }`.
- [ ] **Étape 4 : vérifier la réussite.** PASS.
- [ ] **Étape 5 : commit** avec le message « Guide : étapes de la visite et placement de la bulle ».

### Task 3: Composant `GuidedTour`

**Fichiers :** créer `src/components/Tour/GuidedTour.tsx` ; test `src/components/Tour/GuidedTour.test.tsx`.

**Interfaces :**
- Consomme : `TOUR_STEPS`, `placeBubble` et les constantes (tâche 2).
- Produit :
  - `GuidedTour({ steps: readonly TourStep[]; onFinish: (reason: 'done' | 'skipped') => void })` ;
  - `findTourTarget(id: TourTarget): HTMLElement | null`, qui renvoie le premier `[data-tour="<id>"]` dont `getBoundingClientRect()` a une largeur et une hauteur non nulles.

- [ ] **Étape 1 : tests qui échouent.** Les cibles sont des `div data-tour` avec un `getBoundingClientRect` simulé, et `scrollIntoView` et `scrollBy` sont simulés.
  - Étape 1 : `getByRole('dialog', { name: 'Votre journée en un coup d’œil' })`, le texte « Étape 1 sur 5 », et « Suivant » qui a le focus.
  - Suivant puis Précédent : on revient à l'étape 1 ; « Précédent » est absent à l'étape 1.
  - Dernière étape : le bouton s'appelle « Terminer » et le clic appelle `onFinish('done')`.
  - « Passer » appelle `onFinish('skipped')` ; Échap aussi.
  - Cible `weight` absente : 4 étapes, « Étape 4 sur 4 » pour `nav`.
  - Aucune cible : `onFinish('skipped')` est appelé et aucun dialogue n'est affiché.
  - Tab depuis « Suivant » reste dans la bulle (le focus fait le tour des boutons de la bulle).
  - Review Focus 2 : deux `[data-tour="add"]`, le premier de taille 0 ; la découpe (`data-testid="tour-hole"`) prend le rectangle du second.
  - Review Focus 3 : un événement `resize` après un nouveau `getBoundingClientRect` de la cible déplace la découpe (`style.top` change).
- [ ] **Étape 2 : vérifier l'échec.** `npx vitest run src/components/Tour` échoue.
- [ ] **Étape 3 : implémenter.**
  - **Rendu** (dans un portail sur `document.body`, `z-[60]`) :
    - une couche plein écran qui bloque les clics (`fixed inset-0`) ;
    - la découpe `data-testid="tour-hole"`, avec `box-shadow: 0 0 0 9999px rgb(2 6 23 / 0.62)` et un contour de 2 px en `ring-primary-500` ;
    - la bulle `panel` avec `role="dialog"`, `aria-modal`, `aria-labelledby` et `aria-describedby`, et une hauteur max `calc(100vh - 32px)` avec défilement interne.
  - **Défilement** : `window.scrollBy(0, top - TOUR_SCROLL_TOP)` pour une cible du flux. Pas de défilement si la cible est `position: fixed` ou à l'intérieur d'un élément fixe (bouton flottant, barre du bas). `behavior: 'smooth'` sauf si `matchMedia('(prefers-reduced-motion: reduce)')` répond oui.
  - **Mesure et placement** : mesure après le défilement (`requestAnimationFrame`), recalcul sur `resize`, `orientationchange` et `scroll`. `bottomInset` vaut 88 si `innerWidth < 640`, sinon 16.
  - **Fin** : `document.body.focus()` est inutile, il suffit de retirer le portail.
- [ ] **Étape 4 : vérifier la réussite.** `npx vitest run src/components/Tour` PASS ; `npx vitest run src/test/designTokens.test.ts` PASS.
- [ ] **Étape 5 : commit** avec le message « Guide : composant de visite guidée (bulle, découpe, clavier) ».

### Task 4: Notes de version et passage en 2.1.0

**Fichiers :**
- Créer :
  - `src/data/releases.ts` ;
  - `src/utils/releases.ts` ;
  - `src/utils/releases.test.ts`.
- Modifier :
  - `package.json` et `package-lock.json` (`npm version 2.1.0 --no-git-tag-version`) ;
  - `CHANGELOG.md` (entrée 2.1.0) ;
  - `README.md` (section Version : ajouter les notes dans `src/data/releases.ts`) ;
  - `src/utils/navigation.test.ts`.

**Interfaces :**
- Produit :
  - `interface ReleaseNote { version: string; date: string; items: string[] }` ;
  - `RELEASES: readonly ReleaseNote[]`, de la plus récente à la plus ancienne ;
  - `compareVersions(a: string, b: string): number` ;
  - `unseenReleases(releases: readonly ReleaseNote[], lastSeen: string | null): ReleaseNote[]` ;
  - `isNewerVersion(current: string, lastSeen: string | null): boolean`, vrai si `lastSeen` est vide, invalide ou plus ancien.

- [ ] **Étape 1 : tests qui échouent**
  - **`compareVersions`** : `('2.0.10', '2.0.9') > 0`, `('2.1.0', '2.0.10') > 0`, `('2.1.0', '2.1.0') === 0`, et une version mal formée vaut `0.0.0`.
  - **`unseenReleases`** :
    - sur `[2.1.0, 2.0.1, 2.0.0]`, depuis `'2.0.0'`, renvoie les versions `['2.1.0', '2.0.1']` ;
    - depuis `'2.1.0'`, renvoie `[]` ;
    - avec `null` ou `'abc'`, renvoie seulement `['2.1.0']`.
  - **`isNewerVersion`** : `('2.1.0', '2.0.0')` vrai, `('2.1.0', '2.1.0')` faux, `('2.1.0', null)` vrai.
  - **Garde-fous de `RELEASES`** :
    - `RELEASES[0].version === APP_VERSION` ;
    - versions uniques et triées de la plus récente à la plus ancienne ;
    - dates au format `/^\d{4}-\d{2}-\d{2}$/` ;
    - entre 1 et 5 points non vides par version ;
    - les textes 2.0.0 et 2.1.0 sont ceux de la spec.
  - **`navigation.test.ts`** : `APP_VERSION === '2.1.0'`.
- [ ] **Étape 2 : vérifier l'échec.** `npx vitest run src/utils/releases.test.ts src/utils/navigation.test.ts` échoue.
- [ ] **Étape 3 : implémenter.** La date de 2.1.0 est celle du jour de mise en ligne, et 2.0.0 date du `2026-11-22`. Passer en 2.1.0 et ajouter l'entrée au CHANGELOG.
- [ ] **Étape 4 : vérifier la réussite.** `npx vitest run` PASS.
- [ ] **Étape 5 : commit** avec le message « Version 2.1.0 : notes de version vérifiées par un test ».

### Task 5: Fenêtre `WhatsNewDialog`

**Fichiers :** créer `src/components/WhatsNew/WhatsNewDialog.tsx` ; test `src/components/WhatsNew/WhatsNewDialog.test.tsx`.

**Interfaces :**
- Consomme : `ReleaseNote` (tâche 4), `formatDateFR` et `parseLocalDate` (`src/utils/date.ts`).
- Produit : `WhatsNewDialog({ releases: ReleaseNote[]; onClose: () => void; subtitle?: string })`.

- [ ] **Étape 1 : tests qui échouent**
  - Une version donne le sous-titre « CalTrack a été mis à jour » ; deux versions donnent « 2 mises à jour depuis votre dernière visite » ; le prop `subtitle` remplace ce texte.
  - On trouve `getByRole('dialog', { name: 'Quoi de neuf ?' })`, l'en-tête `Version 2.1.0 · 3 décembre 2026` (pour la date `2026-12-03`) et les points.
  - Le focus est sur « C'est noté » ; Tab reste dans la fenêtre.
  - « C'est noté », « Fermer » et Échap appellent `onClose` ; un clic sur le fond ne l'appelle pas.
- [ ] **Étape 2 : vérifier l'échec.** `npx vitest run src/components/WhatsNew` échoue.
- [ ] **Étape 3 : implémenter.** Fond `fixed inset-0 bg-black bg-opacity-50`, fenêtre `bg-surface rounded-lg shadow-xl max-w-md max-h-[90vh] overflow-y-auto`, titre `card-title`, en-têtes `section-label`.
- [ ] **Étape 4 : vérifier la réussite.** `npx vitest run src/components/WhatsNew src/test/designTokens.test.ts` PASS.
- [ ] **Étape 5 : commit** avec le message « Fenêtre « Quoi de neuf ? » ».

### Task 6: Démarrage de la visite sur le journal

**Ajouts « Quoi de neuf ? »** :
- **Rendu** : `App` affiche `<WhatsNewDialog releases={unseenReleases(RELEASES, lastSeenVersion)}>` au-dessus de la vue en cours.
- **Conditions** :
  - préférences `ready` ;
  - visite déjà vue (`tourCompletedAt` renseigné) ;
  - aucune visite automatique demandée dans la session ;
  - `isNewerVersion(APP_VERSION, lastSeenVersion)`.
- **Fermeture** : `markVersionSeen(APP_VERSION).catch(console.error)`, et la fenêtre ne revient pas dans la session.
- **Tests en plus** (`App.tour.test.tsx`) :
  - visite non vue : visite seule ; « Passer » appelle `markTourCompleted` et aucune fenêtre « Quoi de neuf ? » n'apparaît ensuite ;
  - visite vue et `lastSeenVersion: '2.0.0'` : la fenêtre montre la 2.1.0 ; « C'est noté » appelle `markVersionSeen('2.1.0')` une fois et la fenêtre ne revient pas ;
  - visite vue et `lastSeenVersion = APP_VERSION` : rien ;
  - préférences en erreur : rien.

**Fichiers :**
- Modifier :
  - `src/components/Dashboard/Dashboard.tsx` (props, `data-tour="calories"` et `data-tour="add"` ×2) ;
  - `src/components/Water/WaterCard.tsx` (`data-tour="water"`) ;
  - `src/components/Weight/WeightQuickLog.tsx` (`data-tour="weight"`) ;
  - `src/components/Layout/Navigation.tsx` (`data-tour="nav"` sur les deux `<nav>`) ;
  - `src/App.tsx`.
- Tests :
  - `src/components/Dashboard/Dashboard.test.tsx` ;
  - `src/App.tour.test.tsx` (nouveau, simulacres comme `src/App.test.tsx` mais avec un utilisateur et un profil).

**Interfaces :**
- Consomme : `GuidedTour` (tâche 3), et `usePreferences().status`, `preferences.tourCompletedAt` et `markTourCompleted` (tâche 1).
- Produit :
  - props de `Dashboard` : `tourActive?: boolean` et `onTourFinish?: (reason: 'done' | 'skipped') => void` ;
  - dans `App` : l'état `tourRequest: 'auto' | 'manual' | null` et `startTourReplay(): void`, qui affiche le journal et passe en `'manual'` (utilisé en tâche 8).

- [ ] **Étape 1 : tests qui échouent**
  - **`Dashboard.test.tsx`** :
    - avec `tourActive` et un objectif chargé, le dialogue de la visite apparaît ;
    - Review Focus 1 : sans objectif (écran « Définir un objectif »), pas de dialogue et `onTourFinish` n'est pas appelé.
  - **`App.tour.test.tsx`** (contexte des préférences fourni par le test) :
    - `status: 'ready'` et `tourCompletedAt: null` : la visite apparaît ; « Passer » appelle `markTourCompleted` une fois et la visite disparaît ;
    - `tourCompletedAt` renseigné : pas de visite ;
    - `status: 'loading'` ou `'error'` : pas de visite ;
    - après « Passer », un nouveau rendu du journal ne relance pas la visite.
- [ ] **Étape 2 : vérifier l'échec.** `npx vitest run src/components/Dashboard src/App.tour.test.tsx` échoue.
- [ ] **Étape 3 : implémenter.**
  - Dans `App`, un `useRef(false)` empêche une seconde demande automatique dans la session.
  - En mode `'auto'`, `markTourCompleted().catch(console.error)`.
  - `Dashboard` affiche `<GuidedTour steps={TOUR_STEPS} …>` si `tourActive && target && !loading && !loadError`.
- [ ] **Étape 4 : vérifier la réussite.** Même commande, puis `npx vitest run` : PASS.
- [ ] **Étape 5 : commit** avec le message « Guide : la visite démarre au premier passage sur le journal ».

### Task 7: Squelette partagé `InfoPage` (refactorisation de « À propos »)

**Fichiers :**
- Créer : `src/components/Info/InfoPage.tsx`.
- Modifier : `src/components/About/AboutPage.tsx`.
- Tests : `src/components/About/About.test.tsx` (inchangé, doit rester vert) et `src/components/Info/InfoPage.test.tsx`.

**Interfaces :**
- Produit :
  - `InfoSectionDef<S extends string> = { id: S; title: string; tone?: 'default' | 'warning'; content: ReactNode }` ;
  - `InfoPage<S extends string>({ title: string; intro?: ReactNode; sections: InfoSectionDef<S>[]; section?: S; scrollKey?: number; idPrefix: string; onBack?: () => void; actions?: ReactNode })`.
  - La première section du tableau remonte en haut de page (`window.scrollTo({ top: 0 })`) ; les autres utilisent `scrollIntoView` sur `#${idPrefix}-${id}`.

- [ ] **Étape 1 : test qui échoue** (`InfoPage.test.tsx`) :
  - `actions` est rendu sous le titre ;
  - `intro` est rendu ;
  - les `id` de section suivent `idPrefix` (`#guide-water` pour `idPrefix="guide"`).
- [ ] **Étape 2 : vérifier l'échec.** `npx vitest run src/components/Info` échoue.
- [ ] **Étape 3 : implémenter** en déplaçant `Section`, la navigation par raccourcis et le défilement de `AboutPage`. `AboutPage` passe `idPrefix="about"` et ses 4 sections.
- [ ] **Étape 4 : vérifier la réussite.** `npx vitest run src/components/Info src/components/About src/App.test.tsx` PASS, sans toucher `About.test.tsx`.
- [ ] **Étape 5 : commit** avec le message « À propos : squelette de page d'information partagé (InfoPage) ».

### Task 8: Page « Guide » et accès

**Ajouts « Quoi de neuf ? »** :
- **Page « À propos »**, section « CalTrack » : bouton secondaire « Voir les nouveautés ». Il ouvre `WhatsNewDialog` avec toutes les versions de `RELEASES` et le sous-titre « Historique des mises à jour ». Il fonctionne connecté ou non, et la fermeture n'enregistre rien.
- **Test** dans `About.test.tsx`.

**Fichiers :**
- Créer :
  - `src/components/Guide/GuidePage.tsx` ;
  - `src/components/Guide/GuidePage.test.tsx`.
- Modifier :
  - `src/utils/navigation.ts` ;
  - `src/components/Layout/AppFooter.tsx` ;
  - `src/components/Layout/AccountMenu.tsx` ;
  - `src/App.tsx`.
- Tests :
  - `src/utils/navigation.test.ts` ;
  - `src/components/About/About.test.tsx` (pied de page) ;
  - `src/components/Layout/AccountMenu.test.tsx` ;
  - `src/App.test.tsx` ;
  - `src/App.tour.test.tsx`.

**Interfaces :**
- Consomme : `InfoPage` (tâche 7) et `startTourReplay` (tâche 6).
- Produit :
  - `type GuideSection = 'start' | 'meals' | 'water' | 'weight' | 'goal' | 'trends' | 'settings' | 'install'`, avec `GUIDE_SECTIONS` et `isGuideSection` ;
  - `AppView` gagne `'guide'` ;
  - `NavigateEventDetail.section?: AboutSection | GuideSection` ;
  - `type InfoPageName = 'about' | 'guide'` ;
  - `AppFooter({ onOpen: (page: InfoPageName, section?: AboutSection) => void; showAttribution?; className? })` ;
  - `AccountMenu` : `onNavigate` accepte aussi `'guide'` ;
  - `GuidePage({ section?: GuideSection; scrollKey?: number; signedIn: boolean; onBack?: () => void; onReplayTour?: () => void })`.

- [ ] **Étape 1 : tests qui échouent**
  - **`navigation.test.ts`** : `isAppView('guide')` ; `isGuideSection('install')` vrai et `isGuideSection('app')` faux.
  - **`GuidePage.test.tsx`** :
    - le titre de niveau 1 est « Guide » et l'intro « Les bases de CalTrack en quelques minutes. » est affichée ;
    - les 8 titres de section de la spec sont des titres de niveau 2 ;
    - « Revoir la visite » est absent quand `signedIn={false}`, et appelle `onReplayTour` sinon ;
    - les listes « Premiers pas » et « Noter un repas » sont des `<ol>` ;
    - le texte « Sur iPhone, les rappels ne fonctionnent qu’une fois l’app installée. » est présent.
  - **Pied de page** (`About.test.tsx`) : l'ordre des liens est « Guide, À propos, Vos données, Sources » ; « Guide » appelle `onOpen('guide')` et « Sources » appelle `onOpen('about', 'sources')`. C'est une mise à jour du test existant `onOpen.mock.calls`.
  - **`AccountMenu.test.tsx`** : l'élément de menu « Guide » est placé avant « Se déconnecter » et appelle `onNavigate('guide')`.
  - **`App.test.tsx`** (déconnecté) : « Guide » dans le pied de page ouvre le titre de niveau 1 « Guide », sans bouton « Revoir la visite » ; « Retour à la connexion » ramène au formulaire.
  - **`App.tour.test.tsx`** (connecté, visite déjà vue) :
    - menu, puis « Guide », puis « Revoir la visite » : le dialogue de l'étape 1 apparaît sur le journal ;
    - « Terminer » au bout de 5 « Suivant » : `markTourCompleted` n'est pas appelé ;
    - Review Focus 5 : relancer une seconde fois redémarre à « Étape 1 sur 5 ».
- [ ] **Étape 2 : vérifier l'échec.** `npx vitest run src/utils/navigation.test.ts src/components/Guide src/components/About src/components/Layout src/App.test.tsx src/App.tour.test.tsx` échoue.
- [ ] **Étape 3 : implémenter.**
  - Contenu de `GuidePage` : les sections de la spec via `InfoPage` (`idPrefix="guide"`).
  - **`App` connecté** :
    - états `guideSection` et `guideRequest`, sur le modèle de `aboutSection` et `aboutRequest` ;
    - vue `'guide'` avec `onReplayTour={startTourReplay}` ;
    - `onOpen` du pied de page répartit entre `'about'` et `'guide'` ;
    - l'effet de remontée en haut ne s'applique pas non plus à `'guide'` ouvert sur une section.
  - **`App` sans connexion** : `guestAbout` devient `guestInfo: { page: InfoPageName; section?: AboutSection } | null`.
  - `navigateTo('guide')` est validé par `isGuideSection`.
- [ ] **Étape 4 : vérifier la réussite.** Même commande, puis `npx vitest run` : PASS.
- [ ] **Étape 5 : commit** avec le message « Guide : page Guide, liens du pied de page et du menu, « Revoir la visite » ».

### Task 9: e2e, README, vérification, PR

**Ajouts « Quoi de neuf ? »** :
- **Simulacre** : la ligne de préférences par défaut a aussi `last_seen_version` égal à la version de `package.json` (lue avec `readFileSync`). L'option devient `mockSupabase(page, { tourSeen?: boolean; lastSeenVersion?: string | null })`.
- **e2e « Quoi de neuf ? »** avec `lastSeenVersion: '2.0.0'` : dialogue « Quoi de neuf ? » et axe ; « C'est noté » le ferme, et une écriture de `last_seen_version` a été reçue.
- **e2e « Voir les nouveautés »** depuis « À propos » : axe.
- **Captures** : fenêtre « Quoi de neuf ? » sur mobile en clair et sur ordinateur en sombre.
- **Fin** : pas de nouvelle PR. Mettre à jour la PR [Alpha-NeMeSiS/CalTrack#52](https://github.com/Alpha-NeMeSiS/CalTrack/pull/52) (titre sans « (en cours) », description complète).
- **README** : section « Visite guidée, Guide et Quoi de neuf », et `09_tour_and_version.sql` dans le tableau des tests de la base.

**Fichiers :**
- Modifier :
  - `e2e/fixtures/supabase.ts` ;
  - `e2e/accessibility.spec.ts` ;
  - `README.md` (fonctionnalités, section « Visite guidée et page Guide », migration dans le tableau, `09_tour.sql` dans le tableau des tests de la base).

- [ ] **Étape 1 : simulacre.**
  - `rowsFor('user_preferences')` renvoie une ligne par défaut avec `tour_completed_at: '2026-11-01T08:00:00Z'`.
  - `mockSupabase(page, { tourSeen?: boolean })` : avec `false`, `tour_completed_at` vaut `null`.
  - L'écriture d'une ligne contenant `tour_completed_at` est enregistrée dans un tableau exporté `writes`, lisible par le test.
- [ ] **Étape 2 : tests e2e** (thème clair et sombre, mobile et ordinateur) :
  - **Visite** avec `tourSeen: false` :
    - dialogue « Votre journée en un coup d’œil » et axe ;
    - « Suivant » × 4 jusqu'à « Aller plus loin », puis axe ;
    - « Terminer » : le dialogue disparaît et une écriture de `tour_completed_at` a été reçue.
  - **Guide connecté** : menu, puis « Guide », puis titre de niveau 1 « Guide » et axe.
  - **Guide depuis la connexion** : « Guide » dans le pied de page, puis axe.
  - Les tests existants passent sans changement, grâce à la visite marquée vue par défaut.
- [ ] **Étape 3 : README** (sections listées ci-dessus).
- [ ] **Étape 4 : vérification complète.** Lancer `npm run lint`, `npm run typecheck`, `npx vitest run`, `npm run build`, `PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres npm run test:db` et `npx playwright test --trace off`. Tout doit passer.
- [ ] **Étape 5 : captures.** Étapes 1 et 5 sur mobile en clair, étape 1 sur ordinateur en sombre, et page Guide sur mobile. Script temporaire hors du dépôt, images envoyées à l'utilisateur.
- [ ] **Étape 6 : commit, push sur `dev`, nouvelle PR brouillon vers `main`**, puis abonnement à la PR et vérification programmée.
