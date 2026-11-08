// Favoris et aliments récents, affichés en haut de la recherche tant que rien
// n'est saisi : « + » ajoute l'aliment en un tap (quantité et repas
// habituels), un tap sur le nom le sélectionne pour ajuster la quantité,
// l'étoile ajoute ou retire des favoris.
import { Loader2, Plus, Star } from 'lucide-react';
import type { MealType } from '../../utils/entries';
import { nutritionForQuantity, QuickFood } from '../../utils/foodLibrary';

interface QuickFoodsProps {
  favorites: QuickFood[];
  recents: QuickFood[];
  loading: boolean;
  error: string | null;
  mealLabel: (meal: MealType) => string;
  onPick: (item: QuickFood) => void;
  onQuickAdd: (item: QuickFood) => void;
  onToggleFavorite: (item: QuickFood) => void;
  /** Pendant un ajout ou un enregistrement */
  disabled?: boolean;
}

function QuickFoodRow({
  item,
  mealLabel,
  onPick,
  onQuickAdd,
  onToggleFavorite,
  disabled,
}: Omit<QuickFoodsProps, 'favorites' | 'recents' | 'loading' | 'error'> & { item: QuickFood }) {
  const { kcal } = nutritionForQuantity(item.food, item.usualQty);
  const details = [`${item.usualQty} g`, `${kcal} kcal`, item.usualMeal && mealLabel(item.usualMeal)].filter(Boolean).join(' · ');
  const isFavorite = Boolean(item.favoriteId);

  return (
    <li className="flex items-center gap-2 py-2">
      <button
        type="button"
        onClick={() => onToggleFavorite(item)}
        disabled={disabled}
        aria-pressed={isFavorite}
        aria-label={isFavorite ? `Retirer « ${item.label} » des favoris` : `Ajouter « ${item.label} » aux favoris`}
        className="flex-shrink-0 rounded-md p-1.5 text-subtle hover:bg-surface-sunken hover:text-warning-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:opacity-50"
      >
        <Star className={`h-5 w-5 ${isFavorite ? 'fill-warning-400 text-warning-500' : ''}`} aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={() => onPick(item)}
        disabled={disabled}
        className="min-w-0 flex-1 rounded-md px-1 py-0.5 text-left hover:bg-surface-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:opacity-50"
      >
        <span className="block truncate text-sm font-medium text-ink">{item.label}</span>
        <span className="block text-xs text-subtle">{details}</span>
      </button>
      <button
        type="button"
        onClick={() => onQuickAdd(item)}
        disabled={disabled}
        aria-label={`Ajouter « ${item.label} » (${item.usualQty} g) au journal`}
        title="Ajouter au journal"
        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full btn-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
      >
        <Plus className="h-5 w-5" aria-hidden="true" />
      </button>
    </li>
  );
}

export function QuickFoods({ favorites, recents, loading, error, ...rowProps }: QuickFoodsProps) {
  const sections = [
    { title: 'Favoris', items: favorites },
    { title: 'Récents', items: recents },
  ].filter((section) => section.items.length > 0);

  return (
    <section aria-label="Favoris et récents" className="space-y-3">
      {loading && (
        <p className="flex items-center gap-2 text-sm text-subtle">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Chargement de vos aliments…
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-md border border-danger-200 bg-danger-50 p-3 text-sm text-danger-700">
          {error}
        </p>
      )}
      {sections.map((section) => (
        <div key={section.title}>
          <h3 id={`quick-foods-${section.title}`} className="text-xs font-semibold uppercase tracking-wide text-subtle">
            {section.title}
          </h3>
          <ul aria-labelledby={`quick-foods-${section.title}`} className="divide-y divide-line-subtle">
            {section.items.map((item) => (
              <QuickFoodRow key={item.key} item={item} {...rowProps} />
            ))}
          </ul>
        </div>
      ))}
      {!loading && !error && sections.length === 0 && (
        <p className="rounded-md border border-dashed border-line-strong p-4 text-center text-sm text-subtle">
          Vos aliments récents et favoris apparaîtront ici, prêts à être ajoutés en un tap.
        </p>
      )}
    </section>
  );
}
