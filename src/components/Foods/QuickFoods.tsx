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
        className="flex-shrink-0 rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-amber-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50"
      >
        <Star className={`h-5 w-5 ${isFavorite ? 'fill-amber-400 text-amber-500' : ''}`} aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={() => onPick(item)}
        disabled={disabled}
        className="min-w-0 flex-1 rounded-md px-1 py-0.5 text-left hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50"
      >
        <span className="block truncate text-sm font-medium text-gray-900">{item.label}</span>
        <span className="block text-xs text-gray-500">{details}</span>
      </button>
      <button
        type="button"
        onClick={() => onQuickAdd(item)}
        disabled={disabled}
        aria-label={`Ajouter « ${item.label} » (${item.usualQty} g) au journal`}
        title="Ajouter au journal"
        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:bg-blue-300"
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
        <p className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Chargement de vos aliments…
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}
      {sections.map((section) => (
        <div key={section.title}>
          <h3 id={`quick-foods-${section.title}`} className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            {section.title}
          </h3>
          <ul aria-labelledby={`quick-foods-${section.title}`} className="divide-y divide-gray-100">
            {section.items.map((item) => (
              <QuickFoodRow key={item.key} item={item} {...rowProps} />
            ))}
          </ul>
        </div>
      ))}
      {!loading && !error && sections.length === 0 && (
        <p className="rounded-md border border-dashed border-gray-300 p-4 text-center text-sm text-gray-500">
          Vos aliments récents et favoris apparaîtront ici, prêts à être ajoutés en un tap.
        </p>
      )}
    </section>
  );
}
