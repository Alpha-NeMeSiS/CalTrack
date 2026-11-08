import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getOperationArgs, supabaseMock } from '../test/supabaseMock';
import { CHILI_INGREDIENTS, makeRecipe } from '../test/fixtures';
import { deleteRecipe, fetchRecipes, recipeErrorMessage, saveRecipe } from './recipes';

vi.mock('../lib/supabase', async () => {
  const { fakeSupabase } = await import('../test/supabaseMock');
  return { supabase: fakeSupabase };
});

beforeEach(() => {
  supabaseMock.reset();
});

describe('services/recipes', () => {
  it('lit les recettes du compte avec leurs ingrédients, par nom', async () => {
    supabaseMock.setHandler(() => ({ data: [makeRecipe()], error: null }));
    const recipes = await fetchRecipes('user-1');

    expect(recipes).toHaveLength(1);
    const [call] = supabaseMock.calls;
    expect(call.table).toBe('recipes');
    expect(getOperationArgs(call, 'select')).toEqual(['*, recipe_ingredients(*)']);
    expect(call.operations).toContainEqual({ method: 'eq', args: ['user_id', 'user-1'] });
    expect(getOperationArgs(call, 'order')).toEqual(['name', { ascending: true }]);
  });

  it('enregistre une recette en une seule opération (save_recipe)', async () => {
    supabaseMock.setHandler(() => ({ data: makeRecipe({ recipe_ingredients: [] }), error: null }));
    await saveRecipe({ name: '  Chili maison ', servings: 4, cooked_weight_g: null, ingredients: CHILI_INGREDIENTS });

    const [call] = supabaseMock.calls;
    expect(call.table).toBe('rpc:save_recipe');
    expect(getOperationArgs(call, 'rpc')).toEqual([
      {
        p_id: null,
        p_name: 'Chili maison',
        p_servings: 4,
        p_cooked_weight_g: null,
        p_ingredients: CHILI_INGREDIENTS,
      },
    ]);
  });

  it('transmet l’identifiant pour une modification', async () => {
    supabaseMock.setHandler(() => ({ data: makeRecipe(), error: null }));
    await saveRecipe({ id: 'recipe-1', name: 'Chili maison', servings: 6, cooked_weight_g: 1800, ingredients: CHILI_INGREDIENTS });
    expect(getOperationArgs(supabaseMock.calls[0], 'rpc')?.[0]).toMatchObject({ p_id: 'recipe-1', p_servings: 6, p_cooked_weight_g: 1800 });
  });

  it('fait remonter l’erreur de la base', async () => {
    supabaseMock.setHandler(() => ({ data: null, error: { code: '23505', message: 'duplicate key' } }));
    await expect(saveRecipe({ name: 'Chili', servings: 1, cooked_weight_g: null, ingredients: CHILI_INGREDIENTS })).rejects.toMatchObject({
      code: '23505',
    });
  });

  it('supprime une recette', async () => {
    supabaseMock.setHandler(() => ({ data: null, error: null }));
    await deleteRecipe('recipe-1');
    const [call] = supabaseMock.calls;
    expect(call.table).toBe('recipes');
    expect(call.operations.map((op) => op.method)).toContain('delete');
    expect(call.operations).toContainEqual({ method: 'eq', args: ['id', 'recipe-1'] });
  });

  it('traduit les erreurs en messages', () => {
    expect(recipeErrorMessage({ code: '23505' }, 'Chili maison')).toBe('Vous avez déjà une recette « Chili maison ».');
    expect(recipeErrorMessage(new Error('réseau'), 'Chili maison')).toBe('La recette n’a pas pu être enregistrée. Réessayez.');
  });
});
