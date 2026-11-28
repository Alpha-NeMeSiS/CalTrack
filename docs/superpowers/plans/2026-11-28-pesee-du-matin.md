# Pesée du matin — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enregistrer le moment de chaque pesée (matin à jeun ou plus tard) et n'utiliser que les pesées de référence pour le suivi (profil, besoins, objectif, moyenne de la courbe, dépense réelle).

**Architecture:** Une colonne `moment` sur `weight_logs` (défaut `morning`, une pesée par jour inchangée). La règle « quelles pesées comptent » est une fonction pure de `weights.ts` (`referenceWeights`), utilisée par `recordWeight` (profil), la carte « Ma pesée », la courbe et `estimateExpenditure`. La carte gère le choix du moment et refuse qu'une pesée « plus tard » remplace celle du matin.

**Tech Stack:** React 18 + TypeScript, Supabase (PostgreSQL), Vitest + Testing Library, tests SQL (`npm run test:db`), Playwright + axe.

**Spec:** `docs/superpowers/specs/2026-11-28-pesee-du-matin-design.md`

## Global Constraints

- Valeurs du moment en base et en code : `'morning'` et `'later'` ; une pesée sans moment (ancienne, maquette de test) vaut `'morning'`.
- Textes exacts : légende « Moment de la pesée » ; options « Le matin, à jeun » et « Plus tard dans la journée » ; aide « Le matin, à jeun, après être passé aux toilettes : c'est la pesée la plus fiable. »
- Rappel : « Pesée de ce jour : 68,1 kg, le matin à jeun » / « …, plus tard dans la journée ».
- Refus : « Votre pesée du matin (66,1 kg) reste celle de ce jour. Pour la corriger, choisissez « Le matin, à jeun ». »
- Pesée hors suivi : « Pesée enregistrée. Elle reste hors suivi : la pesée du matin sert de référence. »
- Fenêtre de repli : une pesée « plus tard » compte s'il n'y a aucune pesée du matin dans les **14 jours** qui la précèdent.
- Choix d'office : aujourd'hui, avant 12 h → matin, sinon plus tard ; jour passé → moment de la pesée du jour, sinon matin.
- Migration jamais modifiée après application ; nom de fichier = version enregistrée par Supabase.
- Version **2.4.0** ; « Copier un repas » passe en 2.5.0.

## Review Focus

- **Pesée « plus tard » avec le même poids que la pesée du matin du jour** : ce n'est pas un refus, c'est une correction du moment.
- **Anciennes pesées et maquettes sans champ `moment`** (`undefined`/`null`) : traitées comme pesées du matin partout (filtre, rappel, choix d'office).
- **Personne qui ne se pèse que le soir** : toutes ses pesées comptent (fenêtre de 14 jours), le profil suit.
- **Pesée « plus tard » aujourd'hui alors qu'hier a une pesée du matin** : le profil reste sur la pesée du matin, aucune écriture inutile si le poids du profil est déjà le bon.
- **Pesée antidatée** : ne touche pas au profil (comportement actuel conservé).

---

### Task 1: Règles pures des pesées de référence

**Files:**
- Modify: `frontend/features/weight/weights.ts`
- Test: `frontend/features/weight/weights.test.ts`

**Interfaces:**
- Produces:
  - `export type WeighInMoment = 'morning' | 'later'`
  - `WeightPoint` gagne `moment?: WeighInMoment | null`
  - `export const REFERENCE_FALLBACK_DAYS = 14`
  - `export function momentOf(point: { moment?: WeighInMoment | null }): WeighInMoment` (absent → `'morning'`)
  - `export function referenceWeights<T extends WeightPoint>(points: readonly T[]): T[]` (triées comme `sortWeights`)
  - `export function suggestMoment(options: { isToday: boolean; hour: number; existing?: { moment?: WeighInMoment | null } | null }): WeighInMoment`

- [ ] **Step 1: Tests qui échouent** (`describe('pesées de référence')`)
  - `momentOf({})` → `'morning'` ; `momentOf({ moment: null })` → `'morning'` ; `momentOf({ moment: 'later' })` → `'later'`.
  - matin le 20/11 (66,1) + plus tard le 21/11 (68,1) → seule la pesée du 20/11.
  - plus tard le 21/11 sans pesée du matin entre le 07/11 et le 20/11 → gardée ; avec une pesée du matin le 07/11 (pile 14 jours avant) → écartée ; le 06/11 → gardée.
  - que des pesées « plus tard » → toutes gardées, triées par date.
  - pesées sans `moment` → gardées.
  - `suggestMoment({ isToday: true, hour: 11 })` → `'morning'` ; `hour: 12` → `'later'` ; aujourd'hui à 20 h avec une pesée du matin → `'later'` ; jour passé avec pesée `'later'` → `'later'` ; jour passé sans pesée → `'morning'`.
- [ ] **Step 2:** `npx vitest run frontend/features/weight/weights.test.ts` → échec (fonctions absentes).
- [ ] **Step 3:** implémenter dans `weights.ts` (`referenceWeights` : `sortWeights`, puis pour une pesée `later` à la date D, l'écarter s'il existe une pesée du matin de date dans `[D − 14 j, D[`, via `addDaysToDateString`).
- [ ] **Step 4:** même commande → vert.
- [ ] **Step 5:** commit `feat(weight): pesées de référence et moment proposé`.

### Task 2: Base de données et service

**Files:**
- Create: `backend/supabase/migrations/<version>_weigh_in_moment.sql`
- Create: `backend/supabase/tests/12_weigh_in_moment.sql`
- Modify: `frontend/shared/supabase.ts` (`WeightLog`), `frontend/features/weight/weights.service.ts`
- Test: `frontend/features/weight/weights.service.test.ts`

**Interfaces:**
- Consumes: `WeighInMoment`, `referenceWeights`, `getLatestWeight`, `REFERENCE_FALLBACK_DAYS` (Task 1).
- Produces:
  - `WeightLog.moment: WeighInMoment`
  - `upsertWeightLog(userId, date, weightKg, composition = {}, moment?: WeighInMoment)` — `moment` envoyé seulement s'il est fourni.
  - `recordWeight({ …, moment = 'morning' })` → `Promise<boolean>` (vrai si le profil a changé).

- [ ] **Step 1: Test SQL qui échoue** (`12_weigh_in_moment.sql`, sur le modèle de `04_weigh_in.sql`) :
  - insertion sans `moment` → `'morning'` ;
  - `'evening'` refusé (contrainte, via `test.throws` ou bloc `EXCEPTION` comme `03_constraints.sql`) ;
  - upsert du même jour sans `moment` → moment conservé (`'later'` reste `'later'`) ;
  - upsert avec `moment = 'later'` → moment changé.
- [ ] **Step 2:** `npm run test:db` → échec (colonne absente).
- [ ] **Step 3: Migration** : `ALTER TABLE public.weight_logs ADD COLUMN IF NOT EXISTS moment text NOT NULL DEFAULT 'morning' CONSTRAINT weight_logs_moment_check CHECK (moment IN ('morning', 'later'));` + commentaire de colonne. Idempotente.
- [ ] **Step 4:** `npm run test:db` → vert.
- [ ] **Step 5: Tests du service qui échouent** (`weights.service.test.ts`) :
  - `upsertWeightLog(…, {}, 'later')` envoie `moment: 'later'` ; sans moment, la clé est absente de l'envoi.
  - `recordWeight` avec `moment: 'later'`, pesée du matin la veille à 66,1 et profil à 66,1 → retourne `false`, aucun `update` de `profiles`.
  - même cas, profil à 68,1 → profil mis à 66,1, composition saisie **non** recopiée, retourne `true`.
  - `moment: 'later'` sans pesée du matin dans les 14 jours → profil mis au poids saisi (comme une pesée du matin).
  - les tests existants (pesée du matin la plus récente, pesée antidatée) restent verts.
- [ ] **Step 6:** `npx vitest run frontend/features/weight/weights.service.test.ts` → échec.
- [ ] **Step 7:** implémenter : `recordWeight` relit les pesées depuis `date − 14 j` ; si la plus récente (tous moments) n'est pas celle du jour enregistré → `false` ; sinon `reference = getLatestWeight(referenceWeights(logs))` ; si `reference.date !== date` et `reference.weight_kg === profile.poids_kg` → `false` ; sinon profil et cible du jour au poids de référence, composition seulement si `reference.date === date`.
- [ ] **Step 8:** même commande → vert ; `npm run typecheck` (le type `WeightLog` change : corriger les maquettes de test qui construisent des `WeightLog`).
- [ ] **Step 9: Appliquer en production** : `apply_migration` (nom `weigh_in_moment`), relire `list_migrations`, renommer le fichier avec la version enregistrée, vérifier la colonne (`information_schema.columns`). Sans risque pour la 2.3.0 en ligne (elle n'envoie pas `moment`).
- [ ] **Step 10:** commit `feat(db): moment de la pesée (matin ou plus tard)`.

### Task 3: Carte « Ma pesée »

**Files:**
- Modify: `frontend/features/weight/WeightQuickLog.tsx`, `frontend/features/journal/Dashboard.tsx`, `frontend/features/profile/ProfilePage.tsx`
- Test: `frontend/features/weight/WeightQuickLog.test.tsx` (+ ajuster `Dashboard.test.tsx` / `ProfilePage.test.tsx` si elles vérifient `onSave`/`recordWeight`)

**Interfaces:**
- Consumes: `momentOf`, `referenceWeights`, `suggestMoment` (Task 1) ; `recordWeight({ moment })` (Task 2).
- Produces: `onSave: (weightKg: number, date: string, moment: WeighInMoment, composition?: BodyComposition) => Promise<void>`.

- [ ] **Step 1: Tests qui échouent** (heure fixée avec `vi.setSystemTime`) :
  - groupe radio « Moment de la pesée », option « Le matin, à jeun » cochée à 8 h, « Plus tard dans la journée » à 19 h ; l'aide est affichée.
  - jour passé avec pesée `'later'` → « Plus tard dans la journée » cochée ; rappel « Pesée de ce jour : 68,1 kg, plus tard dans la journée ».
  - enregistrement : `onSave(80.4, yesterday, 'morning')` ; avec composition : `onSave(79.6, today, 'morning', {…})`.
  - aujourd'hui à 20 h, pesée du matin du jour à 66,1, saisie 68 → message de refus exact, `onSave` non appelé.
  - même situation, champ vide, « Plus tard » choisi → bouton « Mettre à jour » actif, `onSave(66.1, today, 'later')`.
  - « Dernière : » et « sur 7 jours » ignorent une pesée « plus tard » hors suivi.
  - après une pesée « plus tard » hors suivi (logs rechargés), message « Pesée enregistrée. Elle reste hors suivi : la pesée du matin sert de référence. »
- [ ] **Step 2:** `npx vitest run frontend/features/weight/WeightQuickLog.test.tsx` → échec.
- [ ] **Step 3:** implémenter : état `moment` resynchronisé (`useEffect`) quand la date ou la pesée du jour change ; `fieldset`/`legend` + 2 radios (attribut `form="weight-quick-log-form"`), placé sous la ligne de saisie ; type de message `'info'` (rôle `status`) pour le refus ; `Dashboard` et `ProfilePage` passent `moment` à `recordWeight`.
- [ ] **Step 4:** même commande + `npx vitest run frontend/features/journal frontend/features/profile` → vert.
- [ ] **Step 5:** commit `feat(weight): choix du moment de la pesée`.

### Task 4: Courbe et dépense réelle

**Files:**
- Modify: `frontend/features/stats/WeightChart.tsx`, `frontend/features/stats/insights.ts`
- Test: `frontend/features/stats/WeightChart.test.tsx`, `frontend/features/stats/insights.test.ts`

**Interfaces:**
- Consumes: `referenceWeights`, `momentOf` (Task 1).

- [ ] **Step 1: Tests qui échouent** :
  - `estimateExpenditure` : avec des pesées du matin régulières, ajouter des pesées « plus tard » 2 kg plus haut ne change pas `weeklyWeightChangeKg` ni `weighIns`.
  - `WeightChart` : une pesée « plus tard » hors suivi est dessinée (cercle, `title` « 21 nov. : 68,1 kg, plus tard (hors suivi) »), la légende « Plus tard, hors suivi » apparaît seulement dans ce cas ; la moyenne n'en tient pas compte.
- [ ] **Step 2:** `npx vitest run frontend/features/stats` → échec.
- [ ] **Step 3:** implémenter : `estimateExpenditure` filtre avec `referenceWeights` avant la fenêtre ; dans la courbe, moyenne sur `referenceWeights(sorted)`, pesées de référence en point plein (`fill-brand-700`), pesées hors suivi en point creux (`fill-surface`, trait en pointillés), légende mise à jour (« Pesées » plein).
- [ ] **Step 4:** même commande → vert.
- [ ] **Step 5:** commit `feat(stats): seules les pesées de référence comptent dans la courbe et la dépense`.

### Task 5: Version 2.4.0, docs et vérifications

**Files:**
- Modify: `package.json`, `package-lock.json`, `CHANGELOG.md`, `frontend/features/whats-new/releaseNotes.ts`, `frontend/app/navigation.test.ts`, `frontend/features/guide/GuidePage.tsx`, `README.md`, `docs/CONTEXTE-AGENT.md`, `docs/ARCHITECTURE.md` (si `weight_logs` y est décrit), `e2e/accessibility.spec.ts`

- [ ] **Step 1:** test de version `2.4.0 (pesée du matin)` → échec, puis `npm version 2.4.0 --no-git-tag-version` → vert.
- [ ] **Step 2:** notes « Quoi de neuf ? » 2.4.0, CHANGELOG, Guide (paragraphe « Ma pesée » : moment, ce qui compte, correction d'une ancienne pesée), README, CONTEXTE-AGENT (production 2.3.0, 2.4.0 en PR, « Copier un repas » en 2.5.0, migration appliquée).
- [ ] **Step 3:** e2e : sur le tableau de bord, le groupe « Moment de la pesée » est présent et l'analyse axe passe.
- [ ] **Step 4:** `npm run lint && npm run typecheck && npm test && npm run build && npm run test:a11y -- --trace off && npm run test:db` → tout vert.
- [ ] **Step 5:** commit `release: 2.4.0 — pesée du matin`, push `dev`, PR brouillon vers `main`, abonnement à la PR et rappel.
