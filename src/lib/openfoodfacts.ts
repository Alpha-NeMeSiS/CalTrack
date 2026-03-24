import type { NormalizedFood } from '../types/food';

const OFF_SEARCH_PATH = '/api/off/cgi/search.pl';
const MIN_SEARCH_LENGTH = 3;
const CACHE_TTL_MS = 5 * 60 * 1000;
const RETRY_COOLDOWN_MS = 45 * 1000;

interface CachedResult {
  expiresAt: number;
  foods: NormalizedFood[];
}

const offSearchCache = new Map<string, CachedResult>();
const inFlightSearchByTerm = new Map<string, Promise<NormalizedFood[]>>();
let cooldownUntilTs = 0;

const toNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

interface OFFNutriments {
  'energy-kcal_100g'?: number | string;
  energy_100g?: number | string;
  proteins_100g?: number | string;
  fat_100g?: number | string;
  carbohydrates_100g?: number | string;
  fiber_100g?: number | string;
}

interface OFFProduct {
  code?: string;
  product_name?: string;
  product_name_fr?: string;
  brands?: string;
  image_small_url?: string;
  nutriments?: OFFNutriments;
}

function kcalFromNutriments(nutriments: OFFNutriments | undefined): number {
  const kcal = toNumber(nutriments?.['energy-kcal_100g']);
  if (kcal) {
    return kcal;
  }
  const kJ = toNumber(nutriments?.energy_100g);
  return kJ ? Math.round(((kJ / 4.184) + Number.EPSILON) * 10) / 10 : 0;
}

const normalizeSearchTerm = (term: string) =>
  term.trim().toLocaleLowerCase().replace(/\s+/g, ' ');

function createOFFError(code: 'OFF_HTTP_ERROR' | 'OFF_COOLDOWN', status?: number): Error {
  const error = new Error(code);
  error.name = code;
  if (typeof status === 'number') {
    (error as Error & { status?: number }).status = status;
  }
  return error;
}

export async function searchOFF(term: string, signal?: AbortSignal): Promise<NormalizedFood[]> {
  const normalizedTerm = normalizeSearchTerm(term);
  if (normalizedTerm.length < MIN_SEARCH_LENGTH) {
    return [];
  }

  const now = Date.now();
  if (cooldownUntilTs > now) {
    throw createOFFError('OFF_COOLDOWN');
  }

  const cachedResult = offSearchCache.get(normalizedTerm);
  if (cachedResult && cachedResult.expiresAt > now) {
    return cachedResult.foods;
  }

  const inFlight = inFlightSearchByTerm.get(normalizedTerm);
  if (inFlight) {
    return inFlight;
  }

  const params = new URLSearchParams({
    search_terms: normalizedTerm,
    search_simple: '1',
    action: 'process',
    json: '1',
    page_size: '20',
    nocache: '1',
    fields: [
      'code',
      'product_name',
      'product_name_fr',
      'brands',
      'image_small_url',
      'nutriments',
      'serving_size',
      'nutrition_data_per',
    ].join(','),
  });

  const fetchPromise = (async () => {
    const response = await fetch(`${OFF_SEARCH_PATH}?${params.toString()}`, { signal });

    if (!response.ok) {
      if (response.status === 503) {
        cooldownUntilTs = Date.now() + RETRY_COOLDOWN_MS;
      }
      throw createOFFError('OFF_HTTP_ERROR', response.status);
    }

    const json = await response.json();
    const products = Array.isArray(json?.products) ? json.products : [];

    const foods = products
      .map((product: OFFProduct) => {
        const name = product?.product_name_fr || product?.product_name || 'Produit';
        const normalized: NormalizedFood = {
          source: 'off',
          name,
          brand: product?.brands || undefined,
          imageUrl: product?.image_small_url || undefined,
          offCode: product?.code || undefined,
          extCode: undefined,
          kcal_per_100g: kcalFromNutriments(product?.nutriments),
          protein_g: toNumber(product?.nutriments?.proteins_100g),
          fat_g: toNumber(product?.nutriments?.fat_100g),
          carbs_g: toNumber(product?.nutriments?.carbohydrates_100g),
          fiber_g: toNumber(product?.nutriments?.fiber_100g),
        };
        return normalized;
      })
      .filter((food: NormalizedFood) =>
        food.kcal_per_100g || food.protein_g || food.fat_g || food.carbs_g,
      );

    offSearchCache.set(normalizedTerm, {
      foods,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    return foods;
  })();

  inFlightSearchByTerm.set(normalizedTerm, fetchPromise);

  try {
    return await fetchPromise;
  } finally {
    inFlightSearchByTerm.delete(normalizedTerm);
  }
}
