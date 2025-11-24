import {
  DetectedItem,
  GeneratedRecipe,
  GeneratedRecipeWithNutrition,
  GoalType,
  QuantityLevel,
} from '../types/fridge';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function mapQuantity(level: QuantityLevel): string {
  switch (level) {
    case 'low':
      return 'Petite portion';
    case 'high':
      return 'Quantité généreuse';
    default:
      return 'Quantité modérée';
  }
}

async function fallbackAnalyze(file: File): Promise<DetectedItem[]> {
  await delay(700);
  const baseItems: Omit<DetectedItem, 'enabled'>[] = [
    { id: 'OEUF_POULE', name: 'Œufs de poule', confidence: 0.86, quantityLevel: 'medium' },
    { id: 'TOMATE_CRUE', name: 'Tomates fraîches', confidence: 0.79, quantityLevel: 'low' },
    { id: 'POULET_BLANC', name: 'Blanc de poulet', confidence: 0.71, quantityLevel: 'high' },
    { name: 'Yaourt nature', confidence: 0.65, quantityLevel: 'medium' },
  ];

  const jitter = Math.min(0.08, Math.max(0, file.size % 13) / 200);
  return baseItems.map((item) => ({
    ...item,
    confidence: Math.min(1, item.confidence + jitter),
    enabled: true,
  }));
}

async function fallbackRecipes(items: DetectedItem[], goalType: GoalType): Promise<GeneratedRecipeWithNutrition[]> {
  await delay(900);
  const enabledItems = items.filter((item) => item.enabled);
  const pantryNames = enabledItems.map((item) => item.name.toLowerCase());

  const tagsByGoal: Record<GoalType, string[]> = {
    loss: ['léger', 'riche en protéines'],
    maintain: ['équilibré', 'rapide'],
    gain: ['énergétique', 'riche en protéines'],
  };

  const recipes: GeneratedRecipe[] = [
    {
      id: 'omelette-proteinee',
      title: 'Omelette protéinée express',
      description:
        "Une omelette moelleuse avec des dés de tomates et un topping yaourt pour rester légère et rassasiante.",
      ingredients: [
        { foodId: 'OEUF_POULE', name: 'Œufs', approxQuantity: '2 à 3 pièces' },
        { foodId: 'TOMATE_CRUE', name: 'Tomates', approxQuantity: mapQuantity('low') },
        { name: 'Yaourt nature', approxQuantity: '1 cuillère à soupe' },
      ],
      estimatedPrepMinutes: 12,
      tags: [...tagsByGoal[goalType], 'sans friture'],
    },
    {
      id: 'bowl-poulet-frais',
      title: 'Bowl frais poulet & yaourt',
      description:
        'Un bowl froid avec blanc de poulet, tomates marinées au yaourt et herbes. Idéal pour un déjeuner rapide.',
      ingredients: [
        { foodId: 'POULET_BLANC', name: 'Blanc de poulet', approxQuantity: mapQuantity('high') },
        { foodId: 'TOMATE_CRUE', name: 'Tomates', approxQuantity: mapQuantity('medium') },
        { name: 'Yaourt nature', approxQuantity: '2 cuillères à soupe' },
      ],
      estimatedPrepMinutes: 18,
      tags: [...tagsByGoal[goalType], 'meal prep'],
    },
    {
      id: 'wrap-yaourt-frais',
      title: 'Wrap frais au yaourt et légumes',
      description:
        'Un wrap léger avec yaourt en sauce, tomates et lamelles de poulet. Ajustez les quantités selon votre faim.',
      ingredients: [
        { name: 'Tortilla ou wrap', approxQuantity: '1 pièce' },
        { foodId: 'POULET_BLANC', name: 'Blanc de poulet', approxQuantity: mapQuantity('medium') },
        { foodId: 'TOMATE_CRUE', name: 'Tomates', approxQuantity: mapQuantity('low') },
        { name: 'Yaourt nature', approxQuantity: '1 petite portion' },
      ],
      estimatedPrepMinutes: 15,
      tags: [...tagsByGoal[goalType], 'finger food'],
    },
  ];

  return recipes
    .filter((recipe) =>
      recipe.ingredients.some((ingredient) =>
        pantryNames.some((itemName) => ingredient.name.toLowerCase().includes(itemName.split(' ')[0])),
      ),
    )
    .map((recipe) => ({ ...recipe }));
}

export async function analyzeFridgeImage(file: File): Promise<DetectedItem[]> {
  try {
    const formData = new FormData();
    formData.append('image', file);
    const response = await fetch('/api/fridge/analyze', { method: 'POST', body: formData });
    if (response.ok) {
      const data = (await response.json()) as { items: DetectedItem[] };
      return data.items;
    }
  } catch (error) {
    console.warn('Fallback analyse frigo', error);
  }

  return fallbackAnalyze(file);
}

export async function generateRecipesFromItems(
  items: DetectedItem[],
  goalType: GoalType,
): Promise<GeneratedRecipeWithNutrition[]> {
  try {
    const response = await fetch('/api/fridge/recipes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items, goal: goalType }),
    });
    if (response.ok) {
      const data = (await response.json()) as { recipes: GeneratedRecipeWithNutrition[] };
      return data.recipes;
    }
  } catch (error) {
    console.warn('Fallback génération recettes', error);
  }

  const recipes = await fallbackRecipes(items, goalType);
  return recipes.map((recipe) => ({ ...recipe }));
}
