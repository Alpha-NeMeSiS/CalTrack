import { callOpenAIVision } from '../../../lib/openai';
import { DetectedItem } from '../../../types/fridge';

// Déclaration légère pour Buffer pour éviter les erreurs de typage dans l'environnement bundler
declare const Buffer: { from: (input: ArrayBuffer) => { toString: (encoding: string) => string } };

type AnalyzeResponse = { items: DetectedItem[] };

async function toBase64(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  return Buffer.from(arrayBuffer).toString('base64');
}

export async function analyzeFridgeFile(file: File): Promise<DetectedItem[]> {
  const base64 = await toBase64(file);
  const result = await callOpenAIVision(base64, file.type);

  return result.items.map<DetectedItem>((item) => ({
    id: null,
    name: item.label,
    confidence: item.confidence,
    enabled: true,
    quantityLevel: 'medium',
  }));
}

// Handler style Next.js API route (compatible avec route handler moderne Request/Response)
export default async function handler(req: Request): Promise<Response> {
  if (req.method && req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Méthode non autorisée' }), { status: 405 });
  }

  const formData = await req.formData();
  const file = formData.get('image');
  if (!(file instanceof File)) {
    return new Response(JSON.stringify({ error: 'Image manquante' }), { status: 400 });
  }

  try {
    const items = await analyzeFridgeFile(file);
    const body: AnalyzeResponse = { items };
    return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Erreur analyse frigo', error);
    return new Response(JSON.stringify({ error: 'Analyse indisponible' }), { status: 500 });
  }
}
