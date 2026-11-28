// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest';
import {
  clientIp,
  isRateLimited,
  RATE_LIMIT_MAX_REQUESTS,
  RATE_LIMIT_WINDOW_MS,
  resetRateLimit,
  TOO_MANY_REQUESTS,
} from '../lib/rateLimit';

describe('isRateLimited', () => {
  beforeEach(resetRateLimit);

  it('laisse passer jusqu’à la limite', () => {
    for (let i = 0; i < RATE_LIMIT_MAX_REQUESTS; i++) {
      expect(isRateLimited('1.2.3.4')).toBe(false);
    }
  });

  it('refuse l’appel suivant', () => {
    for (let i = 0; i < RATE_LIMIT_MAX_REQUESTS; i++) isRateLimited('1.2.3.4');
    expect(isRateLimited('1.2.3.4')).toBe(true);
  });

  it('compte chaque appelant séparément', () => {
    for (let i = 0; i < RATE_LIMIT_MAX_REQUESTS + 5; i++) isRateLimited('1.2.3.4');
    expect(isRateLimited('5.6.7.8')).toBe(false);
  });

  it('oublie les appels sortis de la fenêtre', () => {
    const start = 1_000_000;
    for (let i = 0; i < RATE_LIMIT_MAX_REQUESTS + 5; i++) isRateLimited('1.2.3.4', start);
    expect(isRateLimited('1.2.3.4', start)).toBe(true);
    // Une minute plus tard, le compteur est repassé à zéro
    expect(isRateLimited('1.2.3.4', start + RATE_LIMIT_WINDOW_MS + 1)).toBe(false);
  });

  it('glisse avec le temps (fenêtre mobile, pas remise à zéro brutale)', () => {
    const start = 2_000_000;
    // La moitié des appels maintenant, l'autre moitié 30 s plus tard
    for (let i = 0; i < RATE_LIMIT_MAX_REQUESTS; i++) isRateLimited('9.9.9.9', start);
    expect(isRateLimited('9.9.9.9', start + 30_000)).toBe(true);
    // 61 s après les premiers : ils sont oubliés, la place se libère
    expect(isRateLimited('9.9.9.9', start + RATE_LIMIT_WINDOW_MS + 1)).toBe(false);
  });
});

describe('clientIp', () => {
  it('utilise l’en-tête de Netlify', () => {
    expect(clientIp({ 'x-nf-client-connection-ip': '203.0.113.7' })).toBe('203.0.113.7');
  });

  it('retombe sur la première adresse de x-forwarded-for', () => {
    expect(clientIp({ 'x-forwarded-for': '203.0.113.7, 70.41.3.18' })).toBe('203.0.113.7');
  });

  it('préfère l’en-tête de Netlify à x-forwarded-for (que le client peut forger)', () => {
    expect(
      clientIp({ 'x-nf-client-connection-ip': '203.0.113.7', 'x-forwarded-for': '1.1.1.1' })
    ).toBe('203.0.113.7');
  });

  it('regroupe les appels sans en-tête sous un même compteur', () => {
    expect(clientIp({})).toBe('unknown');
    expect(clientIp(null)).toBe('unknown');
    expect(clientIp(undefined)).toBe('unknown');
  });
});

describe('réponse 429', () => {
  it('ne doit pas être mise en cache et indique un délai', () => {
    expect(TOO_MANY_REQUESTS.statusCode).toBe(429);
    expect(TOO_MANY_REQUESTS.headers['Cache-Control']).toBe('no-store');
    expect(TOO_MANY_REQUESTS.headers['Retry-After']).toBe('60');
    expect(JSON.parse(TOO_MANY_REQUESTS.body)).toEqual({ error: 'rate_limited', status: 429 });
  });
});

// Branchement effectif dans les deux fonctions publiques
describe('les fonctions proxy appliquent la limite', () => {
  beforeEach(resetRateLimit);

  it('off-search répond 429 au-delà de la limite', async () => {
    const { handler } = await import('../functions/off-search');
    const event = {
      queryStringParameters: { q: 'yaourt' },
      headers: { 'x-nf-client-connection-ip': '198.51.100.1' },
    };
    // On consomme la limite sans appeler le réseau : seul le compteur compte
    for (let i = 0; i < RATE_LIMIT_MAX_REQUESTS; i++) isRateLimited('198.51.100.1');
    const response = await handler(event);
    expect(response.statusCode).toBe(429);
    expect(response.headers['Cache-Control']).toBe('no-store');
  });

  it('off-product répond 429 au-delà de la limite', async () => {
    const { handler } = await import('../functions/off-product');
    const event = {
      queryStringParameters: { code: '3017620422003' },
      headers: { 'x-nf-client-connection-ip': '198.51.100.2' },
    };
    for (let i = 0; i < RATE_LIMIT_MAX_REQUESTS; i++) isRateLimited('198.51.100.2');
    const response = await handler(event);
    expect(response.statusCode).toBe(429);
  });

  it('un appelant sous la limite n’est pas refusé', async () => {
    const { handler } = await import('../functions/off-search');
    // Requête trop courte : la fonction répond 200 sans appeler le réseau
    const response = await handler({
      queryStringParameters: { q: 'ab' },
      headers: { 'x-nf-client-connection-ip': '198.51.100.3' },
    });
    expect(response.statusCode).toBe(200);
  });
});
