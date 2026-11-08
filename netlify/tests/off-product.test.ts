// @vitest-environment node
// Placé hors de netlify/functions/ : Netlify y traiterait chaque fichier comme une fonction.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { handler } from '../functions/off-product';

const fetchMock = vi.fn();

afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

const call = (code?: string) => {
  vi.stubGlobal('fetch', fetchMock);
  return handler({ queryStringParameters: code === undefined ? {} : { code } });
};

describe('off-product', () => {
  it('refuse un code qui n’est pas un code-barres', async () => {
    for (const code of [undefined, '', 'abc', '1234567', '123456789012345', '30176204220a3']) {
      const response = await call(code);
      expect(response.statusCode).toBe(400);
      expect(response.headers['Cache-Control']).toBe('no-store');
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('renvoie le produit avec les champs utiles', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          code: '3017620422003',
          status: 1,
          product: {
            code: '3017620422003',
            product_name: 'Nutella',
            brands: 'Nutella, Ferrero',
            image_small_url: 'https://images.openfoodfacts.org/n.jpg',
            nutriments: { 'energy-kcal_100g': 539 },
            serving_size: '15 g',
            ingredients_text: 'ignoré',
          },
        }),
        { status: 200 },
      ),
    );

    const response = await call(' 3017620422003 ');

    expect(response.statusCode).toBe(200);
    expect(response.headers['Cache-Control']).toContain('max-age=');
    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/api/v2/product/3017620422003');
    expect(url.searchParams.get('fields')).toContain('nutriments');
    expect(JSON.parse(response.body)).toEqual({
      product: {
        code: '3017620422003',
        product_name: 'Nutella',
        brands: 'Nutella, Ferrero',
        image_small_url: 'https://images.openfoodfacts.org/n.jpg',
        nutriments: { 'energy-kcal_100g': 539 },
        serving_size: '15 g',
      },
    });
  });

  it('signale un produit inconnu (404 ou statut 0)', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ status: 0, status_verbose: 'product not found' }), { status: 404 }),
    );
    expect((await call('3245678901236')).statusCode).toBe(404);

    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ status: 0 }), { status: 200 }));
    const response = await call('3245678901236');
    expect(response.statusCode).toBe(404);
    expect(JSON.parse(response.body)).toEqual({ error: 'not_found' });
  });

  it('ne met pas en cache une panne d’Open Food Facts', async () => {
    fetchMock.mockResolvedValueOnce(new Response('busy', { status: 503 }));
    const unavailable = await call('3017620422003');
    expect(unavailable.statusCode).toBe(502);
    expect(unavailable.headers['Cache-Control']).toBe('no-store');

    fetchMock.mockRejectedValueOnce(new Error('network'));
    const offline = await call('3017620422003');
    expect(offline.statusCode).toBe(503);
    expect(offline.headers['Cache-Control']).toBe('no-store');
  });
});
