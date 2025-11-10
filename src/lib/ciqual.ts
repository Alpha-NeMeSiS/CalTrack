import type { NormalizedFood } from '../types/food';

let cache: NormalizedFood[] | null = null;

const normalize = (r: any): NormalizedFood => ({
  source: 'ciqual',
  name: r.name,
  brand: undefined,
  imageUrl: undefined,
  offCode: undefined,
  extCode: String(r.code),
  kcal_per_100g: Number(r.kcal_per_100g) || 0,
  protein_g: Number(r.protein_g) || 0,
  fat_g: Number(r.fat_g) || 0,
  carbs_g: Number(r.carbs_g) || 0,
  fiber_g: Number(r.fiber_g) || 0,
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
  return cache;
}

// Normalisation accents + minuscule
const fold = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export async function searchCiqual(q: string): Promise<NormalizedFood[]> {
  if (!q || q.trim().length < 2) return [];
  const data = await loadCiqual();
  const fq = fold(q.trim());

  // scoring simple: priorité aux débuts de chaîne
  const scored = data
    .map((f) => {
      const name = fold(f.name);
      const idx = name.indexOf(fq);
      const score = idx < 0 ? 0 : name.startsWith(fq) ? 3 : 1;
      return { f, score };
    })
    .filter((x) => x.score > 0);

  scored.sort((a, b) => b.score - a.score || a.f.name.length - b.f.name.length);
  return scored.slice(0, 20).map((x) => x.f);
}
