import type { NormalizedFood } from '../types/food';

const V1_SEARCH = 'https://world.openfoodfacts.org/cgi/search.pl';

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
  if (!term || term.trim().length < 2) return [];

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
    search_terms: term.trim(),
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

  const response = await fetch(`${V1_SEARCH}?${params.toString()}`, { signal });
  if (!response.ok) {
    return [];
  }
  const json = await response.json();
  const products = Array.isArray(json?.products) ? json.products : [];

  return products
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
}
