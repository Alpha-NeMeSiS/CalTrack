// Tests du service worker (public/sw.js) — audit A-14.
//
// sw.js s'exécute dans un « ServiceWorkerGlobalScope » : on simule ici le
// minimum (self, caches, fetch) puis on déclenche ses gestionnaires
// d'événements. L'enjeu : la purge des anciens fichiers /assets/ ne doit PAS
// supprimer ceux de la version en cours, sinon l'application ne s'ouvrirait
// plus hors connexion.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const SW_SOURCE = readFileSync(join(__dirname, '../../public/sw.js'), 'utf8');

const ORIGIN = 'https://caltrack-ap.netlify.app';

/**
 * Cache minimal conforme à l'API Cache, adossé à une Map.
 * Important : les clés d'un vrai cache sont des Request dont `url` est
 * TOUJOURS absolue (les chemins relatifs sont résolus selon la portée du
 * service worker). Le simulateur fait pareil, sinon il laisserait passer un
 * `new URL(request.url)` qui échoue en production.
 */
class FakeCache {
  store = new Map<string, { body: string; ok: boolean }>();

  private key(request: string | { url: string }): string {
    return new URL(typeof request === 'string' ? request : request.url, ORIGIN).href;
  }

  /** Chemins stockés, pour les assertions (plus lisible que les URL complètes) */
  paths(): string[] {
    return [...this.store.keys()].map((url) => new URL(url).pathname);
  }

  async put(request: string | { url: string }, response: { body?: string }) {
    this.store.set(this.key(request), { body: response?.body ?? '', ok: true });
  }

  async match(request: string | { url: string }) {
    const found = this.store.get(this.key(request));
    if (!found) return undefined;
    return {
      ...found,
      clone: () => ({ text: async () => found.body }),
      text: async () => found.body,
    };
  }

  async keys() {
    return [...this.store.keys()].map((url) => ({ url }));
  }

  async delete(request: string | { url: string }) {
    return this.store.delete(this.key(request));
  }

  async addAll(urls: string[]) {
    for (const url of urls) this.store.set(this.key(url), { body: '', ok: true });
  }
}

interface Harness {
  listeners: Record<string, (event: unknown) => void>;
  cache: FakeCache;
  caches: { names: Set<string>; deleted: string[] };
  claimed: boolean;
  /** URLs passées à clients.openWindow */
  opened: string[];
}

/** Charge sw.js dans un environnement simulé et renvoie de quoi le piloter. */
function loadServiceWorker(initialCacheEntries: Record<string, string> = {}): Harness {
  const listeners: Record<string, (event: unknown) => void> = {};
  const cache = new FakeCache();
  for (const [url, body] of Object.entries(initialCacheEntries)) {
    cache.store.set(new URL(url, ORIGIN).href, { body, ok: true });
  }
  const names = new Set<string>(['caltrack-v2', 'caltrack-v1-ancien']);
  const deleted: string[] = [];
  const opened: string[] = [];
  const harness: Harness = { listeners, cache, caches: { names, deleted }, claimed: false, opened };

  const fakeSelf = {
    addEventListener: (type: string, handler: (event: unknown) => void) => {
      listeners[type] = handler;
    },
    skipWaiting: vi.fn(),
    clients: {
      claim: vi.fn(() => {
        harness.claimed = true;
        return Promise.resolve();
      }),
      matchAll: vi.fn(async () => []),
      openWindow: vi.fn(async (url: string) => {
        opened.push(url);
        return null;
      }),
    },
    location: { origin: ORIGIN },
    registration: { showNotification: vi.fn() },
  };

  const fakeCaches = {
    open: async () => cache,
    keys: async () => [...names],
    delete: async (name: string) => {
      deleted.push(name);
      return names.delete(name);
    },
  };

  // sw.js est chargé comme du code, avec un environnement simulé en argument
  const run = new Function('self', 'caches', 'fetch', 'URL', SW_SOURCE);
  run(fakeSelf, fakeCaches, vi.fn(), URL);
  return harness;
}

/** Déclenche un événement et attend le travail passé à waitUntil. */
async function dispatch(harness: Harness, type: string, extra: Record<string, unknown> = {}) {
  const pending: Promise<unknown>[] = [];
  const event = { waitUntil: (p: Promise<unknown>) => pending.push(p), ...extra };
  harness.listeners[type](event);
  await Promise.all(pending);
}

describe('service worker : activation', () => {
  let harness: Harness;

  beforeEach(() => {
    // La page d'accueil en cache ne référence que les fichiers de la version
    // en cours : index-NOUVEAU.js et index-NOUVEAU.css
    harness = loadServiceWorker({
      '/': '<script src="/assets/index-NOUVEAU.js"></script><link href="/assets/index-NOUVEAU.css">',
      '/assets/index-NOUVEAU.js': 'nouveau',
      '/assets/index-NOUVEAU.css': 'nouveau',
      '/assets/index-ANCIEN.js': 'ancien',
      '/assets/index-ENCORE-PLUS-ANCIEN.js': 'très ancien',
      '/icons/icon-192.png': 'png',
    });
  });

  it('supprime les caches des anciennes versions du service worker', async () => {
    await dispatch(harness, 'activate');
    expect(harness.caches.deleted).toEqual(['caltrack-v1-ancien']);
  });

  it('purge les fichiers /assets/ que la page d’accueil ne référence plus', async () => {
    await dispatch(harness, 'activate');
    expect(harness.cache.paths()).not.toContain('/assets/index-ANCIEN.js');
    expect(harness.cache.paths()).not.toContain('/assets/index-ENCORE-PLUS-ANCIEN.js');
  });

  it('GARDE les fichiers de la version en cours (sinon plus rien hors connexion)', async () => {
    await dispatch(harness, 'activate');
    const kept = harness.cache.paths();
    expect(kept).toContain('/');
    expect(kept).toContain('/assets/index-NOUVEAU.js');
    expect(kept).toContain('/assets/index-NOUVEAU.css');
  });

  it('ne touche pas aux fichiers hors /assets/ (icônes, base CIQUAL)', async () => {
    await dispatch(harness, 'activate');
    expect(harness.cache.paths()).toContain('/icons/icon-192.png');
  });

  it('prend le contrôle des pages ouvertes', async () => {
    await dispatch(harness, 'activate');
    expect(harness.claimed).toBe(true);
  });

  it('ne purge rien si la page d’accueil n’est pas en cache', async () => {
    const empty = loadServiceWorker({ '/assets/index-ANCIEN.js': 'ancien' });
    await dispatch(empty, 'activate');
    expect(empty.cache.paths()).toContain('/assets/index-ANCIEN.js');
  });
});

describe('service worker : clic sur une notification', () => {
  it('n’ouvre qu’un chemin interne, jamais un domaine extérieur', async () => {
    const harness = loadServiceWorker();
    const close = vi.fn();

    await dispatch(harness, 'notificationclick', {
      notification: { close, data: { url: 'https://site-malveillant.example/phishing' } },
    });

    expect(close).toHaveBeenCalled();
    expect(harness.opened).toEqual(['https://caltrack-ap.netlify.app/']);
  });

  it('refuse aussi une URL sans schéma (//autre-domaine)', async () => {
    const harness = loadServiceWorker();
    await dispatch(harness, 'notificationclick', {
      notification: { close: vi.fn(), data: { url: '//autre-domaine.example/x' } },
    });
    expect(harness.opened).toEqual(['https://caltrack-ap.netlify.app/']);
  });

  it('accepte un chemin relatif de l’application', async () => {
    const harness = loadServiceWorker();
    await dispatch(harness, 'notificationclick', {
      notification: { close: vi.fn(), data: { url: '/?view=trends' } },
    });
    expect(harness.opened).toEqual(['https://caltrack-ap.netlify.app/?view=trends']);
  });
});
