import {
  KeyboardEvent,
  ReactNode,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { ScanBarcode, Search } from 'lucide-react';
import type { NormalizedFood, SearchCategory } from '../../types/food';
import { searchCiqual } from '../../lib/ciqual';
import { fetchOFFProduct, searchOFF } from '../../lib/openfoodfacts';
import { searchPersonalFoods } from '../../utils/foodLibrary';
import { BarcodeScanner } from './BarcodeScanner';

interface FoodSearchProps {
  onSelect: (food: NormalizedFood) => void;
  /** Aliments personnels : proposés en premier et reconnus au scan */
  personalFoods?: NormalizedFood[];
  /** Contenu affiché quand rien n'est saisi (ex : favoris et récents) */
  idleContent?: ReactNode;
  /** Produit scanné inconnu : ouvre la création d'un aliment personnel */
  onCreateFood?: (draft: { barcode: string; name?: string }) => void;
}

const EMPTY_FOODS: NormalizedFood[] = [];

// Nombre minimal de caractères avant de lancer une recherche
const CIQUAL_MIN_QUERY_LENGTH = 2;
const OFF_MIN_QUERY_LENGTH = 3;
// Délai d'attente après la frappe. Plus long pour Open Food Facts afin de
// réduire le nombre de requêtes (et le risque d'erreurs 503).
const CIQUAL_SEARCH_DEBOUNCE_MS = 300;
const OFF_SEARCH_DEBOUNCE_MS = 1200;

function useDebounce<T>(value: T, ms = CIQUAL_SEARCH_DEBOUNCE_MS) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timeout = window.setTimeout(() => setDebounced(value), ms);
    return () => window.clearTimeout(timeout);
  }, [value, ms]);
  return debounced;
}

export function FoodSearch({ onSelect, personalFoods = EMPTY_FOODS, idleContent, onCreateFood }: FoodSearchProps) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<SearchCategory>('ciqual');
  const minChars = category === 'off' ? OFF_MIN_QUERY_LENGTH : CIQUAL_MIN_QUERY_LENGTH;
  const debounceMs = category === 'off' ? OFF_SEARCH_DEBOUNCE_MS : CIQUAL_SEARCH_DEBOUNCE_MS;
  const debouncedQuery = useDebounce(query, debounceMs);
  const [items, setItems] = useState<NormalizedFood[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listboxId = useId();
  // Scanner de code-barres : le produit est recherché dans Open Food Facts
  const [scannerOpen, setScannerOpen] = useState(false);
  const [barcodeMessage, setBarcodeMessage] = useState<{
    type: 'info' | 'error';
    text: string;
    /** Produit inconnu : de quoi pré-remplir sa création */
    draft?: { barcode: string; name?: string };
  } | null>(null);
  const barcodeAbortRef = useRef<AbortController | null>(null);
  // Lu dans les effets sans relancer la recherche à chaque rendu du parent
  const personalFoodsRef = useRef(personalFoods);
  personalFoodsRef.current = personalFoods;

  useEffect(() => () => barcodeAbortRef.current?.abort(), []);

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
        // Mes aliments d'abord, puis la base choisie
        const merged = [...searchPersonalFoods(personalFoodsRef.current, trimmed), ...results];
        setItems(merged);
        setHighlightedIndex(merged.length > 0 ? 0 : -1);
        setStatusMessage(merged.length === 0 ? 'Aucun résultat' : null);
      } catch (error) {
        if (!mounted) return;
        if (category === 'off' && controller?.signal.aborted) {
          return;
        }
        if (import.meta.env.DEV) {
          console.error('Erreur lors de la recherche', error);
        }
        // Mes aliments restent proposés même si la base en ligne ne répond pas
        const personal = searchPersonalFoods(personalFoodsRef.current, trimmed);
        setItems(personal);
        setHighlightedIndex(personal.length > 0 ? 0 : -1);
        if (personal.length > 0) {
          setStatusMessage(null);
          return;
        }
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

  const handleBarcode = useCallback(
    async (code: string) => {
      setScannerOpen(false);
      // Produit déjà créé dans mes aliments : inutile d'interroger Open Food Facts
      const personal = personalFoodsRef.current.find((food) => food.barcode === code);
      if (personal) {
        setBarcodeMessage(null);
        handleSelect(personal);
        return;
      }
      setBarcodeMessage({ type: 'info', text: `Recherche du produit ${code}…` });
      barcodeAbortRef.current?.abort();
      const controller = new AbortController();
      barcodeAbortRef.current = controller;

      try {
        const result = await fetchOFFProduct(code, controller.signal);
        if (controller.signal.aborted) return;
        if (result.status === 'found') {
          setBarcodeMessage(null);
          handleSelect(result.food);
          return;
        }
        // Pas exploitable : on bascule sur la recherche de produits par nom
        setCategory('off');
        setBarcodeMessage({
          type: 'info',
          text:
            result.status === 'not_found'
              ? `Aucun produit trouvé pour le code ${code} dans Open Food Facts. Créez-le dans vos aliments, ou cherchez-le par son nom.`
              : `« ${result.name} » est dans Open Food Facts, mais sans valeurs nutritionnelles. Créez-le avec les valeurs de l’étiquette, ou cherchez un produit équivalent.`,
          draft: result.status === 'not_found' ? { barcode: code } : { barcode: code, name: result.name },
        });
      } catch {
        if (controller.signal.aborted) return;
        setBarcodeMessage({ type: 'error', text: 'Open Food Facts est indisponible, réessayez dans un instant.' });
      }
    },
    [handleSelect],
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
          className={`px-3 py-1 rounded-md border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 ${
            category === 'ciqual'
              ? 'border-primary-500 bg-primary-50 text-primary-700'
              : 'border-line bg-surface-sunken text-body hover:bg-surface-strong'
          }`}
          onClick={() => setCategory('ciqual')}
        >
          Aliments génériques
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={category === 'off'}
          className={`px-3 py-1 rounded-md border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 ${
            category === 'off'
              ? 'border-primary-500 bg-primary-50 text-primary-700'
              : 'border-line bg-surface-sunken text-body hover:bg-surface-strong'
          }`}
          onClick={() => setCategory('off')}
        >
          Produits supermarché
        </button>
      </div>

      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Search
            className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-subtle"
            aria-hidden="true"
          />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setBarcodeMessage(null);
            }}
            onKeyDown={handleKeyDown}
            placeholder={
              category === 'ciqual'
                ? 'Rechercher (ex: riz, poulet, pomme)'
                : 'Rechercher un produit (ex: yaourt Danone)'
            }
            className="w-full field-input py-2 pl-10 pr-4"
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
        <button
          type="button"
          onClick={() => {
            barcodeAbortRef.current?.abort();
            setBarcodeMessage(null);
            setScannerOpen((open) => !open);
          }}
          aria-expanded={scannerOpen}
          aria-label="Scanner un code-barres"
          title="Scanner un code-barres"
          className={`flex flex-shrink-0 items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 ${
            scannerOpen
              ? 'border-primary-500 bg-primary-50 text-primary-700'
              : 'border-line-strong text-body hover:bg-surface-muted'
          }`}
        >
          <ScanBarcode className="h-5 w-5" aria-hidden="true" />
          <span className="hidden sm:inline">Scanner</span>
        </button>
      </div>

      {scannerOpen && (
        <BarcodeScanner onDetected={handleBarcode} onCancel={() => setScannerOpen(false)} />
      )}

      {barcodeMessage && (
        <p
          role={barcodeMessage.type === 'error' ? 'alert' : 'status'}
          className={`rounded-md border p-3 text-sm ${
            barcodeMessage.type === 'error'
              ? 'border-danger-200 bg-danger-50 text-danger-700'
              : 'border-line bg-surface-muted text-body'
          }`}
        >
          {barcodeMessage.text}
          {barcodeMessage.draft && onCreateFood && (
            <button
              type="button"
              onClick={() => onCreateFood(barcodeMessage.draft!)}
              className="mt-2 block rounded-md btn-primary px-3 py-1.5 text-sm font-medium"
            >
              Créer cet aliment
            </button>
          )}
        </p>
      )}

      {idleContent && !query.trim() && !scannerOpen && !barcodeMessage && idleContent}

      {/* Liste dans le flux (et non en position absolue) : dans la fenêtre d'ajout,
          qui défile, une liste absolue était coupée et un seul résultat restait visible. */}
      {expanded && (
        <div data-testid="food-search-results">
          <div className="max-h-72 w-full overflow-y-auto overscroll-contain rounded-md border border-line bg-surface shadow-sm">
            {loading && (
              <div className="p-4 text-center text-sm text-subtle">Recherche…</div>
            )}

            {!loading && items.length > 0 && (
              <ul role="listbox" id={listboxId} aria-busy={loading}>
                {items.map((food, index) => {
                  const isActive = index === highlightedIndex;
                  return (
                    <li
                      key={`${food.source}-${food.foodId ?? food.offCode ?? food.extCode ?? food.name}-${index}`}
                    >
                      <button
                        type="button"
                        id={`${listboxId}-${index}`}
                        role="option"
                        aria-selected={isActive}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => handleSelect(food)}
                        className={`flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition-colors focus:outline-none ${
                          isActive ? 'bg-primary-50' : 'hover:bg-surface-muted'
                        }`}
                      >
                        {food.imageUrl && (
                          <img
                            src={food.imageUrl}
                            alt=""
                            loading="lazy"
                            className="h-12 w-12 flex-shrink-0 rounded object-cover"
                          />
                        )}
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-2 text-ink">
                            <span className="font-medium">{food.name}</span>
                            {food.brand && (
                              <span className="text-xs text-subtle">{food.brand}</span>
                            )}
                          </div>
                          <div className="mt-1 text-xs text-subtle">
                            {Math.round(food.kcal_per_100g)} kcal · P {formatMacro(food.protein_g)} g · L {formatMacro(food.fat_g)} g · G {formatMacro(food.carbs_g)} g · F {formatMacro(food.fiber_g)} g (100 g)
                          </div>
                        </div>
                        <span className="rounded bg-surface-sunken px-2 py-1 text-[10px] font-semibold text-muted">
                          {food.source === 'ciqual' ? 'CIQUAL' : food.source === 'custom' ? 'PERSO' : 'OFF'}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            {!loading && items.length === 0 && (
              <div className="p-4 text-center text-sm text-subtle">
                {statusMessage ?? 'Aucun résultat'}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
