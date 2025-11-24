// Helpers pour interagir avec l'API OpenAI (vision + texte)
// Les appels sont isolés ici pour faciliter le mock et la future configuration serveur.
// Aucune clé n'est embarquée en dur : on lit les variables d'environnement disponibles.

// Déclaration légère pour éviter les erreurs de typage lorsque process n'est pas défini (en bundler côté client)
declare const process: { env: Record<string, string | undefined> } | undefined;

type EnvRecord = Record<string, string | undefined>;
type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string | Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }>;
};

type VisionDetection = {
  label: string;
  confidence: number;
};

interface VisionResult {
  items: VisionDetection[];
}

interface RecipeLLMPayload {
  title: string;
  description: string;
  ingredients: { name: string; approxQuantity: string }[];
  estimatedPrepMinutes: number;
  tags: string[];
}

const env = typeof process !== 'undefined' ? process.env : ({} as EnvRecord);
const metaEnv = (typeof import.meta !== 'undefined'
  ? ((import.meta as unknown as { env?: EnvRecord }).env ?? {})
  : {}) as EnvRecord;

const readEnv = (key: string) => env?.[key] ?? metaEnv?.[key];

const OPENAI_API_KEY = readEnv('OPENAI_API_KEY');
const OPENAI_VISION_MODEL = readEnv('OPENAI_VISION_MODEL') ?? 'gpt-4o-mini';
const OPENAI_TEXT_MODEL = readEnv('OPENAI_TEXT_MODEL') ?? 'gpt-4o-mini';

async function callOpenAIChat(messages: ChatMessage[]) {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY manquante');
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_TEXT_MODEL,
      messages,
      temperature: 0.5,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Erreur OpenAI: ${errorText}`);
  }
  return response.json();
}

export async function callOpenAIVision(base64Image: string, mimeType: string): Promise<VisionResult> {
  if (!OPENAI_API_KEY) {
    // Fallback demo pour le développement sans clé
    return {
      items: [
        { label: 'Œufs', confidence: 0.82 },
        { label: 'Tomates', confidence: 0.74 },
        { label: 'Yaourt nature', confidence: 0.61 },
      ],
    };
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_VISION_MODEL,
      messages: [
        {
          role: 'system',
          content:
            "Identifie les aliments visibles. Réponds avec un JSON concis {items:[{label:string,confidence:number}]}.",
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: "Voici une photo d'un frigo. Liste les aliments détectés." },
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Image}` } },
          ],
        },
      ],
      temperature: 0,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Erreur OpenAI vision: ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('Réponse OpenAI invalide');
  }
  return JSON.parse(content) as VisionResult;
}

export async function callOpenAILLMRecipes(
  ingredients: string[],
  goal: 'loss' | 'maintain' | 'gain',
): Promise<RecipeLLMPayload[]> {
  const messages = [
    {
      role: 'system',
      content:
        "Tu es un assistant culinaire. Propose des recettes healthy adaptées à l'objectif (perte/maintien/prise). Ne fournis pas de valeurs nutritionnelles.",
    },
    {
      role: 'user',
      content: `Aliments disponibles: ${ingredients.join(', ')}. Objectif: ${goal}. Donne 3 idées structurées en JSON (pas de calories).`,
    },
  ];

  const demo: RecipeLLMPayload[] = [
    {
      title: 'Omelette légère tomates-yaourt',
      description: "Omelette moelleuse garnie de tomates et d'un topping yaourt citronné.",
      ingredients: [
        { name: 'Œufs', approxQuantity: '2-3 pièces' },
        { name: 'Tomates', approxQuantity: '1 petite poignée' },
        { name: 'Yaourt nature', approxQuantity: '1 c. à soupe' },
      ],
      estimatedPrepMinutes: 12,
      tags: ['rapide', 'riche en protéines'],
    },
    {
      title: 'Wrap poulet frais',
      description: 'Wrap froid avec blanc de poulet, tomates et sauce yaourt.',
      ingredients: [
        { name: 'Blanc de poulet', approxQuantity: '1 filet' },
        { name: 'Tomates', approxQuantity: 'quelques rondelles' },
        { name: 'Yaourt nature', approxQuantity: '2 c. à soupe' },
      ],
      estimatedPrepMinutes: 15,
      tags: ['équilibré', 'meal prep'],
    },
    {
      title: 'Bowl protéiné',
      description: 'Bowl complet avec base de légumes, œufs durs et sauce yaourt.',
      ingredients: [
        { name: 'Œufs', approxQuantity: '2 pièces' },
        { name: 'Tomates', approxQuantity: '1 tomate' },
        { name: 'Yaourt nature', approxQuantity: '1 c. à soupe' },
      ],
      estimatedPrepMinutes: 18,
      tags: ['satiétant', 'riche en protéines'],
    },
  ];

  if (!OPENAI_API_KEY) {
    return demo;
  }

  const data = await callOpenAIChat(messages);
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('Réponse OpenAI vide');
  }

  try {
    return JSON.parse(content) as RecipeLLMPayload[];
  } catch (error) {
    console.error('Impossible de parser la réponse OpenAI, fallback en mode demo', error);
    return demo;
  }
}
