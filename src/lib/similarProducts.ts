// Produit scanné sans valeurs nutritionnelles : estimation d'après les produits
// Open Food Facts les plus proches (même marque d'abord, puis toutes marques),
// classés selon les mots du nom en commun.
// Spec : docs/superpowers/specs/2026-11-22-produit-similaire-design.md
import type { NormalizedFood, NutritionPer100 } from '../types/food';
import { searchOFF } from './openfoodfacts';

export interface SimilarTarget {
  code: string;
  name: string;
  brand?: string;
}

export interface RankedProduct {
  food: NormalizedFood;
  score: number;
  sameBrand: boolean;
}

export interface SimilarEstimate {
  /** Valeurs pour 100 g : kcal à l'unité, le reste au dixième */
  values: NutritionPer100;
  /** Produits utilisés pour l'estimation (1 à 3) */
  used: RankedProduct[];
  proximity: 'same-brand' | 'other-brands';
  /** Produits proches proposés au choix (5 au plus, produits utilisés en tête) */
  choices: RankedProduct[];
}

const STOP_WORDS = new Set(['les', 'des', 'aux', 'avec', 'pour', 'sans', 'une', 'sur', 'par', 'the', 'and', 'with']);
const QUANTITY = /^\d+([a-z]{1,2})?$/;
const MAX_TOKENS = 6;
const SAME_BRAND_BONUS = 0.25;
const SCORE_TOLERANCE = 0.01;
const MAX_USED = 3;
const MAX_CHOICES = 5;
const SEARCH_SIZE = 30;

const stripAccents = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const fold = (text: string) => stripAccents(text.toLowerCase()).trim();
const words = (text: string) => fold(text).split(/[^a-z0-9]+/).filter(Boolean);
const stem = (word: string) => (word.length > 4 && word.endsWith('s') ? word.slice(0, -1) : word);
const brandsOf = (brand?: string) =>
  (brand ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
const round1 = (value: number) => Math.round(value * 10) / 10;

/** Mots qui décrivent le produit : sans marque, quantités, mots vides ni mots de moins de 3 lettres. */
export function nameTokens(name: string, brand?: string): string[] {
  const brandWords = new Set(brandsOf(brand).flatMap(words));
  return words(name)
    .filter((word) => word.length >= 3 && !STOP_WORDS.has(word) && !brandWords.has(word) && !QUANTITY.test(word))
    .map(stem)
    .slice(0, MAX_TOKENS);
}

/** Filtre de recherche sur la première marque (accents gardés, guillemets retirés). */
export function brandFilter(brand?: string): string | null {
  const first = brandsOf(brand)[0];
  if (!first) return null;
  const cleaned = first
    .toLowerCase()
    .replace(/["\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned ? `brands:"${cleaned}"` : null;
}

/** Mots du nom d'un produit trouvé, avec les mots accolés deux à deux (« Pasta Box » → « pastabox »). */
function comparableWords(name: string): Set<string> {
  const list = words(name);
  const pairs = list.slice(1).map((word, index) => list[index] + word);
  return new Set([...list, ...pairs].map(stem));
}

/** Calories cohérentes avec les macros (4 kcal/g de protéines et glucides, 9 kcal/g de lipides). */
function isConsistent(food: NormalizedFood): boolean {
  const fromMacros = 4 * food.protein_g + 4 * food.carbs_g + 9 * food.fat_g;
  return Math.abs(food.kcal_per_100g - fromMacros) <= Math.max(20, 0.2 * food.kcal_per_100g);
}

export function nutritionOf(food: NormalizedFood): NutritionPer100 {
  return {
    kcal_per_100g: food.kcal_per_100g,
    protein_g: food.protein_g,
    fat_g: food.fat_g,
    carbs_g: food.carbs_g,
    fiber_g: food.fiber_g ?? 0,
  };
}

/** Produits retenus, du plus proche au moins proche (à égalité, l'ordre de recherche est gardé). */
export function rankSimilarProducts(target: SimilarTarget, candidates: NormalizedFood[]): RankedProduct[] {
  const tokens = nameTokens(target.name, target.brand);
  if (tokens.length === 0) return [];
  const targetBrand = brandsOf(target.brand)[0];
  const foldedBrand = targetBrand ? fold(targetBrand) : null;
  const seen = new Set<string>();
  const ranked: RankedProduct[] = [];

  for (const food of candidates) {
    if (food.offCode === target.code || !(food.kcal_per_100g > 0) || !isConsistent(food)) continue;
    const available = comparableWords(food.name);
    const shared = tokens.filter((token) => available.has(token)).length;
    if (shared === 0) continue;
    const key = `${nameTokens(food.name).join(' ')}|${Math.round(food.kcal_per_100g)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const sameBrand = foldedBrand !== null && brandsOf(food.brand).some((brand) => fold(brand) === foldedBrand);
    ranked.push({ food, sameBrand, score: shared / tokens.length + (sameBrand ? SAME_BRAND_BONUS : 0) });
  }

  // Tri stable : à score égal, l'ordre de recherche (même marque d'abord) est conservé
  return ranked.sort((a, b) => b.score - a.score);
}

function combine(values: number[]): number {
  if (values.length === 1) return values[0];
  if (values.length === 2) return (values[0] + values[1]) / 2;
  return [...values].sort((a, b) => a - b)[1];
}

/** Estimation d'après les produits au meilleur score (3 au plus). */
export function estimateFromSimilar(ranked: RankedProduct[]): SimilarEstimate | null {
  if (ranked.length === 0) return null;
  const best = ranked[0].score;
  const used = ranked.filter((item) => item.score >= best - SCORE_TOLERANCE).slice(0, MAX_USED);
  const pick = (key: keyof NutritionPer100) => combine(used.map((item) => nutritionOf(item.food)[key]));
  return {
    values: {
      kcal_per_100g: Math.round(pick('kcal_per_100g')),
      protein_g: round1(pick('protein_g')),
      fat_g: round1(pick('fat_g')),
      carbs_g: round1(pick('carbs_g')),
      fiber_g: round1(pick('fiber_g')),
    },
    used,
    proximity: used.every((item) => item.sameBrand) ? 'same-brand' : 'other-brands',
    choices: [...used, ...ranked.filter((item) => !used.includes(item))].slice(0, MAX_CHOICES),
  };
}

/** « Pasta Box fusilli à la bolognaise (Sodebo) » */
export function productOrigin(food: NormalizedFood): string {
  const brand = brandsOf(food.brand)[0];
  return brand ? `${food.name} (${brand})` : food.name;
}

/** Marques distinctes des produits utilisés (2 au plus). */
function usedBrands(estimate: SimilarEstimate): string[] {
  const brands: string[] = [];
  for (const item of estimate.used) {
    const brand = brandsOf(item.food.brand)[0];
    if (brand && !brands.includes(brand)) brands.push(brand);
  }
  return brands.slice(0, 2);
}

/** Un produit : son nom et sa marque ; sinon les marques. */
export function estimateOrigin(estimate: SimilarEstimate): string {
  if (estimate.used.length === 1) return productOrigin(estimate.used[0].food);
  return usedBrands(estimate).join(', ');
}

/** Source affichée dans le bandeau du formulaire, après « d'après ». */
export function estimateSource(estimate: SimilarEstimate): string {
  if (estimate.used.length === 1) return `1 produit proche : ${productOrigin(estimate.used[0].food)}`;
  const brands = usedBrands(estimate);
  return `${estimate.used.length} produits proches${brands.length > 0 ? ` (${brands.join(', ')})` : ''}`;
}

export function estimateSummary(estimate: SimilarEstimate): string {
  if (estimate.used.length === 1) return 'D’après le produit le plus proche';
  if (estimate.used.length === 2) return 'Moyenne des 2 produits les plus proches';
  return `Médiane des ${estimate.used.length} produits les plus proches`;
}

/**
 * Cherche les produits proches d'un produit scanné sans valeurs.
 * Une recherche en échec est ignorée si l'autre répond ; une annulation est propagée.
 */
export async function findSimilarProducts(target: SimilarTarget, signal?: AbortSignal): Promise<SimilarEstimate | null> {
  const tokens = nameTokens(target.name, target.brand);
  if (tokens.length === 0) return null;
  const terms = tokens.join(' ');
  const brand = brandFilter(target.brand);
  const queries = brand ? [`${brand} ${terms}`, terms] : [terms];

  const results = await Promise.allSettled(queries.map((query) => searchOFF(query, signal, SEARCH_SIZE)));
  if (signal?.aborted) {
    const rejected = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');
    throw rejected ? rejected.reason : new DOMException('Aborted', 'AbortError');
  }
  const candidates = results.flatMap((result) => (result.status === 'fulfilled' ? result.value : []));
  return estimateFromSimilar(rankSimilarProducts(target, candidates));
}
