// Accès Supabase des recettes : lecture avec les ingrédients, enregistrement
// atomique par la fonction SQL save_recipe, suppression (ingrédients en cascade).
import { Recipe, supabase } from '../lib/supabase';
import type { RecipeDraft } from '../utils/recipes';

export async function fetchRecipes(userId: string): Promise<Recipe[]> {
  const { data, error } = await supabase
    .from('recipes')
    .select('*, recipe_ingredients(*)')
    .eq('user_id', userId)
    .order('name', { ascending: true });
  if (error) throw error;
  return (data as Recipe[]) ?? [];
}

/** Crée ou met à jour une recette et remplace ses ingrédients (tout ou rien). */
export async function saveRecipe(draft: RecipeDraft): Promise<Recipe> {
  const { data, error } = await supabase.rpc('save_recipe', {
    p_id: draft.id ?? null,
    p_name: draft.name.trim(),
    p_servings: draft.servings,
    p_cooked_weight_g: draft.cooked_weight_g,
    p_ingredients: draft.ingredients,
  });
  if (error) throw error;
  return data as Recipe;
}

export async function deleteRecipe(id: string): Promise<void> {
  const { error } = await supabase.from('recipes').delete().eq('id', id);
  if (error) throw error;
}

/** Message à afficher après un échec d'enregistrement */
export function recipeErrorMessage(error: unknown, name: string): string {
  const code = typeof error === 'object' && error !== null && 'code' in error ? (error as { code?: string }).code : undefined;
  if (code === '23505') return `Vous avez déjà une recette « ${name.trim()} ».`;
  return 'La recette n’a pas pu être enregistrée. Réessayez.';
}
