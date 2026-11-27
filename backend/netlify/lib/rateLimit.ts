// Garde-fou de débit des fonctions proxy Open Food Facts (audit A-10).
//
// Les routes /api/off/* répondent à tout le monde, sans authentification. Or
// une seule recherche peut déclencher jusqu'à 11 appels vers Open Food Facts
// (la recherche, plus ENRICH_LIMIT fiches produit). Sans garde-fou :
//   - les invocations de fonctions consomment les crédits Netlify ;
//   - Open Food Facts peut bloquer les IP partagées de Netlify, ce qui
//     casserait la recherche pour tout le monde (déjà vécu en 2.2.2) ;
//   - l'application sert de proxy gratuit à n'importe quel tiers.
//
// ⚠️ L'état vit en mémoire, donc par instance de fonction : le comptage est
// approximatif et plusieurs instances peuvent tourner en parallèle. C'est un
// garde-fou contre les abus simples, pas une protection forte.
// Placé hors de functions/ : Netlify y traiterait chaque fichier comme une fonction.

export const RATE_LIMIT_WINDOW_MS = 60_000;
export const RATE_LIMIT_MAX_REQUESTS = 30;
/** Au-delà, on oublie les plus anciens appelants (borne la mémoire). */
const MAX_TRACKED_CLIENTS = 5000;

const hits = new Map<string, number[]>();

/** Vide le compteur (tests). */
export function resetRateLimit(): void {
  hits.clear();
}

/**
 * Enregistre un appel et dit s'il dépasse la limite.
 * @param client identifiant de l'appelant (adresse IP)
 * @returns true si l'appel doit être refusé (429)
 */
export function isRateLimited(client: string, now: number = Date.now()): boolean {
  const recent = (hits.get(client) ?? []).filter((at) => now - at < RATE_LIMIT_WINDOW_MS);
  recent.push(now);
  hits.set(client, recent);

  // Oubli des plus anciens appelants : la Map garde l'ordre d'insertion
  if (hits.size > MAX_TRACKED_CLIENTS) {
    const oldest = hits.keys().next().value;
    if (oldest !== undefined) hits.delete(oldest);
  }

  return recent.length > RATE_LIMIT_MAX_REQUESTS;
}

/**
 * Adresse de l'appelant telle que Netlify la transmet. Sans en-tête
 * exploitable, tout le monde partage le même compteur « unknown » : mieux vaut
 * une limite trop stricte qu'aucune limite.
 */
export function clientIp(headers: Record<string, string | undefined> | undefined | null): string {
  const direct = headers?.['x-nf-client-connection-ip'];
  if (direct) return direct;
  // x-forwarded-for peut contenir une liste : la première adresse est le client
  const forwarded = headers?.['x-forwarded-for'];
  if (forwarded) return forwarded.split(',')[0].trim();
  return 'unknown';
}

/** Réponse 429, jamais mise en cache (la limite est temporaire). */
export const TOO_MANY_REQUESTS = {
  statusCode: 429,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Retry-After': String(RATE_LIMIT_WINDOW_MS / 1000),
  },
  body: JSON.stringify({ error: 'rate_limited', status: 429 }),
};
