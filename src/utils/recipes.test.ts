import { describe, expect, it } from 'vitest';
import type { Entry } from '../lib/supabase';
import { CHILI_INGREDIENTS } from '../test/fixtures';
import {
  portionByGrams,
  portionByServings,
  recipeEntryLabel,
  recipePortion,
  recipeTotals,
  recipeToDraft,
  RecipeDraft,
  usualRecipeMeal,
  validateRecipe,
} from './recipes';

// Recette de référence de la spec : chili maison, 4 parts, 1 800 g cuit
const chili: RecipeDraft = { name: 'Chili maison', servings: 4, cooked_weight_g: 1800, ingredients: CHILI_INGREDIENTS };

describe('recipeTotals', () => {
  it('additionne les ingrédients (poids cru)', () => {
    expect(recipeTotals(chili.ingredients)).toEqual({
      weight_g: 1900,
      kcal: 1965,
      protein_g: 160.8,
      fat_g: 29.6,
      carbs_g: 244,
      fiber_g: 33.2,
    });
  });

  it('vaut zéro sans ingrédient', () => {
    expect(recipeTotals([])).toEqual({ weight_g: 0, kcal: 0, protein_g: 0, fat_g: 0, carbs_g: 0, fiber_g: 0 });
  });
});

describe('portionByServings', () => {
  it('donne les valeurs d’une part et son poids cuit', () => {
    expect(portionByServings(chili, 1)).toEqual({
      label: 'Chili maison — 1 part',
      qty_grammes: 450,
      kcal: 491,
      protein_g: 40.2,
      fat_g: 7.4,
      carbs_g: 61,
      fiber_g: 8.3,
    });
  });

  it('gère les demi-parts', () => {
    const portion = portionByServings(chili, 1.5);
    expect(portion.kcal).toBe(737);
    expect(portion.qty_grammes).toBe(675);
    expect(portion.label).toBe('Chili maison — 1,5 part');
  });

  it('répartit le poids cru quand le poids cuit est inconnu', () => {
    expect(portionByServings({ ...chili, cooked_weight_g: null }, 1).qty_grammes).toBe(475);
  });
});

describe('portionByGrams', () => {
  it('calcule les valeurs au gramme à partir du poids cuit', () => {
    const portion = portionByGrams(chili, 380);
    expect(portion).toMatchObject({ label: 'Chili maison — 380 g', qty_grammes: 380, kcal: 415, protein_g: 33.9 });
  });

  it('est impossible sans poids cuit', () => {
    expect(portionByGrams({ ...chili, cooked_weight_g: null }, 380)).toBeNull();
  });
});

describe('recipePortion', () => {
  it('choisit le calcul selon le mode', () => {
    expect(recipePortion(chili, { mode: 'servings', servings: 2 })?.kcal).toBe(983);
    expect(recipePortion(chili, { mode: 'grams', grams: 380 })?.kcal).toBe(415);
    expect(recipePortion({ ...chili, cooked_weight_g: null }, { mode: 'grams', grams: 380 })).toBeNull();
  });
});

describe('recipeEntryLabel', () => {
  it('accorde « part » et écrit les nombres à la française', () => {
    expect(recipeEntryLabel('Chili maison', { mode: 'servings', servings: 1 })).toBe('Chili maison — 1 part');
    expect(recipeEntryLabel('Chili maison', { mode: 'servings', servings: 0.5 })).toBe('Chili maison — 0,5 part');
    expect(recipeEntryLabel('Chili maison', { mode: 'servings', servings: 1.5 })).toBe('Chili maison — 1,5 part');
    expect(recipeEntryLabel('Chili maison', { mode: 'servings', servings: 2 })).toBe('Chili maison — 2 parts');
    expect(recipeEntryLabel('Chili maison', { mode: 'grams', grams: 380 })).toBe('Chili maison — 380 g');
  });
});

describe('validateRecipe', () => {
  it('accepte une recette complète', () => {
    expect(validateRecipe(chili)).toBeNull();
    expect(validateRecipe({ ...chili, cooked_weight_g: null })).toBeNull();
  });

  it('signale le premier problème', () => {
    expect(validateRecipe({ ...chili, name: '   ' })).toBe('Donnez un nom à la recette.');
    expect(validateRecipe({ ...chili, name: 'x'.repeat(121) })).toBe('Le nom de la recette ne doit pas dépasser 120 caractères.');
    expect(validateRecipe({ ...chili, servings: 0 })).toBe('Le nombre de parts doit être compris entre 1 et 50.');
    expect(validateRecipe({ ...chili, servings: 51 })).toBe('Le nombre de parts doit être compris entre 1 et 50.');
    expect(validateRecipe({ ...chili, cooked_weight_g: 0 })).toBe('Le poids cuit doit être compris entre 1 et 20 000 g.');
    expect(validateRecipe({ ...chili, ingredients: [] })).toBe('Ajoutez au moins un ingrédient.');
    expect(validateRecipe({ ...chili, ingredients: Array(51).fill(chili.ingredients[0]) })).toBe(
      'Une recette compte au plus 50 ingrédients.'
    );
    expect(validateRecipe({ ...chili, ingredients: [{ ...chili.ingredients[0], qty_g: 0 }] })).toBe(
      'La quantité de chaque ingrédient doit être comprise entre 1 et 5 000 g.'
    );
    expect(validateRecipe({ ...chili, ingredients: [{ ...chili.ingredients[0], qty_g: Number.NaN }] })).toBe(
      'La quantité de chaque ingrédient doit être comprise entre 1 et 5 000 g.'
    );
  });
});

describe('usualRecipeMeal', () => {
  const entry = (label: string, meal_type?: Entry['meal_type']) => ({ label, meal_type }) as Entry;

  it('reprend le repas le plus fréquent de la recette', () => {
    const entries = [
      entry('Chili maison — 1 part', 'dinner'),
      entry('Chili maison — 380 g', 'lunch'),
      entry('Chili maison — 2 parts', 'dinner'),
      entry('Chili con carne', 'breakfast'),
    ];
    expect(usualRecipeMeal('Chili maison', entries)).toBe('dinner');
  });

  it('ne propose rien sans entrée de la recette', () => {
    expect(usualRecipeMeal('Chili maison', [entry('Riz', 'lunch')])).toBeUndefined();
  });
});

describe('recipeToDraft', () => {
  it('reprend la recette avec les ingrédients dans l’ordre', () => {
    const draft = recipeToDraft({
      id: 'r1',
      user_id: 'u1',
      name: 'Chili maison',
      servings: 4,
      cooked_weight_g: 1800,
      created_at: '',
      updated_at: '',
      recipe_ingredients: [
        { id: 'i2', recipe_id: 'r1', position: 1, ...chili.ingredients[1] },
        { id: 'i1', recipe_id: 'r1', position: 0, ...chili.ingredients[0] },
      ],
    });
    expect(draft).toEqual({ id: 'r1', name: 'Chili maison', servings: 4, cooked_weight_g: 1800, ingredients: chili.ingredients.slice(0, 2) });
  });
});
