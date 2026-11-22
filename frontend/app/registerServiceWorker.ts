// Enregistre le service worker (public/sw.js) en production uniquement :
// en développement, il mettrait en cache des fichiers que Vite recharge à chaud.
export function registerServiceWorker() {
  if (!import.meta.env.PROD || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      // Non bloquant : l'application fonctionne sans service worker
      console.error('Service worker registration failed:', error);
    });
  });
}
