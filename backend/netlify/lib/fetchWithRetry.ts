// Appel à Open Food Facts avec un nouvel essai en cas de panne passagère.
// Open Food Facts renvoie parfois une erreur 5xx (ou 429) pendant quelques
// secondes, ou la connexion est coupée : on réessaie une fois avant
// d'afficher « indisponible ». Un 404 (produit inconnu) n'est jamais réessayé.
// Placé hors de functions/ : Netlify y traiterait chaque fichier comme une fonction.

export const RETRY_DELAY_MS = 300;

const isTransient = (status: number) => status >= 500 || status === 429;

export async function fetchWithRetry(
  url: string,
  init: RequestInit,
  retries = 1,
  delayMs = RETRY_DELAY_MS,
): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    try {
      const response = await fetch(url, init);
      if (!isTransient(response.status) || attempt >= retries) return response;
    } catch (error) {
      if (attempt >= retries) throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
}
