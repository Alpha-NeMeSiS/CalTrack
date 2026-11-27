import type { NormalizedFood } from './types';
import { parseServingGrams } from '../journal/entries';

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

// Valeurs pour 100 g « tel que vendu » (suffixe _100g) ou « préparé » (_prepared_100g :
// plat à réchauffer, poudre à reconstituer…). Certains produits n'ont que les secondes.
type OFFNutriments = Partial<Record<string, number | string>>;
type NutrimentsBasis = '_100g' | '_prepared_100g';

interface OFFProduct {
  code?: string;
  product_name?: string;
  product_name_fr?: string;
  brands?: string | string[];
  image_small_url?: string;
  nutriments?: OFFNutriments;
  serving_size?: string;
}

function kcalFromNutriments(nutriments: OFFNutriments | undefined, basis: NutrimentsBasis): number {
  const kcal = toNumber(nutriments?.[`energy-kcal${basis}`]);
  if (kcal) {
    return kcal;
  }
  const kJ = toNumber(nutriments?.[`energy${basis}`]);
  return kJ ? Math.round(((kJ / 4.184) + Number.EPSILON) * 10) / 10 : 0;
}

type NutritionValues = Pick<NormalizedFood, 'kcal_per_100g' | 'protein_g' | 'fat_g' | 'carbs_g' | 'fiber_g'>;

function nutritionFrom(nutriments: OFFNutriments | undefined, basis: NutrimentsBasis): NutritionValues {
  return {
    kcal_per_100g: kcalFromNutriments(nutriments, basis),
    protein_g: toNumber(nutriments?.[`proteins${basis}`]),
    fat_g: toNumber(nutriments?.[`fat${basis}`]),
    carbs_g: toNumber(nutriments?.[`carbohydrates${basis}`]),
    fiber_g: toNumber(nutriments?.[`fiber${basis}`]),
  };
}

const hasValues = (values: NutritionValues) => Boolean(values.kcal_per_100g || values.protein_g || values.fat_g || values.carbs_g);

/** Valeurs « tel que vendu » ; à défaut, le jeu complet « préparé » (jamais un mélange des deux) */
function nutritionOf(nutriments: OFFNutriments | undefined): NutritionValues {
  const asSold = nutritionFrom(nutriments, '_100g');
  if (hasValues(asSold)) return asSold;
  const prepared = nutritionFrom(nutriments, '_prepared_100g');
  return hasValues(prepared) ? prepared : asSold;
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
    ...nutritionOf(product?.nutriments),
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

/** `size` : nombre de résultats voulu (1 à 30, 10 par défaut côté proxy). */
export async function searchOFF(term: string, signal?: AbortSignal, size?: number): Promise<NormalizedFood[]> {
  const trimmed = term.trim();
  if (trimmed.length < MIN_QUERY_LENGTH) return [];

  const sizeParam = size === undefined ? '' : `&size=${size}`;
  const response = await fetch(
    `${OFF_PROXY_SEARCH}?q=${encodeURIComponent(trimmed)}${sizeParam}`,
    { signal },
  );
  if (!response.ok) {
    throw new Error(`OFF search failed with status ${response.status}`);
  }

  const json = await response.json();
  const products: OFFProduct[] = Array.isArray(json?.products) ? json.products : [];

  // Sans valeurs mais avec un code-barres : le produit reste proposé et sa
  // fiche est chargée quand on le choisit (l'index de recherche n'a plus les
  // valeurs de tous les produits, et le proxy ne peut pas toujours les compléter).
  return products.map(normalizeOFFProduct).flatMap((food) => {
    if (hasNutrition(food)) return [food];
    return food.offCode ? [{ ...food, valuesPending: true }] : [];
  });
}

export type OFFProductLookup =
  | { status: 'found'; food: NormalizedFood }
  /** Produit connu d'Open Food Facts, mais sans valeurs nutritionnelles (de quoi chercher des produits similaires) */
  | { status: 'no_nutrition'; code: string; name: string; brand?: string; servingGrams?: number }
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
  if (hasNutrition(food)) return { status: 'found', food };
  return {
    status: 'no_nutrition',
    code: food.offCode ?? code,
    name: food.name,
    ...(food.brand ? { brand: food.brand } : {}),
    ...(food.servingGrams ? { servingGrams: food.servingGrams } : {}),
  };
}
