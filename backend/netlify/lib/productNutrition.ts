// Valeurs nutritionnelles d'un produit lues dans sa fiche Open Food Facts.
// Depuis fin novembre 2026, l'index de recherche (search.openfoodfacts.org) ne
// contient plus les valeurs de la plupart des produits : off-search les complète
// avec la fiche produit (la même que celle du scanner), qui reste complète.
// Placé hors de functions/ : Netlify y traiterait chaque fichier comme une fonction.

type Nutriments = Record<string, unknown>;

const OFF_PRODUCT_ENDPOINT = 'https://world.openfoodfacts.org/api/v2/product';
const PRODUCT_TIMEOUT_MS = 4000;

/**
 * Nombre maximal de fiches complétées par recherche. Open Food Facts limite les
 * lectures de fiches par minute (le scanner en dépend aussi) : on en lit au plus
 * autant que de résultats affichés, et on garde en mémoire celles déjà lues.
 */
export const ENRICH_LIMIT = 10;

// Valeurs déjà lues, conservées tant que la fonction reste active
// (« paquito », puis « paquito multi » : les mêmes produits ne sont pas redemandés).
const CACHE_TTL_MS = 30 * 60 * 1000;
const CACHE_MAX_ENTRIES = 1000;
type CachedNutrition = { value: { nutriments: Nutriments; serving_size?: string } | null; expires: number };
const cache = new Map<string, CachedNutrition>();

/** Vide la mémoire (tests). */
export function clearNutritionCache(): void {
  cache.clear();
}

export const OFF_USER_AGENT = 'CalTrack/1.0 (support@caltrack.app)';

const NUTRIENTS = ['energy-kcal', 'energy', 'proteins', 'fat', 'carbohydrates'];
const BASES = ['_100g', '_prepared_100g'];

/** Au moins une valeur utile pour 100 g (telle que vendue ou préparée) */
export function hasNutriments(nutriments: Nutriments | null | undefined): boolean {
  if (!nutriments) return false;
  return NUTRIENTS.some((nutrient) =>
    BASES.some((base) => {
      const value = Number(nutriments[`${nutrient}${base}`]);
      return Number.isFinite(value) && value > 0;
    })
  );
}

/** Valeurs et portion d'un produit, ou null si la fiche est introuvable ou indisponible. */
export async function fetchProductNutrition(
  code: string
): Promise<{ nutriments: Nutriments; serving_size?: string } | null> {
  const url = `${OFF_PRODUCT_ENDPOINT}/${encodeURIComponent(code)}?${new URLSearchParams({ fields: 'nutriments,serving_size' })}`;
  const response = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': OFF_USER_AGENT },
    signal: AbortSignal.timeout(PRODUCT_TIMEOUT_MS),
  });
  if (!response.ok) return null;
  const payload = (await response.json()) as { status?: number; product?: { nutriments?: Nutriments; serving_size?: string } };
  if (payload?.status !== 1 || !payload.product?.nutriments) return null;
  return {
    nutriments: payload.product.nutriments,
    ...(payload.product.serving_size ? { serving_size: payload.product.serving_size } : {}),
  };
}

/**
 * Comme fetchProductNutrition, avec la mémoire : une fiche lue (avec ou sans
 * valeurs) n'est pas redemandée pendant 30 minutes. Une erreur n'est pas retenue.
 */
export async function getProductNutrition(code: string): Promise<{ nutriments: Nutriments; serving_size?: string } | null> {
  const now = Date.now();
  const cached = cache.get(code);
  if (cached && cached.expires > now) return cached.value;
  const value = await fetchProductNutrition(code);
  if (cache.size >= CACHE_MAX_ENTRIES) cache.delete(cache.keys().next().value as string);
  cache.set(code, { value, expires: now + CACHE_TTL_MS });
  return value;
}
