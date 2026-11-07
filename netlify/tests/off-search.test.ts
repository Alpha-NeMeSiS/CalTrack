// @vitest-environment node
// NB : ce test ne doit PAS être placé dans netlify/functions/ : Netlify y traite
// chaque fichier comme une fonction, et « off-search.test » est un nom invalide.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { handler } from '../functions/off-search';

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
    expect(parsed.searchParams.get('q')).toBe('yaourt nature');
    expect(parsed.searchParams.get('langs')).toBe('fr');
    expect(parsed.searchParams.get('page_size')).toBe('10');
    expect(parsed.searchParams.get('fields')).toContain('nutriments');
    expect(options.headers['User-Agent']).toMatch(/^CalTrack\//);
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
        { code: '1', product_name: 'Sans marque' },
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
        { code: '1', product_name: 'Sans marque', nutriments: {} },
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

  it('renvoie 503 (non mis en cache) si OFF est injoignable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNRESET')));

    const response = await handler({ queryStringParameters: { q: 'nutella' } });

    expect(response.statusCode).toBe(503);
    expect(response.headers['Cache-Control']).toBe('no-store');
    expect(JSON.parse(response.body)).toEqual({ error: 'Open Food Facts unavailable', status: 503 });
  });
});
