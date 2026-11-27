// Fonction Netlify : proxy de recherche Open Food Facts (route /api/off/search, voir netlify.toml)
//
// Le navigateur n'appelle pas Open Food Facts directement (CORS, limites de débit).
// On interroge le service de recherche « search-a-licious » (search.openfoodfacts.org) :
// l'ancien endpoint cgi/search.pl est très limité en nombre de requêtes et répond
// presque systématiquement 503 depuis les IP partagées des fonctions Netlify.
//
// La réponse garde la forme attendue par le client (frontend/features/foods/openfoodfacts.ts) :
// { products: [{ code, product_name, product_name_fr, brands, image_small_url, nutriments }] }

import { fetchWithRetry } from '../lib/fetchWithRetry';
import { ENRICH_LIMIT, getProductNutrition, hasNutriments, OFF_USER_AGENT } from '../lib/productNutrition';

const OFF_SEARCH_ENDPOINT = 'https://search.openfoodfacts.org/search';
const MIN_QUERY_LENGTH = 3;
const DEFAULT_PAGE_SIZE = 10;
// Produits similaires : jusqu'à 30 résultats pour trouver les plus proches
const MAX_PAGE_SIZE = 30;

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
    size?: string;
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

/** Nombre de résultats demandé : entier de 1 à 30, sinon la valeur par défaut. */
function pageSize(size: string | undefined): string {
  if (!size || !/^\d+$/.test(size)) return String(DEFAULT_PAGE_SIZE);
  const value = Number(size);
  return value >= 1 && value <= MAX_PAGE_SIZE ? String(value) : String(DEFAULT_PAGE_SIZE);
}

// Petits mots ignorés : l'index combine les mots en ET, et un mot vide
// (« de », « à »…) qui ne figure dans aucun produit ferait tout échouer.
const STOP_WORDS = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'au', 'aux', 'et', 'à', 'a', 'en', 'un', 'une', 'l', 'd']);
const MAX_WORDS = 6;
const ADVANCED_QUERY = /[:"()]|\b(?:AND|OR)\b/;

/**
 * Requête envoyée à l'index. Depuis fin novembre 2026, il combine les mots en
 * ET et ne cherche plus le texte dans la marque : chaque mot doit donc figurer
 * dans le nom ou la marque (« jus multifruits paquito »). Une requête avancée
 * (produits similaires) passe telle quelle.
 */
export function buildSearchQuery(input: string): string {
  if (ADVANCED_QUERY.test(input)) return input;
  const words = input
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length >= 2 && !STOP_WORDS.has(word))
    .slice(0, MAX_WORDS);
  if (words.length === 0) return input;
  return words
    .map((word) => {
      const forms = [...new Set([word, word.charAt(0).toUpperCase() + word.slice(1)])];
      const brands = forms.flatMap((form) => [`brands:"${form}"`, `brands:"xx:${form}"`]);
      return `(${[word, ...brands].join(' OR ')})`;
    })
    .join(' AND ');
}

function json(statusCode: number, headers: Record<string, string>, body: unknown): NetlifyResponse {
  return { statusCode, headers, body: JSON.stringify(body) };
}

/** Marque de l'index : « xx:ferrero » → « Ferrero », « xx:Côté Snack » → « Côté Snack ». */
function cleanBrand(brand: string): string {
  const name = brand.trim().replace(/^[a-z]{2}:/, '').trim();
  return name === name.toLowerCase() ? name.charAt(0).toUpperCase() + name.slice(1) : name;
}

/** search-a-licious renvoie les marques sous forme de liste : on les nettoie et on les joint en texte. */
function normalizeBrands(brands: SearchHit['brands']): string | undefined {
  const list = (Array.isArray(brands) ? brands : brands ? brands.split(',') : [])
    .filter((brand): brand is string => typeof brand === 'string' && brand.trim() !== '')
    .map(cleanBrand);
  const unique = list.filter(
    (brand, index) => list.findIndex((other) => other.toLowerCase() === brand.toLowerCase()) === index
  );
  return unique.length > 0 ? unique.join(', ') : undefined;
}

export async function handler(event: NetlifyEvent): Promise<NetlifyResponse> {
  const q = event.queryStringParameters?.q?.trim() ?? '';

  // Ignore les recherches trop courtes.
  if (q.length < MIN_QUERY_LENGTH) {
    return json(200, successHeaders, { products: [] });
  }

  const params = new URLSearchParams({
    q: buildSearchQuery(q),
    langs: 'fr',
    page_size: pageSize(event.queryStringParameters?.size),
    fields: OFF_FIELDS,
  });

  try {
    const offResponse = await fetchWithRetry(`${OFF_SEARCH_ENDPOINT}?${params.toString()}`, {
      headers: {
        Accept: 'application/json',
        'User-Agent': OFF_USER_AGENT,
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

    // L'index ne contient plus les valeurs de la plupart des produits : on les
    // complète avec la fiche produit (en parallèle, sans bloquer si elle échoue).
    // Une fiche lue mais vide (ou introuvable) rend le produit inutilisable : il
    // est écarté. Une fiche non lue (refus, panne) laisse le produit sans valeurs.
    const missing = products.filter((product) => product.code && !hasNutriments(product.nutriments)).slice(0, ENRICH_LIMIT);
    const unusable = new Set<string>();
    await Promise.all(
      missing.map(async (product) => {
        try {
          const details = await getProductNutrition(product.code as string);
          if (!details || !hasNutriments(details.nutriments)) {
            unusable.add(product.code as string);
            return;
          }
          product.nutriments = details.nutriments;
          if (!product.serving_size && details.serving_size) product.serving_size = details.serving_size;
        } catch (error) {
          // Fiche indisponible : le produit reste sans valeurs, l'app chargera
          // sa fiche quand on le choisira. Visible dans les journaux Netlify.
          console.warn(`off-search : fiche ${product.code} non lue (${error instanceof Error ? error.message : String(error)})`);
        }
      })
    );

    return json(200, successHeaders, {
      products: products.filter((product) => !(product.code && unusable.has(product.code))),
    });
  } catch {
    return json(503, errorHeaders, {
      error: 'Open Food Facts unavailable',
      status: 503,
    });
  }
}
