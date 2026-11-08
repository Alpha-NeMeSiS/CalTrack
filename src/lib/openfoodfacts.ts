import type { NormalizedFood } from '../types/food';
import { parseServingGrams } from '../utils/entries';

const OFF_PROXY_SEARCH = '/api/off/search';
const OFF_PROXY_PRODUCT = '/api/off/product';
const MIN_QUERY_LENGTH = 3;

// Les données OFF sont saisies par des contributeurs : on écarte les valeurs
// non numériques ou négatives (la base refuse les valeurs < 0 à l'enregistrement).
const toNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

const toBrand = (brands: unknown): string | undefined => {
  if (Array.isArray(brands)) {
    const joined = brands.filter((b) => typeof b === 'string' && b.trim()).join(', ');
    return joined || undefined;
  }
  return typeof brands === 'string' && brands.trim() ? brands : undefined;
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
  brands?: string | string[];
  image_small_url?: string;
  nutriments?: OFFNutriments;
  serving_size?: string;
}

function kcalFromNutriments(nutriments: OFFNutriments | undefined): number {
  const kcal = toNumber(nutriments?.['energy-kcal_100g']);
  if (kcal) {
    return kcal;
  }
  const kJ = toNumber(nutriments?.energy_100g);
  return kJ ? Math.round(((kJ / 4.184) + Number.EPSILON) * 10) / 10 : 0;
}

/** Convertit un produit Open Food Facts au format commun de l'application. */
function normalizeOFFProduct(product: OFFProduct): NormalizedFood {
  const name = product?.product_name_fr || product?.product_name || 'Produit';
  const normalized: NormalizedFood = {
    source: 'off',
    name,
    brand: toBrand(product?.brands),
    imageUrl: product?.image_small_url || undefined,
    offCode: product?.code || undefined,
    extCode: undefined,
    kcal_per_100g: kcalFromNutriments(product?.nutriments),
    protein_g: toNumber(product?.nutriments?.proteins_100g),
    fat_g: toNumber(product?.nutriments?.fat_100g),
    carbs_g: toNumber(product?.nutriments?.carbohydrates_100g),
    fiber_g: toNumber(product?.nutriments?.fiber_100g),
  };
  const servingGrams = parseServingGrams(product?.serving_size);
  if (servingGrams) {
    normalized.servingGrams = servingGrams;
    normalized.servingLabel = product?.serving_size?.trim();
  }
  return normalized;
}

/** Un produit sans calories ni macros ne peut pas être ajouté au journal */
const hasNutrition = (food: NormalizedFood) => Boolean(food.kcal_per_100g || food.protein_g || food.fat_g || food.carbs_g);

export async function searchOFF(term: string, signal?: AbortSignal): Promise<NormalizedFood[]> {
  const trimmed = term.trim();
  if (trimmed.length < MIN_QUERY_LENGTH) return [];

  const response = await fetch(
    `${OFF_PROXY_SEARCH}?q=${encodeURIComponent(trimmed)}`,
    { signal },
  );
  if (!response.ok) {
    throw new Error(`OFF search failed with status ${response.status}`);
  }

  const json = await response.json();
  const products: OFFProduct[] = Array.isArray(json?.products) ? json.products : [];

  return products.map(normalizeOFFProduct).filter(hasNutrition);
}

export type OFFProductLookup =
  | { status: 'found'; food: NormalizedFood }
  /** Produit connu d'Open Food Facts, mais sans valeurs nutritionnelles */
  | { status: 'no_nutrition'; name: string }
  | { status: 'not_found' };

/** Fiche produit à partir d'un code-barres (scanner). Lève une erreur si le service est indisponible. */
export async function fetchOFFProduct(code: string, signal?: AbortSignal): Promise<OFFProductLookup> {
  const response = await fetch(`${OFF_PROXY_PRODUCT}?code=${encodeURIComponent(code)}`, { signal });
  if (response.status === 404) return { status: 'not_found' };
  if (!response.ok) {
    throw new Error(`OFF product lookup failed with status ${response.status}`);
  }

  const json = await response.json();
  if (!json?.product) return { status: 'not_found' };
  const food = normalizeOFFProduct(json.product as OFFProduct);
  return hasNutrition(food) ? { status: 'found', food } : { status: 'no_nutrition', name: food.name };
}
