// Onglet « Recettes » de la fenêtre d'ajout : liste, éditeur et ajout au
// journal, affichés l'un après l'autre (pas de fenêtre dans la fenêtre).
import { useState } from 'react';
import type { Entry, Recipe } from '../../lib/supabase';
import type { NormalizedFood } from '../../types/food';
import type { AddEntryPayload } from '../../utils/entries';
import { portionByServings, recipeToDraft, usualRecipeMeal } from '../../utils/recipes';
import { RecipeEditor } from './RecipeEditor';
import { RecipeList } from './RecipeList';
import { RecipePortion } from './RecipePortion';
import { useRecipes } from './useRecipes';

type View = { name: 'list' } | { name: 'edit'; recipe?: Recipe } | { name: 'portion'; recipe: Recipe };

interface RecipesTabProps {
  userId: string | undefined;
  /** Entrées récentes du journal : repas habituel de chaque recette */
  recentEntries: Entry[];
  personalFoods?: NormalizedFood[];
  disabled?: boolean;
  onAdd: (entry: AddEntryPayload) => Promise<boolean>;
}

export function RecipesTab({ userId, recentEntries, personalFoods, disabled, onAdd }: RecipesTabProps) {
  const { recipes, loading, error, reload, save, remove } = useRecipes(userId);
  const [view, setView] = useState<View>({ name: 'list' });
  const [notice, setNotice] = useState<string | null>(null);

  const quickAdd = async (recipe: Recipe) => {
    const portion = portionByServings(recipeToDraft(recipe), 1);
    await onAdd({
      label: portion.label,
      qty_grammes: portion.qty_grammes,
      kcal: portion.kcal,
      protein_g: portion.protein_g,
      fat_g: portion.fat_g,
      carbs_g: portion.carbs_g,
      fiber_g: portion.fiber_g,
      meal_type: usualRecipeMeal(recipe.name, recentEntries),
    });
  };

  if (view.name === 'edit') {
    const editing = view.recipe;
    return (
      <RecipeEditor
        initial={editing}
        personalFoods={personalFoods}
        onCancel={() => setView({ name: 'list' })}
        onSave={async (draft) => {
          await save(draft);
          setNotice(`Recette « ${draft.name.trim()} » enregistrée.`);
          setView({ name: 'list' });
        }}
        onDelete={
          editing
            ? async () => {
                await remove(editing.id);
                setNotice(`Recette « ${editing.name} » supprimée.`);
                setView({ name: 'list' });
              }
            : undefined
        }
      />
    );
  }

  if (view.name === 'portion') {
    return (
      <RecipePortion
        recipe={view.recipe}
        defaultMeal={usualRecipeMeal(view.recipe.name, recentEntries)}
        disabled={disabled}
        onAdd={onAdd}
        onBack={() => setView({ name: 'list' })}
      />
    );
  }

  return (
    <RecipeList
      recipes={recipes}
      loading={loading}
      error={error}
      notice={notice}
      disabled={disabled}
      onRetry={() => void reload()}
      onCreate={() => {
        setNotice(null);
        setView({ name: 'edit' });
      }}
      onEdit={(recipe) => {
        setNotice(null);
        setView({ name: 'edit', recipe });
      }}
      onPick={(recipe) => setView({ name: 'portion', recipe })}
      onQuickAdd={quickAdd}
    />
  );
}
