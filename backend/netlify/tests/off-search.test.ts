// @vitest-environment node
// NB : ce test ne doit PAS être placé dans backend/netlify/functions/ : Netlify y traite
// chaque fichier comme une fonction, et « off-search.test » est un nom invalide.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { handler } from '../functions/off-search';
import { clearNutritionCache } from '../lib/productNutrition';
import { resetRateLimit } from '../lib/rateLimit';

function mockFetchJson(body: unknown, status = 200) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  clearNutritionCache();
  // Le garde-fou de débit (audit A-10) garde son compteur en mémoire entre les
  // appels : sans remise à zéro, les tests finiraient par recevoir un 429.
  resetRateLimit();
});

describe('fonction Netlify off-search (proxy Open Food Facts)', () => {
  it('renvoie une liste vide sans appeler OFF pour une recherche trop courte', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    for (const params of [undefined, null, {}, { q: '' }, { q: ' ab ' }]) {
      const response = await handler({ queryStringParameters: params });
      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({ products: [] });
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('interroge search.openfoodfacts.org en français', async () => {
    const fetchMock = mockFetchJson({ hits: [] });

    await handler({ queryStringParameters: { q: '  yaourt nature ' } });

    const [url, options] = fetchMock.mock.calls[0];
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe('https://search.openfoodfacts.org/search');
    expect(parsed.searchParams.get('q')).toBe(
      '(yaourt OR brands:"yaourt" OR brands:"xx:yaourt" OR brands:"Yaourt" OR brands:"xx:Yaourt") AND ' +
        '(nature OR brands:"nature" OR brands:"xx:nature" OR brands:"Nature" OR brands:"xx:Nature")'
    );
    expect(parsed.searchParams.get('langs')).toBe('fr');
    expect(parsed.searchParams.get('page_size')).toBe('10');
    expect(parsed.searchParams.get('fields')).toContain('nutriments');
    expect(options.headers['User-Agent']).toMatch(/^CalTrack\//);
  });

  it('« size » choisit le nombre de résultats (1 à 30, sinon 10)', async () => {
    const cases: Array<[string | undefined, string]> = [
      ['30', '30'],
      ['1', '1'],
      ['0', '10'],
      ['31', '10'],
      ['abc', '10'],
      ['12.5', '10'],
      [undefined, '10'],
    ];
    for (const [size, expected] of cases) {
      const fetchMock = mockFetchJson({ hits: [] });
      await handler({ queryStringParameters: { q: 'pastabox bolognaise', ...(size === undefined ? {} : { size }) } });
      const parsed = new URL(fetchMock.mock.calls[0][0]);
      expect(parsed.searchParams.get('page_size'), `size=${size}`).toBe(expected);
    }
  });

  it('convertit les résultats au format attendu par le client (marques en texte)', async () => {
    mockFetchJson({
      hits: [
        {
          code: '3270190024309',
          product_name: 'Yaourt nature',
          product_name_fr: 'Yaourt nature',
          brands: ['Carrefour', 'Carrefour Bio'],
          image_small_url: 'https://img/yaourt.jpg',
          nutriments: { 'energy-kcal_100g': 53, proteins_100g: 4.1 },
        },
        { code: '1', product_name: 'Sans marque', nutriments: { 'energy-kcal_100g': 20 } },
      ],
    });

    const response = await handler({ queryStringParameters: { q: 'yaourt' } });

    expect(response.statusCode).toBe(200);
    expect(response.headers['Cache-Control']).toBe('public, max-age=300');
    expect(JSON.parse(response.body)).toEqual({
      products: [
        {
          code: '3270190024309',
          product_name: 'Yaourt nature',
          product_name_fr: 'Yaourt nature',
          brands: 'Carrefour, Carrefour Bio',
          image_small_url: 'https://img/yaourt.jpg',
          nutriments: { 'energy-kcal_100g': 53, proteins_100g: 4.1 },
        },
        { code: '1', product_name: 'Sans marque', nutriments: { 'energy-kcal_100g': 20 } },
      ],
    });
  });

  it("tolère une réponse sans liste de résultats", async () => {
    mockFetchJson({ unexpected: true });
    const response = await handler({ queryStringParameters: { q: 'yaourt' } });
    expect(JSON.parse(response.body)).toEqual({ products: [] });
  });

  it("relaie le code d'erreur d'OFF sans le mettre en cache", async () => {
    mockFetchJson({}, 503);

    const response = await handler({ queryStringParameters: { q: 'nutella' } });

    expect(response.statusCode).toBe(503);
    expect(response.headers['Cache-Control']).toBe('no-store');
    expect(JSON.parse(response.body)).toEqual({ error: 'Open Food Facts upstream error', status: 503 });
  });

  it('réessaie une fois quand OFF a une panne passagère', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 503, json: () => Promise.resolve({}) })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            hits: [{ code: '3250390258957', product_name: 'Nectar multifruits', nutriments: { 'energy-kcal_100g': 37 } }],
          }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const response = await handler({ queryStringParameters: { q: 'paquito multifruits' } });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).products[0].product_name).toBe('Nectar multifruits');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  describe('requête envoyée à l’index (mots combinés en ET depuis novembre 2026)', () => {
    async function sentQuery(q: string, mode?: string) {
      const fetchMock = mockFetchJson({ hits: [] });
      await handler({ queryStringParameters: mode ? { q, mode } : { q } });
      return new URL(fetchMock.mock.calls[0][0]).searchParams.get('q');
    }

    it('cherche chaque mot dans le nom ou la marque, sans les petits mots', async () => {
      expect(await sentQuery("Jus de pomme d'Paquito")).toBe(
        '(jus OR brands:"jus" OR brands:"xx:jus" OR brands:"Jus" OR brands:"xx:Jus") AND ' +
          '(pomme OR brands:"pomme" OR brands:"xx:pomme" OR brands:"Pomme" OR brands:"xx:Pomme") AND ' +
          '(paquito OR brands:"paquito" OR brands:"xx:paquito" OR brands:"Paquito" OR brands:"xx:Paquito")'
      );
    });

    it('retire les caractères spéciaux de la syntaxe de recherche', async () => {
      expect(await sentQuery('pâte à tartiner!*')).toBe(
        '(pâte OR brands:"pâte" OR brands:"xx:pâte" OR brands:"Pâte" OR brands:"xx:Pâte") AND ' +
          '(tartiner OR brands:"tartiner" OR brands:"xx:tartiner" OR brands:"Tartiner" OR brands:"xx:Tartiner")'
      );
    });

    it('laisse passer une requête avancée demandée par l’application (mode=advanced)', async () => {
      const advanced = '(brands:"Sodebo" OR brands:"xx:sodebo") AND (pastabox OR fusilli)';
      expect(await sentQuery(advanced, 'advanced')).toBe(advanced);
      expect(await sentQuery('pastabox OR fusilli OR bolognaise', 'advanced')).toBe(
        'pastabox OR fusilli OR bolognaise'
      );
    });

    // Audit A-28 : sans mode=advanced, la syntaxe de l'index est nettoyée.
    // Sinon n'importe qui pouvait injecter une requête arbitraire via /api/off/search.
    it('nettoie une syntaxe avancée venue d’une saisie libre', async () => {
      const injected = 'brands:"x" OR (nutriments.salt_100g:[0 TO 999])';
      const sent = await sentQuery(injected);
      expect(sent).not.toBe(injected);
      expect(sent).not.toContain('nutriments.salt_100g');
      expect(sent).toContain(' AND ');
    });

    it('garde la saisie si elle ne contient que des petits mots', async () => {
      expect(await sentQuery('de la')).toBe('de la');
    });
  });

  describe('index de recherche sans valeurs nutritionnelles (depuis novembre 2026)', () => {
    const searchResponse = (hits: unknown[]) => ({ ok: true, status: 200, json: () => Promise.resolve({ hits }) });
    const productResponse = (product: unknown) => ({ ok: true, status: 200, json: () => Promise.resolve({ status: 1, product }) });

    it('complète les valeurs manquantes depuis la fiche produit', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(
          searchResponse([
            { code: '3250390258957', product_name: 'Paquito Nectar Multifruits', brands: ['xx:paquito'], nutriments: null },
            { code: '3017620422003', product_name: 'Nutella', brands: ['Ferrero'], nutriments: { 'energy-kcal_100g': 539 } },
          ])
        )
        .mockResolvedValueOnce(
          productResponse({ nutriments: { 'energy-kcal_100g': 37, carbohydrates_100g: 9 }, serving_size: '150 ml' })
        );
      vi.stubGlobal('fetch', fetchMock);

      const response = await handler({ queryStringParameters: { q: 'paquito multifruits' } });
      const { products } = JSON.parse(response.body);

      expect(response.statusCode).toBe(200);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(fetchMock.mock.calls[1][0]).toContain('/api/v2/product/3250390258957');
      expect(products[0]).toMatchObject({
        code: '3250390258957',
        nutriments: { 'energy-kcal_100g': 37, carbohydrates_100g: 9 },
        serving_size: '150 ml',
      });
      // Les valeurs déjà présentes ne déclenchent pas de requête
      expect(products[1].nutriments).toEqual({ 'energy-kcal_100g': 539 });
    });

    it('garde le produit sans valeurs si sa fiche est indisponible', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(searchResponse([{ code: '1', product_name: 'Mystère', nutriments: null }]))
        .mockRejectedValueOnce(new Error('ECONNRESET'));
      vi.stubGlobal('fetch', fetchMock);
      vi.spyOn(console, 'warn').mockImplementation(() => {}); // signalé dans les journaux

      const response = await handler({ queryStringParameters: { q: 'mystere' } });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body).products).toEqual([
        expect.objectContaining({ code: '1', product_name: 'Mystère', nutriments: {} }),
      ]);
    });

    it('écarte un produit dont la fiche est lue mais vide ou introuvable (inutilisable)', async () => {
      const fetchMock = vi.fn((url: string) => {
        if (!url.includes('/api/v2/product/')) {
          return Promise.resolve(
            searchResponse([
              { code: '6181003014226', product_name: 'Pâte à tartiner (fiche vide)', nutriments: null },
              { code: '404', product_name: 'Pâte à tartiner (supprimée)', nutriments: null },
              { code: '3266481502847', product_name: 'Pâte à tartiner', nutriments: null },
              { code: '8723700213526', product_name: 'Pâte à tartiner (refusée)', nutriments: null },
            ])
          );
        }
        if (url.includes('/6181003014226')) return Promise.resolve(productResponse({ nutriments: {} }));
        if (url.includes('/404')) return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) });
        if (url.includes('/8723700213526')) return Promise.resolve({ ok: false, status: 429, json: () => Promise.resolve({}) });
        return Promise.resolve(productResponse({ nutriments: { 'energy-kcal_100g': 539 } }));
      });
      vi.stubGlobal('fetch', fetchMock);
      vi.spyOn(console, 'warn').mockImplementation(() => {});

      const response = await handler({ queryStringParameters: { q: 'pâte à tartiner' } });

      expect(JSON.parse(response.body).products.map((product: { code: string }) => product.code)).toEqual([
        '3266481502847',
        '8723700213526', // non lue : l'app chargera sa fiche au choix
      ]);
    });

    it('complète au plus 10 fiches par recherche', async () => {
      const hits = Array.from({ length: 20 }, (_, index) => ({ code: String(1000 + index), nutriments: null }));
      const fetchMock = vi.fn((url: string) =>
        Promise.resolve(url.includes('/api/v2/product/') ? productResponse({ nutriments: { 'energy-kcal_100g': 50 } }) : searchResponse(hits))
      );
      vi.stubGlobal('fetch', fetchMock);

      await handler({ queryStringParameters: { q: 'jus', size: '20' } });

      expect(fetchMock).toHaveBeenCalledTimes(1 + 10);
    });

    it('réutilise les valeurs déjà lues d’une recherche à l’autre (moins de requêtes)', async () => {
      const hits = [{ code: '3250390258957', product_name: 'Paquito Nectar Multifruits', nutriments: null }];
      const fetchMock = vi.fn((url: string) =>
        Promise.resolve(
          url.includes('/api/v2/product/')
            ? productResponse({ nutriments: { 'energy-kcal_100g': 37 } })
            : searchResponse(hits)
        )
      );
      vi.stubGlobal('fetch', fetchMock);

      await handler({ queryStringParameters: { q: 'paquito' } });
      const second = await handler({ queryStringParameters: { q: 'paquito multi' } });

      const productCalls = fetchMock.mock.calls.filter(([url]) => String(url).includes('/api/v2/product/'));
      expect(productCalls).toHaveLength(1);
      expect(JSON.parse(second.body).products[0].nutriments).toEqual({ 'energy-kcal_100g': 37 });
    });

    it('redemande une fiche refusée (trop de requêtes) au lieu de la garder 30 min sans valeurs', async () => {
      const hits = [{ code: '3242272270157', product_name: 'Sodebo pastabox 330g', nutriments: null }];
      const tooManyRequests = { ok: false, status: 429, json: () => Promise.resolve({}) };
      let productCalls = 0;
      const fetchMock = vi.fn((url: string) => {
        if (!url.includes('/api/v2/product/')) return Promise.resolve(searchResponse(hits));
        productCalls += 1;
        return Promise.resolve(
          productCalls === 1 ? tooManyRequests : productResponse({ nutriments: { 'energy-kcal_prepared_100g': 127 } })
        );
      });
      vi.stubGlobal('fetch', fetchMock);
      vi.spyOn(console, 'warn').mockImplementation(() => {});

      const first = await handler({ queryStringParameters: { q: 'pastabox' } });
      const second = await handler({ queryStringParameters: { q: 'pastabox' } });

      expect(JSON.parse(first.body).products[0].nutriments).toEqual({});
      expect(productCalls).toBe(2);
      expect(JSON.parse(second.body).products[0].nutriments).toEqual({ 'energy-kcal_prepared_100g': 127 });
    });

    it('signale dans les journaux une fiche qui n’a pas pu être lue', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(searchResponse([{ code: '1', product_name: 'Mystère', nutriments: null }]))
        .mockResolvedValueOnce({ ok: false, status: 429, json: () => Promise.resolve({}) });
      vi.stubGlobal('fetch', fetchMock);
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await handler({ queryStringParameters: { q: 'mystere' } });

      expect(warn).toHaveBeenCalledWith(expect.stringContaining('HTTP 429'));
    });

    it('nettoie les marques au format « xx: » de l’index', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(
          searchResponse([
            { code: '1', brands: ['xx:ferrero', 'xx:nutella', 'xx:Ferrero'], nutriments: { 'energy-kcal_100g': 539 } },
            { code: '2', brands: ['xx:Côté Snack', 'Marque Repère'], nutriments: { 'energy-kcal_100g': 140 } },
          ])
        )
      );

      const { products } = JSON.parse((await handler({ queryStringParameters: { q: 'nutella' } })).body);

      expect(products.map((product: { brands?: string }) => product.brands)).toEqual(['Ferrero, Nutella', 'Côté Snack, Marque Repère']);
    });
  });

  it('renvoie 503 (non mis en cache) si OFF est injoignable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNRESET')));

    const response = await handler({ queryStringParameters: { q: 'nutella' } });

    expect(response.statusCode).toBe(503);
    expect(response.headers['Cache-Control']).toBe('no-store');
    expect(JSON.parse(response.body)).toEqual({ error: 'Open Food Facts unavailable', status: 503 });
  });
});
