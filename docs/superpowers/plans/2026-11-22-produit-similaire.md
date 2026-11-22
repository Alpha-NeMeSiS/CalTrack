# Produit similaire (estimation d'un produit scanné sans valeurs) — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** quand un produit scanné est dans Open Food Facts sans valeurs, proposer l'estimation la plus proche d'après des produits similaires, pré-remplir le formulaire et marquer l'aliment « Estimé ».

**Architecture :**
- **Recherche et calcul** (`src/lib/similarProducts.ts`) :
  - fonctions pures : mots du nom, classement, estimation, textes de source ;
  - `findSimilarProducts`, qui lance deux recherches en parallèle via le proxy `/api/off/search`, qui accepte maintenant `size`.
- **Interface** :
  - `FoodSearch` affiche la carte `SimilarEstimateCard` et transmet un brouillon enrichi à `onCreateFood` ;
  - `AddEntryModal` pré-remplit la saisie manuelle et enregistre le drapeau `values_estimated`.

**Tech Stack :** React 18 + TypeScript, Vite, Tailwind (classes du design system), Vitest + Testing Library, Netlify Functions, Supabase (Postgres), Playwright + axe.

**Spec :** `docs/superpowers/specs/2026-11-22-produit-similaire-design.md`

## Global Constraints

- Version **2.2.0**.
- Textes exacts de la spec. Nombres au format français via `formatDecimal` (`src/utils/format.ts`).
- Classes du design system uniquement :
  - `panel`, `section-label`, `badge badge-success|badge-info|badge-warning`, `btn-primary`, `btn-secondary` ;
  - pas de couleurs brutes ni de classes retirées (`src/test/designTokens.test.ts`).
- Mots vides : `les des aux avec pour sans une sur par the and with`. Au plus 6 mots. « s » final retiré si le mot fait plus de 4 lettres.
- Score = part des mots en commun + **0,25** si même marque. Produits utilisés : meilleur score à **0,01** près, **3** au plus. Liste : **5** produits.
- Cohérence : |kcal − (4P + 4G + 9L)| ≤ max(20, 0,2 × kcal).
- Proxy : `size` entier de 1 à 30, sinon 10.
- Aucun secret dans le dépôt. Migration appliquée au projet `ieriugqyfaabelpvqfjt` via l'outil Supabase, puis fichier renommé à la version enregistrée.

## Review Focus

1. Nom réduit à la marque ou à une quantité (« Sodebo 330g ») : pas de recherche, message « Aucun produit similaire trouvé… » et « Créer cet aliment ». *Test : Task 2 (`findSimilarProducts` sans appel réseau) et Task 4.*
2. Une des deux recherches échoue (503) : l'autre suffit. Les deux échouent : message de repli, pas d'erreur. *Test : Task 2 et Task 4.*
3. Nouveau scan ou nouvelle saisie pendant la recherche : l'ancienne réponse ne remplace pas l'état courant. *Test : Task 4.*
4. Formulaire pré-rempli passé en « La quantité indiquée » sans changer les chiffres : enregistré **non** estimé (base modifiée). *Test : Task 5.*
5. Marque avec accents ou guillemets (`Côté "Snack"`) : requête `brands:"côté snack"`. *Test : Task 2.*

---

### Task 1: Proxy `size` et données du produit sans valeurs

**Files :**
- Modify : `netlify/functions/off-search.ts`, `src/lib/openfoodfacts.ts`, `src/types/food.ts`
- Test : `netlify/tests/off-search.test.ts`, `src/lib/openfoodfacts.test.ts`

**Interfaces :**
- Produces :
  - `searchOFF(term: string, signal?: AbortSignal, size?: number): Promise<NormalizedFood[]>`. Ajoute `&size=<size>` seulement si `size` est donné.
  - `OFFProductLookup` : `{ status: 'no_nutrition'; code: string; name: string; brand?: string; servingGrams?: number }`.
  - `export type NutritionPer100 = Pick<NormalizedFood, 'kcal_per_100g' | 'protein_g' | 'fat_g' | 'carbs_g' | 'fiber_g'>` dans `src/types/food.ts`.

- [ ] **Step 1 : tests en échec**
  - `off-search.test.ts`, test `« size » choisit le nombre de résultats (1 à 30, sinon 10)` :
    - `{ q: 'pastabox bolognaise', size: '30' }` → `page_size` vaut `'30'` ;
    - `'1'` → `'1'` ;
    - pour chacun de `'0'`, `'31'`, `'abc'`, `'12.5'`, absent → `'10'`.
  - `openfoodfacts.test.ts` :
    - `searchOFF('pastabox', undefined, 30)` appelle une URL qui contient `size=30` ; sans `size`, l'URL ne contient pas `size=` ;
    - `fetchOFFProduct('3242272270157')` sur un produit `{ code: '3242272270157', product_name: 'Sodebo pastabox 330g fusilli a la bolognaise', brands: 'Sodebo', serving_size: '330 g', nutriments: {} }` renvoie `{ status: 'no_nutrition', code: '3242272270157', name: 'Sodebo pastabox 330g fusilli a la bolognaise', brand: 'Sodebo', servingGrams: 330 }`.
- [ ] **Step 2 :** `npx vitest run netlify/tests/off-search.test.ts src/lib/openfoodfacts.test.ts` → échecs attendus.
- [ ] **Step 3 : implémentation**
  - `off-search` : lit `size` (`/^\d+$/`, 1 à 30, sinon 10) et le passe en `page_size`. Mettre à jour le type `NetlifyEvent`.
  - Client : nouveaux paramètres et champs. `code` vaut le code du produit, ou à défaut le code demandé.
- [ ] **Step 4 :** mêmes tests → verts. Puis `npx vitest run src/components/Foods` : les tests existants de `FoodSearch` passent toujours.
- [ ] **Step 5 :** commit `feat(off): taille de recherche et données d'un produit sans valeurs`.

### Task 2: Classement et estimation (`src/lib/similarProducts.ts`)

**Files :**
- Create : `src/lib/similarProducts.ts`
- Test : `src/lib/similarProducts.test.ts`

**Interfaces :**
- Consumes : `searchOFF(term, signal, size)` et `NutritionPer100` (Task 1).
- Produces :
  ```ts
  export interface SimilarTarget { code: string; name: string; brand?: string }
  export interface RankedProduct { food: NormalizedFood; score: number; sameBrand: boolean }
  export interface SimilarEstimate {
    values: NutritionPer100;          // arrondies : kcal entier, le reste au dixième
    used: RankedProduct[];            // 1 à 3
    proximity: 'same-brand' | 'other-brands';
    choices: RankedProduct[];         // 5 au plus, `used` en tête
  }
  export function nameTokens(name: string, brand?: string): string[];
  export function brandFilter(brand?: string): string | null;            // 'brands:"sodebo"'
  export function rankSimilarProducts(target: SimilarTarget, candidates: NormalizedFood[]): RankedProduct[];
  export function estimateFromSimilar(ranked: RankedProduct[]): SimilarEstimate | null;
  export function productOrigin(food: NormalizedFood): string;           // 'Pasta Box fusilli à la bolognaise (Sodebo)'
  export function estimateOrigin(estimate: SimilarEstimate): string;     // 1 produit : productOrigin ; sinon 2 premières marques distinctes jointes par ', '
  export function estimateSource(estimate: SimilarEstimate): string;     // '1 produit proche : …' | '3 produits proches (Sodebo)'
  export function estimateSummary(estimate: SimilarEstimate): string;    // 'D'après le produit le plus proche' | 'Moyenne des 2 produits les plus proches' | 'Médiane des 3 produits les plus proches'
  export function nutritionOf(food: NormalizedFood): NutritionPer100;
  export async function findSimilarProducts(target: SimilarTarget, signal?: AbortSignal): Promise<SimilarEstimate | null>;
  ```

- [ ] **Step 1 : tests en échec** (`describe` par fonction)
  - **`nameTokens`** :
    - `('Sodebo pastabox 330g fusilli a la bolognaise', 'Sodebo')` → `['pastabox', 'fusilli', 'bolognaise']` ;
    - `('Pâtes fraîches Bolognaises 1kg')` → `['pate', 'fraiche', 'bolognaise']` ;
    - `('Sodebo 330g', 'Sodebo')` → `[]` ;
    - un nom de 8 mots significatifs → 6 mots.
  - **`brandFilter`** :
    - `('Sodebo, PastaBOX')` → `'brands:"sodebo"'` ;
    - `('Côté "Snack"')` → `'brands:"côté snack"'` ;
    - `(undefined)` et `('  ')` → `null`.
  - **`rankSimilarProducts`**, sur le jeu réel réduit (constante `PASTABOX_CANDIDATES` du test, valeurs exactes) :
    - même marque : « Pasta Box fusilli à la bolognaise » (code 3242272252054, Sodebo, 123 / 6.7 / 3 / 16) ; « Pastabox fusilli carbonara » (3242272252528, 160 / 5.8 / 7.6 / 17) ; « Pastabox fusilli napolitaine au poulet » (3242272251750, 123 / 6.6 / 2.8 / 17) ; « Pastabox fusilli aux fromages italiens » (3242272251767, 176 / 6.6 / 8.5 / 17) ; « PastaBOX Fusilli Jambon Champignons à la crème » (3242272253754, 147 / 6.7 / 4.8 / 18.4) ; « Dolce Pizza Bolognese » (3242272349150, 183 / 9.6 / 4.6 / 25) ;
    - le produit scanné lui-même (3242272270157, 128 / 7.5 / 2.8 / 17) ;
    - doublon : « Pastabox fusilli carbonara », code 3242272252559, 160 kcal ;
    - fiche incohérente : « Pastabox test », 400 / 1 / 1 / 1 ;
    - autres marques : « Box fusilli bolognaise » (Belle France, 144 / 6.3 / 5.2 / 17) ; « Fusilli bolognaise » (Côté Snack, 140 / 5.6 / 5.1 / 17).
    - Attendus :
      - premier `Pasta Box fusilli à la bolognaise`, score 1,25 (`toBeCloseTo`), `sameBrand: true` ;
      - absents : le scanné, la pizza (aucun mot commun), le doublon, la fiche incohérente ;
      - les deux autres marques après tous les Sodebo, score 0,67 environ.
  - **`estimateFromSimilar`** :
    - sur ce classement : `values` `{ kcal_per_100g: 123, protein_g: 6.7, fat_g: 3, carbs_g: 16, fiber_g: 0 }`, `used.length === 1`, `proximity === 'same-brand'`, `choices.length === 5` ;
    - 3 ex æquo (100, 150, 130) → médiane 130 ;
    - 2 ex æquo (100 / 5.0 et 151 / 6.0) → moyenne 126 kcal (arrondie à l'entier) / 5,5 g ;
    - ex æquo de marques mêlées → `'other-brands'` ;
    - `[]` → `null`.
  - **Textes** :
    - `estimateSource` → `'1 produit proche : Pasta Box fusilli à la bolognaise (Sodebo)'`, puis `'3 produits proches (Sodebo, Auchan)'` ;
    - `estimateSummary` pour 1, 2 et 3 produits (textes de l'interface ci-dessus) ;
    - `estimateOrigin` pour 1 et 3 produits.
  - **`findSimilarProducts`** (mock de `searchOFF` via `vi.mock('./openfoodfacts')`) :
    - appelle `searchOFF('brands:"sodebo" pastabox fusilli bolognaise', signal, 30)` et `searchOFF('pastabox fusilli bolognaise', signal, 30)` ;
    - une recherche rejetée et l'autre qui répond → estimation ;
    - les deux rejetées → `null` ;
    - sans marque → un seul appel ;
    - nom sans mots → `null`, sans appel ;
    - `signal` annulé → l'`AbortError` est propagée.
- [ ] **Step 2 :** `npx vitest run src/lib/similarProducts.test.ts` → échecs.
- [ ] **Step 3 : implémentation**
  - Normalisation : `normalize('NFD')` et retrait des diacritiques pour les mots. La marque de `brandFilter` garde ses accents et est mise en minuscules.
  - Mots accolés deux à deux (« pasta » + « box ») ajoutés à l'ensemble de comparaison du produit trouvé.
  - Doublon : `nameTokens(name).join(' ')` identique et `Math.round(kcal)` identique.
  - Même marque : une des marques du produit (séparées par des virgules) égale à la première marque du produit scanné, comparées en minuscules et sans accents.
  - Médiane valeur par valeur.
- [ ] **Step 4 :** test → vert.
- [ ] **Step 5 :** commit `feat: estimation d'après les produits les plus proches`.

### Task 3: Colonne `values_estimated` et drapeau dans la bibliothèque

**Files :**
- Create : `supabase/migrations/<version>_foods_values_estimated.sql`, `supabase/tests/10_foods_values_estimated.sql`
- Modify : `src/lib/supabase.ts` (`Food.values_estimated?: boolean`), `src/types/food.ts` (`NormalizedFood.estimated?: boolean`), `src/utils/foodLibrary.ts`, `src/services/foods.ts`, `src/components/Foods/useFoodLibrary.ts`
- Test : `src/utils/foodLibrary.test.ts`, `src/services/foods.test.ts`

**Interfaces :**
- Produces :
  - `buildPersonalFoodPayload(userId, values, barcode?, estimated = false)` ajoute `values_estimated: estimated` ;
  - `savePersonalFood(userId, values, barcode?, estimated = false)` ;
  - `library.savePersonal(values, barcode?, estimated = false)` ;
  - `personalFoodToNormalized` met `estimated: true` seulement si `values_estimated` est vrai.

- [ ] **Step 1 : tests en échec**
  - `buildPersonalFoodPayload(...).values_estimated` vaut `false` par défaut, `true` si demandé ;
  - `personalFoodToNormalized({ ..., values_estimated: true }).estimated === true`. Sans la colonne : pas de clé `estimated` ;
  - `savePersonalFood(..., '3242272270157', true)` envoie `values_estimated: true`, à l'insertion comme à la mise à jour par code-barres.
- [ ] **Step 2 :** `npx vitest run src/utils/foodLibrary.test.ts src/services/foods.test.ts` → échecs.
- [ ] **Step 3 : migration**
  - Contenu : `ALTER TABLE public.foods ADD COLUMN IF NOT EXISTS values_estimated boolean NOT NULL DEFAULT false;`, avec un commentaire d'en-tête en français comme les autres migrations.
  - Test SQL 10, au format de `09_tour_and_version.sql` :
    - Alice insère un aliment personnel → `values_estimated` vaut `false` ;
    - elle le passe à `true` → 1 ligne modifiée ;
    - elle tente de modifier l'aliment de Bob → 0 ligne ;
    - en rôle normal, l'aliment de Bob est intact.
- [ ] **Step 4 :** implémenter le TypeScript, puis lancer les tests unitaires, puis la BDD :
  - `pg_ctlcluster 16 main start` ;
  - `PGHOST=localhost PGUSER=postgres PGPASSWORD=postgres npm run test:db` → tout vert, test 10 compris.
- [ ] **Step 5 :**
  - appliquer la migration avec `mcp__Supabase__apply_migration` (nom `foods_values_estimated`) ;
  - renommer le fichier avec la version renvoyée par `list_migrations` ;
  - commit `feat(db): drapeau des valeurs estimées sur les aliments personnels`.

### Task 4: Carte d'estimation dans la recherche

**Files :**
- Create : `src/components/Foods/SimilarEstimateCard.tsx`, `src/components/Foods/SimilarEstimateCard.test.tsx`
- Modify : `src/components/Foods/FoodSearch.tsx`
- Test : `src/components/Foods/FoodSearch.test.tsx`

**Interfaces :**
- Consumes : Task 1 (`no_nutrition` enrichi), Task 2 (`findSimilarProducts`, textes, `nutritionOf`, `productOrigin`).
- Produces :
  - `export interface FoodDraft { barcode: string; name?: string; servingGrams?: number; estimate?: { values: NutritionPer100; source: string }; correction?: boolean }` dans `src/types/food.ts` ;
  - `onCreateFood?: (draft: FoodDraft) => void` ;
  - `SimilarEstimateCard({ estimate, onUse(values: NutritionPer100, source: string), onManual() })`.

- [ ] **Step 1 : tests en échec**
  - **Carte** (estimation construite à partir de produits factices) :
    - section nommée « Estimation pour 100 g » ;
    - « D'après le produit le plus proche », badge « Même marque » ;
    - « ≈ 123 kcal » et « Protéines 6,7 g · Lipides 3 g · Glucides 16 g » ;
    - « Pasta Box fusilli à la bolognaise (Sodebo). À vérifier avec l'étiquette si vous l'avez. » ;
    - « Utiliser l'estimation » → `onUse(values, '1 produit proche : Pasta Box fusilli à la bolognaise (Sodebo)')` ;
    - « Saisir l'étiquette » → `onManual` ;
    - bouton « Ou choisir un produit proche (5) » avec `aria-expanded="false"`. Après clic : `true` et 5 lignes ;
    - « Utiliser les valeurs de « Pastabox fusilli carbonara » » → `onUse({ kcal_per_100g: 160, … }, '1 produit proche : Pastabox fusilli carbonara (Sodebo)')` ;
    - autre marque → badge « Autres marques ».
  - **FoodSearch**, avec `vi.mock('../../lib/similarProducts', …)` qui garde les vraies fonctions de texte et simule `findSimilarProducts` :
    1. Scan d'un produit sans valeurs :
       - « Recherche de produits similaires… » s'affiche ;
       - puis la carte ;
       - `findSimilarProducts` a reçu `{ code: '3017620422003', name: 'Mystère', brand: 'Marque' }`.
    2. « Utiliser l'estimation » → `onCreateFood({ barcode: '3017620422003', name: 'Mystère', servingGrams: 330, estimate: { values, source } })`.
    3. « Saisir l'étiquette » → `onCreateFood({ barcode, name: 'Mystère', servingGrams: 330 })`.
    4. `findSimilarProducts` → `null` ou rejet : « Aucun produit similaire trouvé : créez-le avec les valeurs de l'étiquette. » et « Créer cet aliment ».
    5. Nouveau scan avant la réponse : la première réponse arrive ensuite et n'affiche rien.
    6. Aliment personnel `estimated: true` dans les résultats → badge « Estimé ».
  - Mettre à jour le test existant `garde le nom connu d'un produit sans valeurs nutritionnelles` (il passe par « Créer cet aliment » une fois `findSimilarProducts` → `null`).
- [ ] **Step 2 :** `npx vitest run src/components/Foods` → échecs.
- [ ] **Step 3 : implémentation**
  - État `similar: { status: 'loading' } | { status: 'done'; estimate: SimilarEstimate | null } | null`, remis à `null` comme `barcodeMessage`.
  - La recherche utilise le `AbortController` du scan.
  - Le bouton « Créer cet aliment » d'un produit sans valeurs n'apparaît qu'au repli.
  - La carte et le repli sont rendus sous le message. Ligne de chargement en `role="status"`.
  - Badge « Estimé » : `badge badge-warning`.
- [ ] **Step 4 :** `npx vitest run src/components/Foods` → vert.
- [ ] **Step 5 :** commit `feat(recherche): estimation d'un produit scanné sans valeurs`.

### Task 5: Formulaire pré-rempli, drapeau estimé et correction

**Files :**
- Modify : `src/components/Journal/AddEntryModal.tsx`
- Test : `src/components/Journal/AddEntryModal.test.tsx`

**Interfaces :**
- Consumes :
  - `FoodDraft` et `FoodSearch.onCreateFood` (Task 4) ;
  - `library.savePersonal(values, barcode, estimated)` (Task 3) ;
  - `NormalizedFood.estimated` (Task 3).

- [ ] **Step 1 : tests en échec** (FoodSearch simulé par un bouton qui appelle `onCreateFood` avec un brouillon, comme les tests existants le font pour le scan)
  1. Brouillon avec estimation `{ values: {123, 6.7, 3, 16, 0}, source: '1 produit proche : Pasta Box fusilli à la bolognaise (Sodebo)' }` et `servingGrams: 330` :
     - onglet « Saisie manuelle » ;
     - champs pré-remplis : nom, Quantité 330, base « 100 g (étiquette) » cochée, Calories 123, Protéines 6.7, Lipides 3, Glucides 16 ;
     - « Enregistrer dans mes aliments » coché, code-barres rempli ;
     - bandeau « Valeurs estimées d'après 1 produit proche : Pasta Box fusilli à la bolognaise (Sodebo). Corrigez-les avec l'étiquette si vous l'avez. Le produit sera enregistré dans vos aliments et reconnu au prochain scan. ».
  2. « Ajouter » sans rien changer → `savePersonal(…, '3242272270157', true)`.
  3. Calories changées en 127 → `savePersonal(…, …, false)`.
  4. Base passée à « La quantité indiquée » → `false`.
  5. Brouillon sans estimation → bandeau vert actuel, `savePersonal(…, …, false)`.
  6. « Mes aliments » avec un aliment `estimated: true` → badge « Estimé » dans sa ligne.
  7. Aliment sélectionné `estimated: true` → badge « Estimé » et bouton « Corriger avec l'étiquette ». Clic :
     - formulaire pré-rempli avec ses valeurs et son code-barres ;
     - bandeau « Valeurs estimées : remplacez-les par celles de l'étiquette. ».
- [ ] **Step 2 :** `npx vitest run src/components/Journal/AddEntryModal.test.tsx` → échecs.
- [ ] **Step 3 : implémentation**
  - `handleCreateFood(draft: FoodDraft)` :
    - nom ;
    - quantité `draft.servingGrams ?? 100` ;
    - valeurs `draft.estimate?.values` (sinon valeurs par défaut) ;
    - base `per100`, enregistrement coché, code-barres ;
    - état `manualEstimate` = `draft.estimate ?? null` et `manualCorrection` = `Boolean(draft.correction)`.
  - Réinitialiser ces états partout où `manualFromScan` l'est.
  - À l'envoi, estimé si `manualEstimate` existe, que la base est `per100` et que les 5 valeurs sont strictement égales à celles du brouillon.
  - Correction : `handleCreateFood({ barcode, name, estimate: { values: nutritionOf(food), source: '' }, correction: true })`.
- [ ] **Step 4 :**
  - `npx vitest run src/components/Journal` → vert ;
  - puis `npx vitest run` (toute la suite) → vert.
- [ ] **Step 5 :** commit `feat(saisie): valeurs estimées pré-remplies, badge et correction`.

### Task 6: Version 2.2.0, textes, accessibilité et vérification

**Files :**
- Modify : `package.json`, `package-lock.json`, `CHANGELOG.md`, `README.md`, `src/data/releases.ts`, `src/components/Guide/GuidePage.tsx`, `e2e/accessibility.spec.ts`
- Test : garde existante des notes de version, `e2e/accessibility.spec.ts`

- [ ] **Step 1 : test e2e en échec** `produit scanné sans valeurs : estimation`
  - Routes simulées, déclarées après `mockSupabase` :
    - `**/api/off/product**` → produit 3242272270157 sans nutriments, marque Sodebo, portion 330 g ;
    - `**/api/off/search**` → 3 hits Sodebo cohérents.
  - Parcours :
    - ouvrir « Ajouter un aliment », onglet « Produits supermarché » ;
    - « Scanner un code-barres », remplir « Ou saisissez le code-barres » et valider avec Entrée ;
    - attendre « Estimation pour 100 g » ;
    - déplier la liste ;
    - `expectNoViolations` ;
    - « Utiliser l'estimation » → bandeau « Valeurs estimées » visible ;
    - `expectNoViolations`.
- [ ] **Step 2 :** `npx playwright test e2e/accessibility.spec.ts --trace off -g "estimation"` → échec, puis vert une fois les routes et le parcours ajustés.
- [ ] **Step 3 : textes et version**
  - `npm version minor --no-git-tag-version` → 2.2.0 ;
  - `RELEASES` : entrée 2.2.0 en tête (date `2026-11-22`, les deux textes de la spec) ;
  - CHANGELOG `[2.2.0]` (Nouveautés, Technique : migration, proxy `size`) ;
  - README : version actuelle, fonctionnalité, ligne de migration, test BDD 10 ;
  - Guide, « Noter un repas » : la phrase de la spec.
- [ ] **Step 4 : vérification complète**
  - `npm run lint` ;
  - `npx tsc --noEmit -p tsconfig.app.json` (ou le script `typecheck`) ;
  - `npx vitest run` ;
  - `npm run build` ;
  - `npx playwright test --trace off` ;
  - `npm run test:db`.
  - Tout doit être vert.
- [ ] **Step 5 :** commit `chore: version 2.2.0`, push sur `dev`, PR en brouillon vers `main`, abonnement à la PR et rappel de suivi.
