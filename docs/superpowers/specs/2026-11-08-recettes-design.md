# Recettes (plats maison en parts) — spec

Date : 8 novembre 2026 · Statut : à valider

## Objectif

Permettre d'enregistrer un **plat maison** (ingrédients pesés, partagé en un nombre de parts) et de l'ajouter au journal **en un geste** : « 1 part », « 1,5 part », ou des grammes quand le poids cuit est connu.

### Décisions prises avec l'utilisateur

| Sujet | Décision |
| --- | --- |
| Usage | Plat maison en parts (pas de « repas habituel » détaillé ingrédient par ingrédient) |
| Portions | Nombre de parts obligatoire, poids cuit total facultatif ; au journal : en parts (par demi-part) ou en grammes si le poids cuit est connu |
| Emplacement | 4e onglet « Recettes » dans la fenêtre « Ajouter un aliment » : liste, création, modification, ajout |
| Stockage | Deux tables (`recipes`, `recipe_ingredients`) avec copie des valeurs des ingrédients, enregistrement atomique par une fonction SQL |

## Données

Une migration Supabase.

### `recipes`

| Colonne | Type | Règle |
| --- | --- | --- |
| `id` | `uuid` | clé, `gen_random_uuid()` |
| `user_id` | `uuid` | `profiles(id)`, `ON DELETE CASCADE` |
| `name` | `text` | 1 à 120 caractères (`btrim`) ; unique par compte, sans tenir compte de la casse (`lower(btrim(name))`) |
| `servings` | `integer` | 1 à 50 |
| `cooked_weight_g` | `numeric` | facultatif ; sinon entre 1 et 20 000 |
| `created_at`, `updated_at` | `timestamptz` | `now()` |

### `recipe_ingredients`

| Colonne | Type | Règle |
| --- | --- | --- |
| `id` | `uuid` | clé |
| `recipe_id` | `uuid` | `recipes(id)`, `ON DELETE CASCADE`, indexé |
| `position` | `smallint` | ordre d'affichage, à partir de 0 |
| `label` | `text` | 1 à 160 caractères |
| `qty_g` | `numeric` | supérieur à 0, au plus 5 000 |
| `kcal_per_100g` | `numeric` | 0 à 900 |
| `protein_g`, `fat_g`, `carbs_g` | `numeric` | 0 à 100 (pour 100 g) |
| `fiber_g` | `numeric` | 0 à 100, défaut 0 |

Les valeurs des ingrédients sont une **copie** au moment de l'ajout (comme les favoris) : la recette ne change pas si l'aliment d'origine change.

### Accès (RLS)

- `recipes` : lecture, création, modification et suppression limitées à `user_id = auth.uid()`.
- `recipe_ingredients` : mêmes opérations, autorisées seulement si la recette appartient à l'utilisateur (`EXISTS` sur `recipes`).
- Tout est supprimé avec le compte (cascade depuis `profiles`).

### Enregistrement : `save_recipe`

`save_recipe(p_id uuid, p_name text, p_servings integer, p_cooked_weight_g numeric, p_ingredients jsonb) returns recipes`

- `SECURITY INVOKER` (RLS s'applique), `search_path` fixé, exécution accordée à `authenticated` seulement.
- `p_id` nul : crée la recette pour `auth.uid()` ; sinon met à jour la recette (`updated_at = now()`), et lève `recipe_not_found` si elle n'est pas visible.
- Remplace tous les ingrédients par `p_ingredients` (tableau de `{label, qty_g, kcal_per_100g, protein_g, fat_g, carbs_g, fiber_g}`, la position suit l'ordre du tableau).
- Exige de 1 à 50 ingrédients, sinon lève `recipe_ingredients_count`.
- Tout se passe dans une transaction : en cas d'erreur (contrainte, nom déjà pris, nombre d'ingrédients), rien n'est enregistré.

La suppression d'une recette est un `DELETE` direct sur `recipes` (les ingrédients suivent par cascade).

## Calculs (`src/utils/recipes.ts`)

Fonctions pures. Arrondis comme le reste du journal (`nutritionForQuantity`) : kcal à l'unité, macros au dixième, poids au gramme.

| Fonction | Résultat |
| --- | --- |
| `recipeTotals(ingredients)` | `{ weight_g, kcal, protein_g, fat_g, carbs_g, fiber_g }` : somme des ingrédients (poids cru) |
| `portionByServings(recipe, servings)` | Valeurs = totaux × `servings` / `recipe.servings` ; `qty_grammes` = (`cooked_weight_g` sinon poids cru) × `servings` / `recipe.servings` ; libellé « Nom — 1 part » |
| `portionByGrams(recipe, grams)` | Seulement si `cooked_weight_g` est connu : valeurs = totaux × `grams` / `cooked_weight_g` ; `qty_grammes` = `grams` ; libellé « Nom — 380 g » |
| `recipeEntryLabel(name, portion)` | « Nom — 1 part », « Nom — 1,5 part », « Nom — 2 parts », « Nom — 380 g » (singulier en dessous de 2, nombres à la française) |
| `validateRecipe(draft)` | Premier message d'erreur ou `null` : nom vide ou trop long, parts hors 1 à 50, poids cuit hors 1 à 20 000, aucun ingrédient, plus de 50, quantité d'ingrédient hors 1 à 5 000 |
| `usualRecipeMeal(name, entries)` | Repas le plus fréquent parmi les entrées récentes dont le libellé commence par « Nom — » |

Exemple de référence (tests) : haricots rouges cuits 400 g, bœuf haché 5 % 500 g, tomates concassées 400 g, riz blanc cuit 600 g, 4 parts, poids cuit 1 800 g. 1 part ≈ 491 kcal et 450 g ; 380 g ≈ 415 kcal.

## Journal

Une recette ajoutée devient une **entrée ordinaire** (`entries`) : libellé « Nom — portion », `qty_grammes`, kcal et macros calculés, repas, `food_id` nul. Modifier ou supprimer la recette ne change pas les entrées déjà notées ; tendances, export et suppression du compte fonctionnent sans changement. Comme toute entrée, elle apparaît ensuite dans les « Récents ».

## Écrans

Tout se passe dans la fenêtre « Ajouter un aliment », sans fenêtre supplémentaire : l'onglet « Recettes » affiche trois vues successives.

1. **Liste**
   - Bouton « Nouvelle recette ».
   - Pour chaque recette : nom, nombre de parts, kcal par part, poids cuit s'il est connu ; « Modifier » ; bouton **+** qui ajoute 1 part avec le repas habituel de la recette (sinon sans repas), comme les favoris.
   - Toucher la recette ouvre la vue Ajout.
   - Sans recette : un texte court explique l'usage.
2. **Éditeur** (création ou modification)
   - Nom, nombre de parts (− / +, de 1 à 50), poids cuit facultatif avec l'aide « Pesez la casserole après cuisson pour pouvoir ajouter des grammes ».
   - Ingrédients : nom, quantité modifiable, kcal de la ligne, bouton pour retirer.
   - « Ajouter un ingrédient » ouvre la recherche existante (`FoodSearch` : aliments génériques, produits supermarché, scanner) et « Mes aliments » ; l'aliment choisi est ajouté avec une quantité (100 g par défaut, modifiable).
   - Totaux et valeurs par part mis à jour en direct.
   - « Enregistrer » (validation puis `save_recipe`), « Annuler » ; en modification, « Supprimer la recette » avec confirmation.
3. **Ajout au journal**
   - « En parts » (− / +, par demi-part, de 0,5 à 20) ou « En grammes » (proposé seulement si le poids cuit est connu).
   - Choix du repas (`MealTypeSelector` existant), prérempli avec le repas habituel de la recette.
   - Aperçu : kcal, macros et ligne exacte notée au journal.
   - « Ajouter » appelle le même `onAdd` que les autres onglets.

Les nouveaux écrans utilisent les composants du design system (`Button`, `Field`, classes `card-title`, `section-label`, `panel`).

## Organisation du code

| Fichier | Rôle |
| --- | --- |
| `supabase/migrations/<horodatage>_recipes.sql` | Tables, contraintes, RLS, `save_recipe` |
| `src/lib/supabase.ts` | Types `Recipe`, `RecipeIngredient` |
| `src/utils/recipes.ts` | Calculs, libellés, validation, repas habituel |
| `src/services/recipes.ts` | `fetchRecipes`, `saveRecipe` (RPC), `deleteRecipe` |
| `src/components/Recipes/useRecipes.ts` | Chargement, enregistrement, suppression, erreurs |
| `src/components/Recipes/RecipeList.tsx` | Vue Liste |
| `src/components/Recipes/RecipeEditor.tsx` | Vue Éditeur |
| `src/components/Recipes/RecipePortion.tsx` | Vue Ajout |
| `src/components/Recipes/RecipesTab.tsx` | Enchaînement des trois vues |
| `src/components/Journal/AddEntryModal.tsx` | 4e onglet « Recettes » |

## Erreurs

- Validation avant envoi (`validateRecipe`), messages en français rattachés au formulaire (`role="alert"`).
- Nom déjà utilisé (erreur d'unicité `23505`) : « Vous avez déjà une recette « Nom ». »
- Échec réseau ou serveur : message, la saisie reste à l'écran, on peut réessayer.
- Chargement des recettes en échec : message et bouton « Réessayer ».

## Tests

- **Calculs** (`recipes.test.ts`) : totaux, parts (dont demi-parts), grammes, absence de poids cuit, libellés (singulier et pluriel), arrondis, validation, repas habituel.
- **Composants** : liste (vide, ajout rapide), éditeur (ajout, retrait et modification d'ingrédient, totaux, validation, nom déjà utilisé, suppression), ajout au journal (parts, grammes, sans poids cuit), onglet dans `AddEntryModal`.
- **Base** (`supabase/tests/07_recipes.sql`) : RLS (pas d'accès aux recettes d'un autre compte, ni à leurs ingrédients), contraintes, `save_recipe` (création, mise à jour, remplacement des ingrédients, 0 ou plus de 50 ingrédients refusés sans rien enregistrer, nom en double refusé), cascade à la suppression du compte.
- **Accessibilité** : l'onglet Recettes et l'éditeur ajoutés au contrôle axe de la CI (Supabase simulé avec une recette de démonstration).

## Hors périmètre

- Ajouter une recette ingrédient par ingrédient (« repas habituel détaillé »).
- Partage, photos, import depuis un site.
- Recettes dans les résultats de la recherche d'aliments.
- Mise à jour des entrées passées quand une recette change.

## Critères d'acceptation

- Créer, modifier et supprimer une recette depuis l'onglet « Recettes ».
- Ajouter une recette au journal en parts (par demi-part) et en grammes quand le poids cuit est connu ; les valeurs correspondent à l'exemple de référence.
- Une recette ne peut jamais être enregistrée à moitié ; un autre compte ne voit jamais tes recettes.
- Tous les tests, le contrôle axe et les garde-fous du design system sont verts.
