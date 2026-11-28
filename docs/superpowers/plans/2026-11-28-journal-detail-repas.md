# Logo cliquable, journal défilant, détail par repas — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendre le logo cliquable (retour au tableau de bord du jour), borner la hauteur du journal avec une barre de défilement, et ajouter une fenêtre « Détail par repas » (kcal et macros de chaque repas).

**Architecture:** Calcul pur dans `entries.ts` (totaux par repas), fenêtre React autonome qui le consomme, branchée sur le bloc calories + macros du `Dashboard`. Le logo devient un bouton du `Header` qui appelle un `onHome` fourni par `App`, seul détenteur de la vue et de la date du tableau de bord. Aucun changement de base de données.

**Tech Stack:** React 18 + TypeScript, Tailwind, Vitest + Testing Library, Playwright + axe.

**Spec:** `docs/superpowers/specs/2026-11-28-journal-detail-repas-design.md`

## Global Constraints

- Textes de l'interface en français, exactement : bouton « Détail », titre « Détail par repas », ligne « Total », libellé du logo « CalTrack, retour au tableau de bord ».
- En-têtes de colonnes affichés « kcal », « Prot. », « Lip. », « Gluc. », « Fib. », avec le nom complet pour les lecteurs d'écran (« Protéines », « Lipides », « Glucides », « Fibres »).
- kcal et grammes arrondis à l'unité ; part des kcal en % entier.
- Seuls les repas qui ont des aliments, dans l'ordre `MEAL_ORDER`, avec les noms personnalisés (`getMealLabel`).
- Fenêtre : `useModalFocus` (`frontend/shared/ui/useModalFocus.ts`), `role="dialog"`, `aria-modal="true"`.
- Journal : hauteur maximale `max-h-[60vh]`, `role="region"` nommée par le titre « Journal du jour », `tabIndex={0}`.
- Version 2.3.0 (nouvelle fonctionnalité). Changer la version déclenche un déploiement en production à la fusion.

## Review Focus

- **Journée à 0 kcal** (eau, café noir) : la part doit valoir 0 %, jamais `NaN %`.
- **Valeurs non numériques venant de Supabase** (`fiber_g` nul, nombres en chaîne) : traitées comme des nombres, `null` → 0.
- **Entrées sans repas** : une ligne « Sans repas » (ou son nom personnalisé), pas d'entrée perdue.
- **Nom de repas personnalisé long sur un écran de 320 px** : le tableau défile horizontalement dans la fenêtre au lieu de déborder.
- **Clic sur le logo alors qu'on est déjà sur le tableau de bord à une autre date** : la date revient à aujourd'hui (pas seulement la vue).

---

### Task 1: Totaux par repas

**Files:**
- Modify: `frontend/features/journal/entries.ts`
- Test: `frontend/features/journal/entries.test.ts`

**Interfaces:**
- Consumes: `MEAL_ORDER`, `MEAL_LABELS`, `MealType` (même fichier).
- Produces:
  ```ts
  export interface MealTotals { kcal: number; protein_g: number; fat_g: number; carbs_g: number; fiber_g: number }
  export interface MealSummary extends MealTotals { meal: MealType | 'other'; label: string; sharePct: number }
  export interface MealBreakdown { meals: MealSummary[]; total: MealTotals }
  export function summarizeMeals(
    entries: readonly Pick<Entry, 'meal_type' | 'kcal' | 'protein_g' | 'fat_g' | 'carbs_g' | 'fiber_g'>[],
    getLabel?: (meal: MealType | 'other') => string
  ): MealBreakdown
  ```

- [ ] **Step 1: Tests qui échouent** (`describe('summarizeMeals')`)
  - `additionne kcal et macros par repas, dans l'ordre de la journée` : petit-déjeuner (2 entrées : 300 kcal/10/8/40/3 et 120/8/4/18/3) et dîner (650/35/22/70/7) → `meals.map(m => m.meal)` = `['breakfast', 'dinner']`, petit-déjeuner = `{ kcal: 420, protein_g: 18, fat_g: 12, carbs_g: 58, fiber_g: 6 }`.
  - `calcule la part des kcal de la journée` : 420 et 650 kcal → `sharePct` 39 et 61.
  - `donne le total de la journée` : `total` = `{ kcal: 1070, protein_g: 53, fat_g: 34, carbs_g: 128, fiber_g: 13 }`.
  - `arrondit à l'unité` : une entrée 100,4 kcal / 12,6 g de protéines → 100 et 13.
  - `journée à 0 kcal : part de 0 %, jamais NaN` : deux entrées à 0 kcal → tous les `sharePct` = 0.
  - `accepte nombres en chaîne et fibres absentes` : `kcal: '250'`, `fiber_g: null` (cast `as unknown as Entry`) → kcal 250, fibres 0.
  - `range les entrées sans repas dans « Sans repas »` : `meal_type: undefined` → `meal: 'other'`, `label: 'Sans repas'`.
  - `utilise les noms de repas personnalisés` : `getLabel` renvoie `'Matin'` pour `breakfast` → `label: 'Matin'`.
  - `aucune entrée` → `{ meals: [], total: { kcal: 0, … } }`.
- [ ] **Step 2:** `npx vitest run frontend/features/journal/entries.test.ts` → échec « summarizeMeals is not a function ».
- [ ] **Step 3:** Implémenter `summarizeMeals` : sommes brutes par repas (`Number(x) || 0`), arrondis à la fin ; `sharePct = totalKcalBrut > 0 ? Math.round(kcalBrut / totalKcalBrut * 100) : 0` ; total calculé sur les sommes brutes. Réutiliser `MEAL_ORDER` et ignorer les repas vides, comme `groupEntriesByMeal`.
- [ ] **Step 4:** Relancer → PASS.
- [ ] **Step 5:** Commit `feat(journal): totaux kcal et macros par repas`.

### Task 2: Fenêtre « Détail par repas »

**Files:**
- Create: `frontend/features/journal/MealBreakdownDialog.tsx`
- Test: `frontend/features/journal/MealBreakdownDialog.test.tsx`

**Interfaces:**
- Consumes: `MealBreakdown` (Task 1), `useModalFocus(ref, onClose)`.
- Produces: `export function MealBreakdownDialog(props: { breakdown: MealBreakdown; dateLabel: string; onClose: () => void }): JSX.Element`

- [ ] **Step 1: Tests qui échouent**
  - `affiche une ligne par repas et la ligne Total` : `getByRole('dialog', { name: 'Détail par repas' })` ; `getAllByRole('row')` = en-tête + 2 repas + Total ; la ligne « Petit-déjeuner » contient « 420 », « 39 % », « 18 g ».
  - `nomme les colonnes en entier pour les lecteurs d'écran` : `getByRole('columnheader', { name: /Protéines/ })` (idem Lipides, Glucides, Fibres).
  - `affiche la date` : le texte de `dateLabel` est visible.
  - `se ferme avec la croix et avec Échap` : `onClose` appelé une fois par action (bouton « Fermer »).
- [ ] **Step 2:** `npx vitest run frontend/features/journal/MealBreakdownDialog.test.tsx` → échec (module absent).
- [ ] **Step 3:** Écrire le composant : même fond et même carte que `WhatsNewDialog` ; `<table>` avec `<caption className="sr-only">`, en-têtes `<th scope="col">` « Prot. » + `<span className="sr-only">` pour le nom complet (le visible en `aria-hidden`) ; `<th scope="row">` pour le nom du repas ; part affichée `({sharePct} %)` en `text-subtle` ; ligne Total dans `<tfoot>` ; tableau enveloppé dans `overflow-x-auto` (Review Focus : 320 px) ; nombres alignés à droite (`tabular-nums`).
- [ ] **Step 4:** Relancer → PASS.
- [ ] **Step 5:** Commit `feat(journal): fenêtre « Détail par repas »`.

### Task 3: Bouton « Détail » et journal défilant dans le tableau de bord

**Files:**
- Modify: `frontend/features/journal/Dashboard.tsx` (bloc « Calories et macros du jour » et bloc « Journal du jour »)
- Test: `frontend/features/journal/Dashboard.test.tsx`

**Interfaces:**
- Consumes: `summarizeMeals` (Task 1), `MealBreakdownDialog` (Task 2), `getMealLabel(preferences, meal)`, `formatDateFR` / `parseLocalDate` pour `dateLabel`.

- [ ] **Step 1: Tests qui échouent**
  - `affiche « Détail » quand la journée a des aliments, et ouvre la fenêtre` : avec les entrées de test existantes → clic sur `getByRole('button', { name: 'Détail' })` → `findByRole('dialog', { name: 'Détail par repas' })`.
  - `n'affiche pas « Détail » sur une journée vide` : `queryByRole('button', { name: 'Détail' })` absent.
  - `rend le focus au bouton « Détail » à la fermeture` : après Échap, `toHaveFocus()` sur le bouton.
  - `place les aliments dans une zone défilante nommée et atteignable au clavier` : `getByRole('region', { name: 'Journal du jour' })` a `tabIndex` 0 et contient les aliments ; le bouton « Copier les repas de la veille » n'y est **pas** (`not.toContainElement`).
- [ ] **Step 2:** `npx vitest run frontend/features/journal/Dashboard.test.tsx` → échec.
- [ ] **Step 3:** Implémenter :
  - état `showBreakdown` ; bouton « Détail » (`btn-secondary`, petite taille) dans le bloc macros, rendu si `entries.length > 0` ; fenêtre rendue si `showBreakdown`, avec `summarizeMeals(entries, (meal) => getMealLabel(preferences, meal))` ;
  - donner `id="journal-title"` au titre « Journal du jour » ; envelopper la liste (le `div` `divide-y`) dans `<div role="region" aria-labelledby="journal-title" tabIndex={0} className="max-h-[60vh] overflow-y-auto … focus-visible:ring-2 …">` ; l'état vide reste hors de la zone.
- [ ] **Step 4:** Relancer → PASS, puis `npm test` complet.
- [ ] **Step 5:** Commit `feat(journal): bouton Détail et journal défilant`.

### Task 4: Logo cliquable

**Files:**
- Modify: `frontend/app/layout/Header.tsx`, `frontend/app/App.tsx`
- Create: `frontend/app/layout/Header.test.tsx`
- Test: `frontend/app/App.tour.test.tsx` (application connectée déjà mise en place)

**Interfaces:**
- Produces: `Header({ onHome }: { onHome: () => void })` ; dans `App`, `goHome()` = `setCurrentView('dashboard')` + `setDashboardDate(getTodayDate())` + `window.scrollTo?.({ top: 0 })`.

- [ ] **Step 1: Tests qui échouent**
  - Header : `getByRole('button', { name: 'CalTrack, retour au tableau de bord' })` ; clic → `onHome` appelé une fois.
  - App : depuis la vue « Tendances » (clic sur l'onglet), clic sur le logo → le journal est affiché (`findByRole('heading', { name: 'Journal du jour' })`).
  - App (Review Focus) : sur le tableau de bord, passer au jour précédent, clic sur le logo → la date affichée redevient celle du jour.
- [ ] **Step 2:** Lancer les deux fichiers → échec.
- [ ] **Step 3:** Envelopper logo + nom dans un `<button type="button" aria-label=…>` sans style de bouton (focus visible) ; le `<h1>` reste un titre (bouton à l'intérieur, pas l'inverse) ; brancher `onHome={goHome}` dans `App`.
- [ ] **Step 4:** Relancer → PASS.
- [ ] **Step 5:** Commit `feat: le logo ramène au tableau de bord du jour`.

### Task 5: Accessibilité, version 2.3.0, documentation

**Files:**
- Modify: `e2e/accessibility.spec.ts`, `package.json`, `package-lock.json`, `CHANGELOG.md`, `frontend/features/whats-new/releaseNotes.ts`, `frontend/app/navigation.test.ts`, `frontend/features/guide/GuidePage.tsx` (phrase sur le journal, si elle décrit le bloc macros), `README.md`, `docs/CONTEXTE-AGENT.md`

- [ ] **Step 1:** e2e : dans « connecté › journal », ouvrir « Détail » et lancer axe sur la fenêtre (thèmes clair et sombre).
- [ ] **Step 2:** `npm version 2.3.0 --no-git-tag-version` ; test de version → `2.3.0` ; notes « Quoi de neuf ? » (3 phrases, sans jargon) ; CHANGELOG ; Guide et README si concernés ; contexte : « Copier un repas » passe en 2.4.0.
- [ ] **Step 3:** `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run test:a11y -- --trace off` → tout vert.
- [ ] **Step 4:** Commit `release: 2.3.0`, push sur `dev`, PR brouillon vers `main`.
