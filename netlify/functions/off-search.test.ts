// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { handler } from './off-search';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fonction Netlify off-search (proxy Open Food Facts)', () => {
  it('renvoie une liste vide sans appeler OFF pour une recherche trop courte', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    for (const q of [undefined, '', ' ab ']) {
      const response = await handler({ queryStringParameters: q === undefined ? undefined : { q } });
      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toEqual({ products: [] });
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('interroge OFF et renvoie la réponse telle quelle', async () => {
    const payload = JSON.stringify({ products: [{ product_name: 'Nutella' }] });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, text: () => Promise.resolve(payload) });
    vi.stubGlobal('fetch', fetchMock);

    const response = await handler({ queryStringParameters: { q: '  nutella ' } });

    expect(response.statusCode).toBe(200);
    expect(response.body).toBe(payload);
    expect(response.headers['Cache-Control']).toBe('public, max-age=300');

    const [url, options] = fetchMock.mock.calls[0];
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe('https://world.openfoodfacts.org/cgi/search.pl');
    expect(parsed.searchParams.get('search_terms')).toBe('nutella');
    expect(parsed.searchParams.get('page_size')).toBe('10');
    expect(parsed.searchParams.get('fields')).toContain('nutriments');
    expect(options.headers['User-Agent']).toMatch(/^CalTrack\//);
  });

  it("relaie le code d'erreur d'OFF", async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503, text: () => Promise.resolve('') }));

    const response = await handler({ queryStringParameters: { q: 'nutella' } });

    expect(response.statusCode).toBe(503);
    expect(JSON.parse(response.body)).toEqual({ error: 'Open Food Facts upstream error', status: 503 });
  });

  it('renvoie 503 si OFF est injoignable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNRESET')));

    const response = await handler({ queryStringParameters: { q: 'nutella' } });

    expect(response.statusCode).toBe(503);
    expect(JSON.parse(response.body)).toEqual({ error: 'Open Food Facts unavailable', status: 503 });
  });
});
