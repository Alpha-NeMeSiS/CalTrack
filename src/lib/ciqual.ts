import type { NormalizedFood } from '../types/food';

let cache: NormalizedFood[] | null = null;

const pickString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const normalizeName = (value: string | undefined): string | undefined => {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed === trimmed.toUpperCase()) {
    const lower = trimmed.toLowerCase();
    return lower.replace(/(^|[\s,;()\/\-])[\p{L}]/gu, (match) => match.toUpperCase());
  }
  return trimmed;
};

const hasValue = (value: unknown): boolean => {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') {
    return value.trim().length > 0;
  }
  return true;
};

const parseNumber = (value: unknown): number => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === 'string') {
    const normalized = value
      .replace(/,/g, '.')
      .replace(/[^0-9+\-\.eE]/g, '')
      .trim();
    if (!normalized) return 0;
    const num = Number(normalized);
    return Number.isFinite(num) ? num : 0;
  }
  return 0;
};

const pickNumber = (record: any, keys: string[]): number => {
  for (const key of keys) {
    if (record && key in record && hasValue(record[key])) {
      const parsed = parseNumber(record[key]);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return 0;
};

const normalize = (r: any): NormalizedFood | null => {
  const rawName =
    pickString(r?.name) ??
    pickString(r?.libelle) ??
    normalizeName(pickString(r?.alim_nom_fr));

  if (!rawName) return null;

  const toCode = (value: unknown): string | undefined => {
    if (typeof value === 'number') return String(value);
    return pickString(value);
  };

  const code = toCode(r?.extCode) ?? toCode(r?.code) ?? toCode(r?.alim_code);

  return {
    source: 'ciqual',
    name: rawName,
    brand: undefined,
    imageUrl: undefined,
    offCode: undefined,
    extCode: code,
    kcal_per_100g: pickNumber(r, ['kcal_per_100g', 'energie_kcal_100g', 'energie_kcal']),
    protein_g: pickNumber(r, ['protein_g', 'proteines_100g']),
    fat_g: pickNumber(r, ['fat_g', 'lipides_100g']),
    carbs_g: pickNumber(r, ['carbs_g', 'glucides_100g']),
    fiber_g: pickNumber(r, ['fiber_g', 'fibres_alimentaires_100g']),
  };
};

// Chargement + cache mémoire
export async function loadCiqual(): Promise<NormalizedFood[]> {
  if (cache) return cache;
  try {
    const res = await fetch('/data/ciqual-min.json', { cache: 'force-cache' });
    if (!res.ok) {
      cache = [];
      return cache;
    }
    const rows = await res.json();
    const normalized = Array.isArray(rows)
      ? rows
          .map(normalize)
          .filter((item): item is NormalizedFood => Boolean(item))
      : [];
    cache = normalized;
    return cache;
  } catch (err) {
    cache = [];
    return cache;
  }
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
