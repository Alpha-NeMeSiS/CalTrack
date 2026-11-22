// Recettes de l'utilisateur : chargement, enregistrement et suppression.
import { useCallback, useEffect, useState } from 'react';
import type { Recipe } from '../../shared/supabase';
import { deleteRecipe, fetchRecipes, saveRecipe } from './recipes.service';
import type { RecipeDraft } from './recipes';

export function useRecipes(userId: string | undefined) {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(Boolean(userId));
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      setRecipes(await fetchRecipes(userId));
    } catch (err) {
      console.error('Erreur de chargement des recettes', err);
      setError('Vos recettes n’ont pas pu être chargées.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  /** Enregistre puis recharge la liste (ingrédients compris). Lève l'erreur en cas d'échec. */
  const save = useCallback(
    async (draft: RecipeDraft) => {
      const saved = await saveRecipe(draft);
      await reload();
      return saved;
    },
    [reload]
  );

  const remove = useCallback(async (id: string) => {
    await deleteRecipe(id);
    setRecipes((current) => current.filter((recipe) => recipe.id !== id));
  }, []);

  return { recipes, loading, error, reload, save, remove };
}
