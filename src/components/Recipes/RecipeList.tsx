// Liste des recettes : ajout rapide d'une part, choix de la quantité, modification.
import { Plus } from 'lucide-react';
import type { Recipe } from '../../lib/supabase';
import { formatNumber } from '../../utils/format';
import { portionByServings, recipeToDraft } from '../../utils/recipes';
import { Button } from '../ui/Button';

interface RecipeListProps {
  recipes: Recipe[];
  loading: boolean;
  error: string | null;
  notice?: string | null;
  disabled?: boolean;
  onRetry: () => void;
  onCreate: () => void;
  onEdit: (recipe: Recipe) => void;
  onPick: (recipe: Recipe) => void;
  onQuickAdd: (recipe: Recipe) => void;
}

function recipeDetails(recipe: Recipe) {
  const kcal = portionByServings(recipeToDraft(recipe), 1).kcal;
  const parts = `${recipe.servings} ${recipe.servings > 1 ? 'parts' : 'part'}`;
  const cooked = recipe.cooked_weight_g ? ` · poids cuit ${formatNumber(Number(recipe.cooked_weight_g))} g` : '';
  return `${parts} · ${formatNumber(kcal)} kcal la part${cooked}`;
}

export function RecipeList({ recipes, loading, error, notice, disabled, onRetry, onCreate, onEdit, onPick, onQuickAdd }: RecipeListProps) {
  return (
    <div className="space-y-3">
      <Button variant="secondary" size="lg" className="w-full rounded-xl" onClick={onCreate} disabled={disabled}>
        <Plus className="h-5 w-5" aria-hidden="true" />
        Nouvelle recette
      </Button>

      {notice && (
        <p role="status" className="rounded-md bg-success-50 p-3 text-sm text-success-700">
          {notice}
        </p>
      )}

      {loading && <p className="text-sm text-subtle">Chargement des recettes…</p>}

      {error && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-danger-200 bg-danger-50 p-3 text-sm text-danger-700">
          <span>{error}</span>
          <Button variant="secondary" size="sm" onClick={onRetry}>
            Réessayer
          </Button>
        </div>
      )}

      {!loading && !error && recipes.length === 0 && (
        <p className="rounded-xl bg-surface-muted p-4 text-sm text-muted">
          Enregistrez vos plats maison (lasagnes, chili…) avec leurs ingrédients : vous les ajouterez ensuite en un geste, à
          la part ou au gramme.
        </p>
      )}

      {recipes.length > 0 && (
        <ul className="space-y-2" aria-label="Mes recettes">
          {recipes.map((recipe) => (
            <li key={recipe.id} className="flex items-center gap-2 rounded-xl bg-surface-muted p-2">
              <button
                type="button"
                onClick={() => onPick(recipe)}
                disabled={disabled}
                className="min-w-0 flex-1 rounded-md px-2 py-1 text-left hover:bg-surface-sunken focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 disabled:opacity-50"
              >
                <span className="block truncate font-medium text-ink">{recipe.name}</span>
                <span className="block text-xs text-subtle">{recipeDetails(recipe)}</span>
              </button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit(recipe)}
                disabled={disabled}
                aria-label={`Modifier « ${recipe.name} »`}
                className="text-primary-700"
              >
                Modifier
              </Button>
              <button
                type="button"
                onClick={() => onQuickAdd(recipe)}
                disabled={disabled}
                aria-label={`Ajouter 1 part de « ${recipe.name} » au journal`}
                title="Ajouter 1 part au journal"
                className="btn-primary flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-2"
              >
                <Plus className="h-5 w-5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
