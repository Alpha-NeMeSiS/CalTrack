import { DetectedItem, GeneratedRecipe, GoalType, QuantityLevel } from '../types/fridge';

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

// Placeholder: simule l'appel à un modèle de vision pour analyser l'image du frigo.
export async function analyzeFridgeImage(file: File): Promise<DetectedItem[]> {
  // Délai simulé pour refléter un appel réseau
  await delay(900);

  // Génère quelques résultats cohérents pour la démo
  const baseItems: Omit<DetectedItem, 'enabled'>[] = [
    { id: 'OEUF_POULE', name: 'Œufs de poule', confidence: 0.86, quantityLevel: 'medium' },
    { id: 'TOMATE_CRUE', name: 'Tomates fraîches', confidence: 0.79, quantityLevel: 'low' },
    { id: 'POULET_BLANC', name: 'Blanc de poulet', confidence: 0.71, quantityLevel: 'high' },
    { name: 'Yaourt nature', confidence: 0.65, quantityLevel: 'medium' },
  ];

  // Décale légèrement les scores pour éviter des valeurs figées entre analyses
  const jitter = Math.min(0.08, Math.max(0, file.size % 13) / 200);

  return baseItems.map((item) => ({
    ...item,
    confidence: Math.min(1, item.confidence + jitter),
    enabled: true,
  }));
}

// Placeholder: simule un appel LLM pour proposer des recettes healthy à partir des aliments.
export async function generateRecipesFromItems(
  items: DetectedItem[],
  goalType: GoalType,
): Promise<GeneratedRecipe[]> {
  await delay(1100);

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

  // Filtre léger pour personnaliser les suggestions en fonction des aliments gardés
  return recipes.filter((recipe) =>
    recipe.ingredients.some((ingredient) =>
      pantryNames.some((itemName) => ingredient.name.toLowerCase().includes(itemName.split(' ')[0])),
    ),
  );
}
