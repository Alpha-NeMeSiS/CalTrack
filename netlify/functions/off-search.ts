const OFF_ENDPOINT = 'https://world.openfoodfacts.org/cgi/search.pl';

const OFF_FIELDS = [
  'code',
  'product_name',
  'product_name_fr',
  'brands',
  'image_small_url',
  'nutriments',
  'serving_size',
  'nutrition_data_per',
].join(',');

type NetlifyEvent = {
  queryStringParameters?: {
    q?: string;
  };
};

type NetlifyResponse = {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
};

const baseHeaders = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'public, max-age=300',
};

export async function handler(event: NetlifyEvent): Promise<NetlifyResponse> {
  const q = event.queryStringParameters?.q?.trim() ?? '';

  // Ignore les recherches trop courtes.
  if (q.length < 3) {
    return {
      statusCode: 200,
      headers: baseHeaders,
      body: JSON.stringify({ products: [] }),
    };
  }

  const params = new URLSearchParams({
    search_terms: q,
    search_simple: '1',
    action: 'process',
    json: '1',
    page_size: '10',
    fields: OFF_FIELDS,
  });

  try {
    const offResponse = await fetch(`${OFF_ENDPOINT}?${params.toString()}`, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'CalTrack/1.0 (support@caltrack.app)',
      },
    });

    if (!offResponse.ok) {
      return {
        statusCode: offResponse.status,
        headers: baseHeaders,
        body: JSON.stringify({
          error: 'Open Food Facts upstream error',
          status: offResponse.status,
        }),
      };
    }

    const payload = await offResponse.text();
    return {
      statusCode: 200,
      headers: baseHeaders,
      body: payload,
    };
  } catch {
    return {
      statusCode: 503,
      headers: baseHeaders,
      body: JSON.stringify({
        error: 'Open Food Facts unavailable',
        status: 503,
      }),
    };
  }
}
