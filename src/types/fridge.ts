export type QuantityLevel = 'low' | 'medium' | 'high';

export type GoalType = 'loss' | 'maintain' | 'gain';

export interface DetectedItem {
  id?: string | null; // Identifiant interne de l'aliment si connu (ex: OEUF_POULE)
  name: string; // Nom lisible pour l'utilisateur
  confidence: number; // Score de confiance [0, 1]
  enabled: boolean; // Inclus dans la génération de recettes
  quantityLevel: QuantityLevel; // Quantité approximative disponible
}

export interface GeneratedRecipeIngredient {
  foodId?: string | null; // ID interne si connu
  name: string;
  approxQuantity: string;
}

export interface GeneratedRecipe {
  id: string;
  title: string;
  description: string;
  ingredients: GeneratedRecipeIngredient[];
  estimatedPrepMinutes: number;
  tags: string[];
  // Les champs calories/macros seront enrichis côté app à partir de la base d'aliments
}

export interface GeneratedRecipeWithNutrition extends GeneratedRecipe {
  calories?: number;
  proteins?: number;
  carbs?: number;
  fats?: number;
}
