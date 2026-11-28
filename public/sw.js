// Service worker de CalTrack : rend l'application installable et permet
// d'ouvrir l'interface hors connexion (les données restent chargées depuis
// Supabase, jamais mises en cache ici).
//
// Stratégies :
// - pages (navigation) : réseau d'abord, copie en cache en secours hors ligne,
//   pour qu'un nouveau déploiement soit visible immédiatement ;
// - /assets/* (fichiers versionnés par Vite, immuables) : cache d'abord ;
// - autres fichiers statiques du site (icônes, base CIQUAL) : cache puis mise à jour.
// Les appels d'API (/api, fonctions Netlify, Supabase, autres domaines) ne sont
// jamais interceptés.
//
// Notifications : les rappels envoyés par l'Edge Function send-reminders
// arrivent par l'événement « push » ; un clic ouvre (ou ramène) l'application.

const CACHE_NAME = 'caltrack-v2';
const APP_SHELL = ['/', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/favicon-32.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Caches laissés par une ancienne version du service worker
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)));

      // Audit A-14 : les fichiers de /assets/ sont versionnés par Vite (leur nom
      // change à chaque déploiement) et servis « cache d'abord ». Comme
      // CACHE_NAME ne bouge pas, rien ne les supprimait jamais : le cache
      // grossissait sans limite sur l'appareil. On retire ceux que la page
      // d'accueil ne référence plus.
      const cache = await caches.open(CACHE_NAME);
      const shell = await cache.match('/');
      if (shell) {
        const html = await shell.clone().text();
        const stale = (await cache.keys()).filter((request) => {
          const { pathname } = new URL(request.url);
          return pathname.startsWith('/assets/') && !html.includes(pathname);
        });
        await Promise.all(stale.map((request) => cache.delete(request)));
      }

      await self.clients.claim();
    })()
  );
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put('/', response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match('/');
    if (cached) return cached;
    throw error;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

async function staleWhileRevalidate(request, event) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);
  // Audit A-14 : sans waitUntil, le navigateur peut arrêter le service worker
  // avant la fin de l'écriture en cache quand la réponse vient du cache.
  if (cached) {
    event?.waitUntil(network);
    return cached;
  }
  return network;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // Supabase, polices, Open Food Facts…
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/.netlify/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
  } else if (url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirst(request));
  } else {
    event.respondWith(staleWhileRevalidate(request, event));
  }
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'CalTrack', {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-96.png',
      tag: data.tag || 'caltrack',
      data: { url: data.url || '/' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  // Audit A-14 : une URL absolue l'emporterait sur l'origine passée en base
  // (new URL('https://ailleurs/x', origine) → ailleurs). Les notifications sont
  // signées par VAPID et n'arrivent que de notre Edge Function, mais on
  // n'accepte qu'un chemin interne : cela ne coûte rien.
  const raw = (event.notification.data && event.notification.data.url) || '/';
  const path = typeof raw === 'string' && raw.startsWith('/') && !raw.startsWith('//') ? raw : '/';
  const url = new URL(path, self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const existing = windows.find((client) => client.url.startsWith(self.location.origin));
      if (existing) return existing.focus();
      return self.clients.openWindow(url);
    })
  );
});
