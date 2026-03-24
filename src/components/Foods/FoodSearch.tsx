import {
  KeyboardEvent,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Search } from 'lucide-react';
import type { NormalizedFood, SearchCategory } from '../../types/food';
import { searchCiqual } from '../../lib/ciqual';
import { searchOFF } from '../../lib/openfoodfacts';

interface FoodSearchProps {
  onSelect: (food: NormalizedFood) => void;
}

<<<<<<< HEAD
const MIN_QUERY_LENGTH = 3;
// Long debounce to significantly reduce OFF request rate and 503 risks.
const OFF_SEARCH_DEBOUNCE_MS = 1200;

function useDebounce<T>(value: T, ms = 900) {
=======
function useDebounce<T>(value: T, ms = 300) {
>>>>>>> parent of 22fda64 (Route Open Food Facts queries through local proxy)
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timeout = window.setTimeout(() => setDebounced(value), ms);
    return () => window.clearTimeout(timeout);
  }, [value, ms]);
  return debounced;
}

export function FoodSearch({ onSelect }: FoodSearchProps) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<SearchCategory>('ciqual');
  const minChars = category === 'off' ? 3 : 2;
  const debounceMs = category === 'off' ? 1200 : 300;
  const debouncedQuery = useDebounce(query, debounceMs);
  const [items, setItems] = useState<NormalizedFood[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listboxId = useId();

  useEffect(() => {
    const trimmed = debouncedQuery.trim();
    if (trimmed.length < minChars) {
      if (category === 'off') {
        abortRef.current?.abort();
        abortRef.current = null;
      }
      setItems([]);
      setLoading(false);
      setStatusMessage(null);
      setHighlightedIndex(-1);
      return;
    }

    setLoading(true);
    setStatusMessage(null);
    setItems([]);
    setHighlightedIndex(-1);

    let controller: AbortController | null = null;
    if (category === 'off') {
      abortRef.current?.abort();
      controller = new AbortController();
      abortRef.current = controller;
    } else {
      abortRef.current?.abort();
      abortRef.current = null;
    }

    let mounted = true;

    (async () => {
      try {
        const results =
          category === 'ciqual'
            ? await searchCiqual(trimmed)
            : await searchOFF(trimmed, controller?.signal);

        if (!mounted) return;
        setItems(results);
        setHighlightedIndex(results.length > 0 ? 0 : -1);
        setStatusMessage(results.length === 0 ? 'Aucun résultat' : null);
      } catch (error) {
        if (!mounted) return;
        if (category === 'off' && controller?.signal.aborted) {
          return;
        }
        if (import.meta.env.DEV) {
          console.error('Erreur lors de la recherche', error);
        }
        setItems([]);
        setHighlightedIndex(-1);
        setStatusMessage(
          category === 'off'
            ? 'Service OFF indisponible, réessayez dans un instant.'
            : 'Aucun résultat',
        );
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    })();

    return () => {
      mounted = false;
      if (category === 'off') {
        controller?.abort();
        if (abortRef.current === controller) {
          abortRef.current = null;
        }
      }
    };
  }, [debouncedQuery, category, minChars]);

  useEffect(() => {
    setItems([]);
    setStatusMessage(null);
    setHighlightedIndex(-1);
    setLoading(false);
  }, [category]);

  const handleSelect = useCallback(
    (food: NormalizedFood) => {
      onSelect(food);
      abortRef.current?.abort();
      setQuery('');
      setItems([]);
      setStatusMessage(null);
      setHighlightedIndex(-1);
      setLoading(false);
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

  const expanded = useMemo(() => {
    const trimmed = debouncedQuery.trim();
    return (
      trimmed.length >= minChars && (items.length > 0 || loading || statusMessage !== null)
    );
  }, [debouncedQuery, items, loading, minChars, statusMessage]);

  const formatMacro = (value: number) => Math.round(value * 10) / 10;

  return (
    <div className="space-y-3">
      <div
        role="tablist"
        aria-label="Catégorie d'aliments"
        className="flex gap-2"
      >
        <button
          type="button"
          role="tab"
          aria-selected={category === 'ciqual'}
          className={`px-3 py-1 rounded-md border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
            category === 'ciqual'
              ? 'border-blue-500 bg-blue-50 text-blue-700'
              : 'border-gray-200 bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
          onClick={() => setCategory('ciqual')}
        >
          Aliments génériques
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={category === 'off'}
          className={`px-3 py-1 rounded-md border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
            category === 'off'
              ? 'border-blue-500 bg-blue-50 text-blue-700'
              : 'border-gray-200 bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
          onClick={() => setCategory('off')}
        >
          Produits supermarché
        </button>
      </div>

      <div className="relative">
        <Search
          className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400"
          aria-hidden="true"
        />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            category === 'ciqual'
              ? 'Rechercher (ex: riz, poulet, pomme)'
              : 'Rechercher un produit (ex: yaourt Danone)'
          }
          className="w-full rounded-md border border-gray-300 py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
          role="combobox"
          aria-expanded={expanded}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={
            highlightedIndex >= 0 && items[highlightedIndex]
              ? `${listboxId}-${highlightedIndex}`
              : undefined
          }
          aria-label="Recherche d'aliment"
        />
      </div>

      {expanded && (
        <div className="relative">
          <div className="absolute z-10 mt-1 max-h-80 w-full overflow-y-auto rounded-md border border-gray-200 bg-white shadow-lg">
            {loading && (
              <div className="p-4 text-center text-sm text-gray-500">Recherche…</div>
            )}

            {!loading && items.length > 0 && (
              <ul role="listbox" id={listboxId} aria-busy={loading}>
                {items.map((food, index) => {
                  const isActive = index === highlightedIndex;
                  return (
                    <li
                      key={`${food.source}-${food.offCode ?? food.extCode ?? food.name}-${index}`}
                    >
                      <button
                        type="button"
                        id={`${listboxId}-${index}`}
                        role="option"
                        aria-selected={isActive}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => handleSelect(food)}
                        className={`flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition-colors focus:outline-none ${
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
                          <div
                            className="h-12 w-12 flex-shrink-0 rounded bg-gray-100"
                            aria-hidden="true"
                          />
                        )}
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-2 text-gray-900">
                            <span className="font-medium">{food.name}</span>
                            {food.brand && (
                              <span className="text-xs text-gray-500">{food.brand}</span>
                            )}
                          </div>
                          <div className="mt-1 text-xs text-gray-500">
                            {Math.round(food.kcal_per_100g)} kcal · P {formatMacro(food.protein_g)} g · L {formatMacro(food.fat_g)} g · G {formatMacro(food.carbs_g)} g · F {formatMacro(food.fiber_g)} g (100 g)
                          </div>
                        </div>
                        <span className="rounded bg-gray-100 px-2 py-1 text-[10px] font-semibold text-gray-600">
                          {food.source === 'ciqual' ? 'CIQUAL' : 'OFF'}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            {!loading && items.length === 0 && (
              <div className="p-4 text-center text-sm text-gray-500">
                {statusMessage ?? 'Aucun résultat'}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
