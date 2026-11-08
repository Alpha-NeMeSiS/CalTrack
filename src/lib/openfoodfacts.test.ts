import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchOFFProduct, searchOFF } from './openfoodfacts';

function mockFetchJson(body: unknown, ok = true, status = ok ? 200 : 500) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok,
    status,
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

  it('accepte des marques sous forme de liste', async () => {
    mockFetchJson({ products: [{ product_name: 'Yaourt', brands: ['Danone', '', 'Activia'], nutriments: { 'energy-kcal_100g': 60 } }] });
    const [food] = await searchOFF('yaourt');
    expect(food.brand).toBe('Danone, Activia');
  });

  it('remplace les valeurs nutritionnelles négatives ou invalides par 0', async () => {
    mockFetchJson({
      products: [{ product_name: 'Erreur de saisie', nutriments: { 'energy-kcal_100g': 120, proteins_100g: -3, fat_100g: 'abc' } }],
    });
    const [food] = await searchOFF('erreur');
    expect(food.protein_g).toBe(0);
    expect(food.fat_g).toBe(0);
    expect(food.kcal_per_100g).toBe(120);
  });

  it('lit la portion du fabricant (serving_size)', async () => {
    mockFetchJson({ products: [{ product_name: 'Yaourt', serving_size: '1 pot (125 g)', nutriments: { 'energy-kcal_100g': 60 } }] });
    const [food] = await searchOFF('yaourt');
    expect(food.servingGrams).toBe(125);
    expect(food.servingLabel).toBe('1 pot (125 g)');
  });

  it('renvoie une liste vide pour une réponse inattendue', async () => {
    mockFetchJson({ products: 'oops' });
    expect(await searchOFF('nutella')).toEqual([]);
  });
});

describe('fetchOFFProduct', () => {
  it('interroge le proxy Netlify avec le code-barres', async () => {
    const fetchMock = mockFetchJson({ product: { code: '3017620422003', nutriments: { 'energy-kcal_100g': 539 } } });
    const controller = new AbortController();

    await fetchOFFProduct('3017620422003', controller.signal);

    expect(fetchMock).toHaveBeenCalledWith('/api/off/product?code=3017620422003', { signal: controller.signal });
  });

  it('normalise le produit trouvé comme dans la recherche', async () => {
    mockFetchJson({
      product: {
        code: '3017620422003',
        product_name: 'Nutella',
        product_name_fr: 'Pâte à tartiner Nutella',
        brands: 'Nutella, Ferrero',
        image_small_url: 'https://images.openfoodfacts.org/n.jpg',
        nutriments: { 'energy-kcal_100g': 539, proteins_100g: 6.3, fat_100g: 30.9, carbohydrates_100g: 57.5, fiber_100g: '0' },
        serving_size: '15 g',
      },
    });

    expect(await fetchOFFProduct('3017620422003')).toEqual({
      status: 'found',
      food: {
        source: 'off',
        name: 'Pâte à tartiner Nutella',
        brand: 'Nutella, Ferrero',
        imageUrl: 'https://images.openfoodfacts.org/n.jpg',
        offCode: '3017620422003',
        extCode: undefined,
        kcal_per_100g: 539,
        protein_g: 6.3,
        fat_g: 30.9,
        carbs_g: 57.5,
        fiber_g: 0,
        servingGrams: 15,
        servingLabel: '15 g',
      },
    });
  });

  it('distingue un produit sans valeurs nutritionnelles', async () => {
    mockFetchJson({ product: { code: '1234567890128', product_name: 'Mystère', nutriments: {} } });
    expect(await fetchOFFProduct('1234567890128')).toEqual({ status: 'no_nutrition', name: 'Mystère' });
  });

  it('renvoie « introuvable » pour un 404', async () => {
    mockFetchJson({ error: 'not_found' }, false, 404);
    expect(await fetchOFFProduct('3245678901236')).toEqual({ status: 'not_found' });
  });

  it('lève une erreur si le service est indisponible', async () => {
    mockFetchJson({ error: 'unavailable' }, false, 503);
    await expect(fetchOFFProduct('3017620422003')).rejects.toThrow('503');
  });
});
