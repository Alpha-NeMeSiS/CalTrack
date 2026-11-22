// Fonction Netlify : fiche produit Open Food Facts à partir d'un code-barres
// (route /api/off/product?code=…, voir netlify.toml). Sert au scanner de
// code-barres de l'ajout d'aliment.
//
// L'API produit (api/v2/product/<code>) est bien moins limitée que l'ancienne
// recherche ; Open Food Facts normalise lui-même les codes UPC à 12 chiffres.
// Réponse : { product: { code, product_name, product_name_fr, brands,
// image_small_url, nutriments, serving_size } } ou 404 { error: 'not_found' }.

const OFF_PRODUCT_ENDPOINT = 'https://world.openfoodfacts.org/api/v2/product';

// EAN-8, UPC-A (12), EAN-13 et GTIN-14
const BARCODE_PATTERN = /^\d{8,14}$/;

const OFF_FIELDS = [
  'code',
  'product_name',
  'product_name_fr',
  'brands',
  'image_small_url',
  'nutriments',
  'serving_size',
];

type NetlifyEvent = {
  queryStringParameters?: { code?: string } | null;
};

type NetlifyResponse = {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
};

// Une fiche produit change rarement : 1 h de cache sur le CDN
const successHeaders = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'public, max-age=3600',
};

// Produit inconnu : il peut être ajouté à Open Food Facts entre-temps
const notFoundHeaders = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'public, max-age=300',
};

// Les erreurs ne sont jamais mises en cache (panne passagère)
const errorHeaders = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
};

function json(statusCode: number, headers: Record<string, string>, body: unknown): NetlifyResponse {
  return { statusCode, headers, body: JSON.stringify(body) };
}

export async function handler(event: NetlifyEvent): Promise<NetlifyResponse> {
  const code = event.queryStringParameters?.code?.trim() ?? '';
  if (!BARCODE_PATTERN.test(code)) {
    return json(400, errorHeaders, { error: 'invalid_code' });
  }

  const url = `${OFF_PRODUCT_ENDPOINT}/${code}?${new URLSearchParams({ fields: OFF_FIELDS.join(',') })}`;

  try {
    const offResponse = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'CalTrack/1.0 (support@caltrack.app)',
      },
    });

    if (offResponse.status === 404) {
      return json(404, notFoundHeaders, { error: 'not_found' });
    }
    if (!offResponse.ok) {
      return json(502, errorHeaders, {
        error: 'upstream_error',
        status: offResponse.status,
      });
    }

    const payload = (await offResponse.json()) as {
      status?: number;
      product?: Record<string, unknown>;
    };
    if (payload?.status !== 1 || !payload.product) {
      return json(404, notFoundHeaders, { error: 'not_found' });
    }

    // On ne renvoie que les champs utiles (l'API peut en ajouter d'autres)
    const product = Object.fromEntries(
      OFF_FIELDS.filter((field) => field in payload.product!).map((field) => [field, payload.product![field]]),
    );
    return json(200, successHeaders, { product });
  } catch {
    return json(503, errorHeaders, { error: 'unavailable' });
  }
}
