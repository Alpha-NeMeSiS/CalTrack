# Ajouts à la suite — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** la fenêtre « Ajouter un aliment » reste ouverte après chaque ajout réussi, affiche une confirmation, se remet à zéro pour l'aliment suivant en gardant le repas, et se ferme avec la croix.

**Architecture :**
- `submitEntry` (`AddEntryModal`) ne ferme plus la fenêtre. Après un succès, il enregistre la confirmation et le dernier repas utilisé.
- Chaque gestionnaire d'onglet remet sa saisie à zéro quand `submitEntry` renvoie `true`.
- `RecipesTab` revient à sa liste et utilise le dernier repas.
- `FoodSearch` gagne une prop pour reprendre le focus.

**Tech stack :** React 18 + TS, Vitest + Testing Library, Playwright + axe.

**Spec :** `docs/superpowers/specs/2026-11-17-ajouts-a-la-suite-design.md`

## Global Constraints

- Texte de confirmation exact : `✓ ${label} ajouté · ${repas} · ${kcal} kcal`. Sans repas : `✓ ${label} ajouté · ${kcal} kcal`. `kcal` est arrondi à l'entier et `repas` = `getMealLabel(preferences, meal)`.
- La confirmation est un `<p role="status">` placé au-dessus du contenu de l'onglet.
- Aucun nouveau bouton : la fermeture reste la croix (« Fermer la fenêtre »), Échap et le clic sur le fond.
- Les messages d'erreur existants (`ADD_ERROR`, erreurs « Mes aliments ») ne changent pas.

## Review Focus

1. **Échec après un succès** : la confirmation précédente disparaît, et seul le message d'erreur reste (pas de « ✓ ajouté » à côté de « L'ajout a échoué »). → test tâche 1.
2. **Double clic sur « Ajouter »** : après un succès, la sélection est vidée, « Ajouter » est désactivé, et un second clic n'ajoute rien. → test tâche 1.
3. **Changement d'onglet** : il efface la confirmation. → test tâche 1.
4. **Croix après plusieurs ajouts** : `onClose` est appelé une fois, et `onAdd` autant de fois qu'il y a eu d'ajouts. → test tâche 1.
5. **Recette ajoutée en portion, puis une autre** : on revient à la liste, et le repas de la portion suivante est celui du dernier ajout. → test tâche 2.

---

### Task 1: la fenêtre reste ouverte (Recherche, ajout rapide, saisie manuelle)

**Fichiers :**
- Modifier : `src/components/Journal/AddEntryModal.tsx` (`submitEntry`, `selectFood`, `handleSearchSubmit`, `handleManualSubmit`, `handleCreateFood`, `switchTab`, rendu)
- Modifier : `src/components/Foods/FoodSearch.tsx` (prop `focusKey`)
- Test : `src/components/Journal/AddEntryModal.test.tsx`

**Interfaces :**
- Produit, dans `AddEntryModal` :
  - l'état `lastAdded: { label: string; kcal: number; meal?: MealType } | null` ;
  - l'état `lastMeal: MealType | undefined` ;
  - `submitEntry(entry): Promise<boolean>` (signature inchangée, sans `onClose`).
- Produit : `FoodSearch` prop `focusKey?: number`. Quand elle change (et n'est pas `undefined`), le champ de recherche reçoit le focus.
- Produit : `RecipesTab` reçoit `lastMeal?: MealType` (utilisé en tâche 2).

- [ ] **Étape 1 : tests qui échouent** (`AddEntryModal.test.tsx`)
  - Le test « ajoute une saisie manuelle puis ferme la fenêtre » devient « ajoute une saisie manuelle et reste ouverte ». Il vérifie que `onClose` n'est pas appelé, que `getByRole('status')` contient `✓ <libellé> ajouté` et `kcal`, et que le champ nom est vide.
  - Le test « ajoute un aliment récent en un tap… » vérifie `onClose` non appelé et une confirmation contenant le libellé et le nom du repas.
  - Nouveau : recherche → sélection → « Ajouter ». `onClose` n'est pas appelé, la carte de l'aliment choisi a disparu, le bouton « Ajouter » est désactivé (Review Focus 2), et la confirmation est affichée.
  - Nouveau : repas gardé. Premier ajout avec « Déjeuner » choisi, puis sélection d'un autre aliment dont le repas habituel est différent : le repas sélectionné est « Déjeuner ».
  - Nouveau (Review Focus 1) : un ajout réussi, puis `onAdd` qui renvoie `false` ; l'alerte d'erreur est affichée et `queryByRole('status')` est absent.
  - Nouveau (Review Focus 3) : après un ajout, passer à l'onglet « Saisie manuelle » efface la confirmation.
  - Nouveau (Review Focus 4) : deux ajouts rapides puis la croix « Fermer la fenêtre » ; `onAdd` est appelé 2 fois et `onClose` 1 fois.

- [ ] **Étape 2 : vérifier l'échec**
  Commande : `npx vitest run src/components/Journal/AddEntryModal.test.tsx`
  Attendu : les tests ci-dessus échouent (la fenêtre se ferme encore, pas de `role="status"`).

- [ ] **Étape 3 : implémenter**
  - **`submitEntry`** : au succès, `setLastAdded({ label: entry.label, kcal: entry.kcal, meal: entry.meal_type })` et `setLastMeal(entry.meal_type)`, sans `onClose`. À l'échec (`false` ou exception), `setLastAdded(null)` en plus de l'erreur.
  - **`switchTab`** : `setLastAdded(null)`.
  - **`selectFood`** : le repas devient `lastMeal ?? meal ?? usual?.usualMeal`.
  - **`handleSearchSubmit`** : si `submitEntry` renvoie `true`, `setSelectedFood(null)`, `setQuantity(100)` et incrémenter `searchFocusKey` (passé à `FoodSearch` comme `focusKey`). `mealType` n'est pas remis à zéro.
  - **`handleManualSubmit`** : si `true`, `setManualForm({ ...defaultManualForm, meal_type: entry.meal_type })`, `setManualSubmitAttempted(false)` et `resetManualExtras()`.
  - **`handleCreateFood`** : le formulaire pré-rempli prend `meal_type: lastMeal`.
  - **Rendu** : `<p role="status" className="rounded-md border border-success-200 bg-success-50 px-3 py-2 text-sm text-success-800">` au-dessus du contenu de l'onglet, seulement si `lastAdded`.
  - **`RecipesTab`** : reçoit `lastMeal={lastMeal}`.

- [ ] **Étape 4 : vérifier la réussite**
  Commande : `npx vitest run src/components/Journal src/components/Foods`
  Attendu : PASS.

- [ ] **Étape 5 : commit**
  `git add src/components/Journal src/components/Foods && git commit` avec le message « Ajouter un aliment : la fenêtre reste ouverte après l'ajout, confirmation et repas gardé ».

### Task 2: recettes

**Fichiers :**
- Modifier : `src/components/Recipes/RecipesTab.tsx`
- Test : `src/components/Recipes/Recipes.test.tsx`

**Interfaces :**
- Consomme : `RecipesTab` prop `lastMeal?: MealType` (tâche 1).

- [ ] **Étape 1 : test qui échoue** (Review Focus 5). Rendre `RecipesTab` avec une recette, `onAdd` résolu à `true` et `lastMeal="lunch"` ; choisir la recette (vue portion) puis l'ajouter. Vérifier :
  - `onAdd` est appelé avec `meal_type: 'lunch'` ;
  - la liste des recettes est de nouveau affichée (le bouton de la recette est présent, « Retour aux recettes » est absent).
- [ ] **Étape 2 : vérifier l'échec** : `npx vitest run src/components/Recipes`, le test échoue.
- [ ] **Étape 3 : implémenter**
  - En vue portion, `defaultMeal={lastMeal ?? usualRecipeMeal(...)}` ;
  - `onAdd` est enveloppé : `const ok = await onAdd(entry); if (ok) setView({ name: 'list' }); return ok;`.
  - L'ajout rapide depuis la liste reste inchangé.
- [ ] **Étape 4 : vérifier la réussite** : `npx vitest run src/components/Recipes src/components/Journal`, PASS.
- [ ] **Étape 5 : commit** avec le message « Recettes : retour à la liste après l'ajout, repas du dernier ajout proposé ».

### Task 3: accessibilité, doc, vérification, PR

**Fichiers :**
- Modifier : `e2e/accessibility.spec.ts` (test « ajout d'un aliment »)
- Modifier : `README.md` (fonctionnalités, ligne sur l'ajout à la suite)

- [ ] **Étape 1 : e2e.** Dans le test « ajout d’un aliment », après l'ouverture : onglet « Saisie manuelle », remplir nom, quantité et calories, puis « Ajouter ». Vérifier :
  - `getByRole('status')` contient `ajouté` ;
  - la fenêtre « Ajouter un aliment » est toujours visible ;
  - `expectNoViolations(page)` passe.
  Ensuite « Fermer la fenêtre » ferme la fenêtre. Si le Supabase simulé ne gère pas l'insertion dans `entries`, l'y ajouter dans `e2e/fixtures/supabase.ts`.
- [ ] **Étape 2 : README.** Dans « Fonctionnalités », ajouter : « Ajout de plusieurs aliments à la suite : la fenêtre reste ouverte (confirmation, repas gardé) et se ferme avec la croix. »
- [ ] **Étape 3 : vérification complète.** Lancer `npm run lint`, `npm run typecheck`, `npx vitest run`, `npm run build` et `npx playwright test --trace off`. Tout doit passer.
- [ ] **Étape 4 : captures** (mobile, clair et sombre) de la confirmation après un ajout. Script temporaire hors du dépôt, envoyé à l'utilisateur.
- [ ] **Étape 5 : commit, push sur `dev`, PR brouillon vers `main`**, puis abonnement à la PR et vérification programmée.
