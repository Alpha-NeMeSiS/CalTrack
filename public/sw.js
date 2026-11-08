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

const CACHE_NAME = 'caltrack-v1';
const APP_SHELL = ['/', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/favicon.svg'];

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
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
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

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);
  return cached || network;
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
    event.respondWith(staleWhileRevalidate(request));
  }
});
