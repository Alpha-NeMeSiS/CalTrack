import type { NormalizedFood } from '../types/food';

const fold = (value: string): string =>
  value
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .replace(/ß/g, 'ss')
    .replace(/ø/g, 'o')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');

let cache: NormalizedFood[] | null = null;
let searchIndex: { food: NormalizedFood; normalized: string }[] | null = null;

const buildSearchIndex = (foods: NormalizedFood[]) =>
  foods.map((food) => ({
    food,
    normalized: fold(food.name),
  }));

const normalize = (row: any): NormalizedFood => ({
  source: 'ciqual',
  name: row.name,
  brand: undefined,
  imageUrl: undefined,
  offCode: undefined,
  extCode: String(row.code),
  kcal_per_100g: Number(row.kcal_per_100g) || 0,
  protein_g: Number(row.protein_g) || 0,
  fat_g: Number(row.fat_g) || 0,
  carbs_g: Number(row.carbs_g) || 0,
  fiber_g: Number(row.fiber_g) || 0,
});

// Chargement + cache mémoire
export async function loadCiqual(): Promise<NormalizedFood[]> {
  if (cache) return cache;
  const res = await fetch('/data/ciqual-min.json', { cache: 'force-cache' });
  if (!res.ok) return (cache = []);

  const text = await res.text();
  const cleaned = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows = JSON.parse(cleaned);

  cache = Array.isArray(rows) ? rows.map(normalize) : [];
  searchIndex = buildSearchIndex(cache);
  return cache;
}

export async function searchCiqual(q: string): Promise<NormalizedFood[]> {
  if (!q || q.trim().length < 2) return [];
  const foods = await loadCiqual();
  if (!searchIndex) {
    searchIndex = buildSearchIndex(foods);
  }

  const tokens = fold(q.trim()).split(' ').filter(Boolean);
  if (tokens.length === 0) return [];

  const scored = searchIndex
    .map(({ food, normalized }) => {
      let score = 0;

      for (const token of tokens) {
        const idx = normalized.indexOf(token);
        if (idx < 0) {
          return null;
        }

        const isWordStart = idx === 0 || normalized[idx - 1] === ' ';
        score += isWordStart ? 3 : 1;
      }

      return { food, score };
    })
    .filter((entry): entry is { food: NormalizedFood; score: number } => entry !== null);

  scored.sort((a, b) => b.score - a.score || a.food.name.length - b.food.name.length);
  return scored.slice(0, 20).map((entry) => entry.food);
}
