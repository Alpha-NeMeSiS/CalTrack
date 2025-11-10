import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  KeyboardEvent,
} from 'react';
import { Search } from 'lucide-react';
import { searchOFF } from '../../lib/openfoodfacts';
import { supabase } from '../../lib/supabase';
import type { NormalizedFood } from '../../types/food';

interface FoodSearchProps {
  onSelect: (food: NormalizedFood) => void;
}

type NormalizedFoodWithMeta = NormalizedFood & { localId?: string };

export function FoodSearch({ onSelect }: FoodSearchProps) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [items, setItems] = useState<NormalizedFood[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listboxId = useId();

  useEffect(() => {
    const handler = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 300);

    return () => window.clearTimeout(handler);
  }, [query]);

  const searchLocalFoods = useCallback(async (term: string) => {
    try {
      const { data, error } = await supabase
        .from('foods')
        .select('*')
        .ilike('name', `%${term}%`)
        .order('name')
        .limit(20);

      if (error) throw error;

      return (data ?? []).map((food) => ({
        source: 'local',
        name: food.name,
        brand: undefined,
        imageUrl: undefined,
        offCode: undefined,
        kcal_per_100g: food.kcal_per_100g,
        protein_g: food.protein_g,
        fat_g: food.fat_g,
        carbs_g: food.carbs_g,
        fiber_g: food.fiber_g,
        localId: food.id,
      })) as NormalizedFoodWithMeta[];
    } catch (error) {
      console.error('Erreur lors de la recherche locale :', error);
      return [];
    }
  }, []);

  useEffect(() => {
    if (debouncedQuery.length < 2) {
      setItems([]);
      setStatusMessage(null);
      setHighlightedIndex(-1);
      abortRef.current?.abort();
      return;
    }

    setLoading(true);
    setStatusMessage(null);
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const load = async () => {
      try {
        const offResults = await searchOFF(debouncedQuery, controller.signal);
        if (controller.signal.aborted) return;

        if (offResults.length > 0) {
          setItems(offResults);
          setHighlightedIndex(0);
          setStatusMessage(null);
          return;
        }

        const localResults = await searchLocalFoods(debouncedQuery);
        if (controller.signal.aborted) return;

        setItems(localResults);
        setHighlightedIndex(localResults.length > 0 ? 0 : -1);
        setStatusMessage(localResults.length === 0 ? 'Aucun résultat' : null);
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error('Erreur lors de la recherche OFF :', error);
        const localResults = await searchLocalFoods(debouncedQuery);
        if (controller.signal.aborted) return;

        setItems(localResults);
        setHighlightedIndex(localResults.length > 0 ? 0 : -1);
        setStatusMessage(
          localResults.length === 0
            ? "Aucun résultat. OpenFoodFacts est peut-être indisponible."
            : 'Résultats locaux affichés (OpenFoodFacts indisponible)'
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      controller.abort();
    };
  }, [debouncedQuery, searchLocalFoods]);

  const handleSelect = useCallback(
    (food: NormalizedFood) => {
      onSelect(food);
      setQuery('');
      setDebouncedQuery('');
      setItems([]);
      setHighlightedIndex(-1);
      setStatusMessage(null);
      inputRef.current?.focus();
    },
    [onSelect],
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (items.length === 0) return;

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setHighlightedIndex((prev) => {
          const next = prev + 1;
          return next >= items.length ? 0 : next;
        });
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setHighlightedIndex((prev) => {
          const next = prev - 1;
          return next < 0 ? items.length - 1 : next;
        });
      } else if (event.key === 'Enter') {
        event.preventDefault();
        const food = items[highlightedIndex >= 0 ? highlightedIndex : 0];
        if (food) {
          handleSelect(food);
        }
      } else if (event.key === 'Escape') {
        event.preventDefault();
        setItems([]);
        setHighlightedIndex(-1);
      }
    },
    [handleSelect, highlightedIndex, items],
  );

  const expanded = useMemo(
    () => debouncedQuery.length >= 2 && (items.length > 0 || loading || !!statusMessage),
    [debouncedQuery, items, loading, statusMessage],
  );

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" aria-hidden="true" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Rechercher un aliment..."
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          role="combobox"
          aria-expanded={expanded}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={
            highlightedIndex >= 0 && items[highlightedIndex]
              ? `${listboxId}-${highlightedIndex}`
              : undefined
          }
        />
      </div>

      {expanded && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-80 overflow-y-auto">
          {loading && <div className="p-4 text-center text-gray-500">Recherche...</div>}

          {!loading && items.length > 0 && (
            <ul role="listbox" id={listboxId} className="divide-y divide-gray-100">
              {items.map((food, index) => {
                const isActive = index === highlightedIndex;
                return (
                  <li key={`${food.source}-${food.offCode ?? (food as NormalizedFoodWithMeta).localId ?? food.name}-${index}`}>
                    <button
                      type="button"
                      id={`${listboxId}-${index}`}
                      role="option"
                      aria-selected={isActive}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => handleSelect(food)}
                      className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${
                        isActive ? 'bg-blue-50' : 'hover:bg-gray-50'
                      }`}
                    >
                      {food.imageUrl ? (
                        <img
                          src={food.imageUrl}
                          alt=""
                          className="h-12 w-12 flex-shrink-0 rounded object-cover"
                        />
                      ) : (
                        <div className="h-12 w-12 flex-shrink-0 rounded bg-gray-100" aria-hidden="true" />
                      )}
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 text-sm text-gray-900">
                          <span className="font-medium">{food.name}</span>
                          {food.brand && (
                            <span className="text-xs text-gray-500">{food.brand}</span>
                          )}
                        </div>
                        <div className="mt-1 text-xs text-gray-500">
                          {Math.round(food.kcal_per_100g)} kcal · P {food.protein_g.toFixed(1)} g · L {food.fat_g.toFixed(1)} g · G {food.carbs_g.toFixed(1)} g
                          {food.fiber_g ? ` · F ${food.fiber_g.toFixed(1)} g` : ''} (pour 100 g)
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {!loading && items.length > 0 && statusMessage && (
            <div className="border-t border-gray-100 bg-gray-50 px-4 py-2 text-xs text-gray-500">
              {statusMessage}
            </div>
          )}

          {!loading && items.length === 0 && (
            <div className="p-4 text-center text-gray-500">{statusMessage ?? 'Aucun résultat'}</div>
          )}
        </div>
      )}
    </div>
  );
}
