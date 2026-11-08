// Fonction Netlify : proxy de recherche Open Food Facts (route /api/off/search, voir netlify.toml)
//
// Le navigateur n'appelle pas Open Food Facts directement (CORS, limites de débit).
// On interroge le service de recherche « search-a-licious » (search.openfoodfacts.org) :
// l'ancien endpoint cgi/search.pl est très limité en nombre de requêtes et répond
// presque systématiquement 503 depuis les IP partagées des fonctions Netlify.
//
// La réponse garde la forme attendue par le client (src/lib/openfoodfacts.ts) :
// { products: [{ code, product_name, product_name_fr, brands, image_small_url, nutriments }] }

const OFF_SEARCH_ENDPOINT = 'https://search.openfoodfacts.org/search';
const MIN_QUERY_LENGTH = 3;
const PAGE_SIZE = '10';

const OFF_FIELDS = [
  'code',
  'product_name',
  'product_name_fr',
  'brands',
  'image_small_url',
  'nutriments',
  'serving_size',
].join(',');

type NetlifyEvent = {
  queryStringParameters?: {
    q?: string;
  } | null;
};

type NetlifyResponse = {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
};

type SearchHit = {
  code?: string;
  product_name?: string;
  product_name_fr?: string;
  brands?: string | string[];
  image_small_url?: string;
  nutriments?: Record<string, unknown>;
  serving_size?: string;
};

// Les réponses réussies peuvent être mises en cache 5 min par le CDN
const successHeaders = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'public, max-age=300',
};

// Les erreurs ne doivent PAS être mises en cache : sinon une panne passagère
// d'Open Food Facts resterait visible 5 min pour tous les utilisateurs.
const errorHeaders = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
};

function json(statusCode: number, headers: Record<string, string>, body: unknown): NetlifyResponse {
  return { statusCode, headers, body: JSON.stringify(body) };
}

/** search-a-licious renvoie les marques sous forme de liste : on les joint en texte. */
function normalizeBrands(brands: SearchHit['brands']): string | undefined {
  if (Array.isArray(brands)) {
    const joined = brands.filter(Boolean).join(', ');
    return joined || undefined;
  }
  return brands || undefined;
}

export async function handler(event: NetlifyEvent): Promise<NetlifyResponse> {
  const q = event.queryStringParameters?.q?.trim() ?? '';

  // Ignore les recherches trop courtes.
  if (q.length < MIN_QUERY_LENGTH) {
    return json(200, successHeaders, { products: [] });
  }

  const params = new URLSearchParams({
    q,
    langs: 'fr',
    page_size: PAGE_SIZE,
    fields: OFF_FIELDS,
  });

  try {
    const offResponse = await fetch(`${OFF_SEARCH_ENDPOINT}?${params.toString()}`, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'CalTrack/1.0 (support@caltrack.app)',
      },
    });

    if (!offResponse.ok) {
      return json(offResponse.status, errorHeaders, {
        error: 'Open Food Facts upstream error',
        status: offResponse.status,
      });
    }

    const payload = (await offResponse.json()) as { hits?: unknown };
    const hits = Array.isArray(payload?.hits) ? (payload.hits as SearchHit[]) : [];

    const products = hits.map((hit) => ({
      code: hit.code,
      product_name: hit.product_name,
      product_name_fr: hit.product_name_fr,
      brands: normalizeBrands(hit.brands),
      image_small_url: hit.image_small_url,
      nutriments: hit.nutriments ?? {},
      serving_size: hit.serving_size,
    }));

    return json(200, successHeaders, { products });
  } catch {
    return json(503, errorHeaders, {
      error: 'Open Food Facts unavailable',
      status: 503,
    });
  }
}
