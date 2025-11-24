import { callOpenAILLMRecipes } from '../../../lib/openai';
import { searchHealthyRecipesOnWeb } from '../../../lib/recipesSearch';
import { DetectedItem, GeneratedRecipe, GeneratedRecipeWithNutrition, GoalType } from '../../../types/fridge';

type RecipesRequest = {
  items: DetectedItem[];
  goal: GoalType;
};

type RecipesResponse = {
  recipes: GeneratedRecipeWithNutrition[];
};

const computeNutritionSafely = (recipe: GeneratedRecipe): GeneratedRecipeWithNutrition => {
  const computeNutritionForRecipe = (globalThis as unknown as {
    computeNutritionForRecipe?: (r: GeneratedRecipe) => Partial<GeneratedRecipeWithNutrition>;
  }).computeNutritionForRecipe;

  if (typeof computeNutritionForRecipe === 'function') {
    const nutrition = computeNutritionForRecipe(recipe);
    return { ...recipe, ...nutrition };
  }

  return { ...recipe, calories: undefined, proteins: undefined, carbs: undefined, fats: undefined };
};

function dedupe(recipes: GeneratedRecipe[]): GeneratedRecipe[] {
  const seen = new Set<string>();
  return recipes.filter((recipe) => {
    const key = recipe.title.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function generateRecipesFromRequest(payload: RecipesRequest): Promise<GeneratedRecipeWithNutrition[]> {
  const enabledItems = payload.items.filter((item) => item.enabled);
  const ingredientNames = enabledItems.map((item) => item.name);

  const [llmIdeas, webIdeas] = await Promise.all([
    callOpenAILLMRecipes(ingredientNames, payload.goal),
    searchHealthyRecipesOnWeb(ingredientNames, payload.goal),
  ]);

  const merged = dedupe([...llmIdeas, ...webIdeas]);

  return merged.map((recipe, index) => (
    computeNutritionSafely({ ...recipe, id: recipe.id || `recipe-${index}` })
  ));
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method && req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Méthode non autorisée' }), { status: 405 });
  }

  const body = await req.json();
  const payload = body as RecipesRequest;
  if (!payload?.items || !payload.goal) {
    return new Response(JSON.stringify({ error: 'Requête invalide' }), { status: 400 });
  }

  try {
    const recipes = await generateRecipesFromRequest(payload);
    const response: RecipesResponse = { recipes };
    return new Response(JSON.stringify(response), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('Erreur génération recettes', error);
    return new Response(JSON.stringify({ error: 'Génération indisponible' }), { status: 500 });
  }
}
