import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const dataset = [
  { code: 1, name: 'Pâtes cuites', kcal_per_100g: '131', protein_g: 5, fat_g: 1.1, carbs_g: 25, fiber_g: 1.8 },
  { code: 2, name: 'Pomme, crue', kcal_per_100g: 52, protein_g: 0.3, fat_g: 0.2, carbs_g: 14, fiber_g: 2.4 },
  { code: 3, name: 'Compote de pomme', kcal_per_100g: 70 },
  { code: 4, name: 'Œuf entier', kcal_per_100g: 155 },
  { code: 5, name: 'Pomme de terre', kcal_per_100g: 80 },
  { code: 6, name: 'Tomate', kcal_per_100g: 18 },
  { code: 7, name: 'Maté infusion', kcal_per_100g: 2 },
  { code: 8, name: 'Cr�pe nature', kcal_per_100g: 220 },
];

function mockFetch(body: string, ok = true) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok,
    text: () => Promise.resolve(body),
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

// Le module garde un cache en mémoire : on le recharge à chaque test
async function loadModule() {
  return import('./ciqual');
}

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('searchCiqual', () => {
  it('ignore les recherches de moins de 2 caractères sans requête réseau', async () => {
    const fetchMock = mockFetch(JSON.stringify(dataset));
    const { searchCiqual } = await loadModule();

    expect(await searchCiqual('p')).toEqual([]);
    expect(await searchCiqual('   ')).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('ne tient pas compte des accents ni des ligatures', async () => {
    mockFetch(JSON.stringify(dataset));
    const { searchCiqual } = await loadModule();

    expect((await searchCiqual('pates')).map((f) => f.name)).toEqual(['Pâtes cuites']);
    expect((await searchCiqual('OEUF')).map((f) => f.name)).toEqual(['Œuf entier']);
  });

  it('classe les débuts de mot avant les correspondances au milieu', async () => {
    mockFetch(JSON.stringify(dataset));
    const { searchCiqual } = await loadModule();

    expect((await searchCiqual('mate')).map((f) => f.name)).toEqual(['Maté infusion', 'Tomate']);
  });

  it('privilégie les noms courts à score égal', async () => {
    mockFetch(JSON.stringify(dataset));
    const { searchCiqual } = await loadModule();

    expect((await searchCiqual('pomme')).map((f) => f.name)).toEqual([
      'Pomme, crue',
      'Pomme de terre',
      'Compote de pomme',
    ]);
  });

  it('exige que tous les mots soient présents', async () => {
    mockFetch(JSON.stringify(dataset));
    const { searchCiqual } = await loadModule();

    expect((await searchCiqual('pomme terre')).map((f) => f.name)).toEqual(['Pomme de terre']);
  });

  it('tolère les caractères corrompus du jeu de données', async () => {
    mockFetch(JSON.stringify(dataset));
    const { searchCiqual } = await loadModule();

    expect((await searchCiqual('crepe')).map((f) => f.name)).toEqual(['Cr�pe nature']);
  });

  it('normalise les valeurs nutritionnelles', async () => {
    mockFetch(JSON.stringify(dataset));
    const { searchCiqual } = await loadModule();

    const [pates] = await searchCiqual('pates');
    expect(pates).toEqual({
      source: 'ciqual',
      name: 'Pâtes cuites',
      brand: undefined,
      imageUrl: undefined,
      offCode: undefined,
      extCode: '1',
      kcal_per_100g: 131,
      protein_g: 5,
      fat_g: 1.1,
      carbs_g: 25,
      fiber_g: 1.8,
    });

    const [oeuf] = await searchCiqual('oeuf');
    expect(oeuf.protein_g).toBe(0); // valeur absente → 0
  });
});

describe('loadCiqual', () => {
  it('ne télécharge le fichier qu’une seule fois (cache)', async () => {
    const fetchMock = mockFetch(JSON.stringify(dataset));
    const { searchCiqual } = await loadModule();

    await searchCiqual('pomme');
    await searchCiqual('tomate');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/data/ciqual-min.json', { cache: 'force-cache' });
  });

  it('gère un fichier commençant par un BOM UTF-8', async () => {
    mockFetch('﻿' + JSON.stringify(dataset));
    const { loadCiqual } = await loadModule();

    expect(await loadCiqual()).toHaveLength(dataset.length);
  });

  it('renvoie une liste vide si le téléchargement échoue', async () => {
    mockFetch('', false);
    const { loadCiqual, searchCiqual } = await loadModule();

    expect(await loadCiqual()).toEqual([]);
    expect(await searchCiqual('pomme')).toEqual([]);
  });
});
