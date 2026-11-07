import { afterEach, describe, expect, it, vi } from 'vitest';
import { searchOFF } from './openfoodfacts';

function mockFetchJson(body: unknown, ok = true) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok,
    json: () => Promise.resolve(body),
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('searchOFF', () => {
  it("n'appelle pas l'API pour une recherche de moins de 3 caractères", async () => {
    const fetchMock = mockFetchJson({ products: [] });
    expect(await searchOFF('a')).toEqual([]);
    expect(await searchOFF(' ab ')).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('passe par le proxy Netlify et transmet le signal d’annulation', async () => {
    const fetchMock = mockFetchJson({ products: [] });
    const controller = new AbortController();

    await searchOFF('  pâte à tartiner ', controller.signal);

    expect(fetchMock).toHaveBeenCalledWith(
      `/api/off/search?q=${encodeURIComponent('pâte à tartiner')}`,
      { signal: controller.signal }
    );
  });

  it('normalise les produits', async () => {
    mockFetchJson({
      products: [
        {
          code: '3017620422003',
          product_name: 'Nutella',
          product_name_fr: 'Nutella FR',
          brands: 'Ferrero',
          image_small_url: 'https://img/nutella.jpg',
          nutriments: {
            'energy-kcal_100g': 539,
            proteins_100g: '6.3',
            fat_100g: 30.9,
            carbohydrates_100g: 57.5,
          },
        },
      ],
    });

    expect(await searchOFF('nutella')).toEqual([
      {
        source: 'off',
        name: 'Nutella FR',
        brand: 'Ferrero',
        imageUrl: 'https://img/nutella.jpg',
        offCode: '3017620422003',
        extCode: undefined,
        kcal_per_100g: 539,
        protein_g: 6.3,
        fat_g: 30.9,
        carbs_g: 57.5,
        fiber_g: 0,
      },
    ]);
  });

  it('convertit les kJ en kcal si les kcal sont absentes', async () => {
    mockFetchJson({ products: [{ product_name: 'Jus', nutriments: { energy_100g: 418.4 } }] });
    const [food] = await searchOFF('jus');
    expect(food.kcal_per_100g).toBe(100);
  });

  it('écarte les produits sans aucune valeur nutritionnelle', async () => {
    mockFetchJson({
      products: [
        { product_name: 'Vide', nutriments: {} },
        { product_name: 'Sans nutriments' },
        { nutriments: { proteins_100g: 10 } },
      ],
    });
    const results = await searchOFF('test');
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('Produit'); // nom par défaut
  });

  it('lève une erreur si le proxy répond en erreur (affichée par FoodSearch)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503, json: () => Promise.resolve({}) }));
    await expect(searchOFF('nutella')).rejects.toThrow('OFF search failed with status 503');
  });

  it('renvoie une liste vide pour une réponse inattendue', async () => {
    mockFetchJson({ products: 'oops' });
    expect(await searchOFF('nutella')).toEqual([]);
  });
});
