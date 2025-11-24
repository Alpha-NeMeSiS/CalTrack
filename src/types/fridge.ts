export type QuantityLevel = 'low' | 'medium' | 'high';

export interface DetectedItem {
  id?: string; // Identifiant interne de l'aliment si connu (ex: OEUF_POULE)
  name: string; // Nom lisible pour l'utilisateur
  confidence: number; // Score de confiance [0, 1]
  enabled: boolean; // Inclus dans la génération de recettes
  quantityLevel: QuantityLevel; // Quantité approximative disponible
}

export interface GeneratedRecipeIngredient {
  foodId?: string; // ID interne si connu
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

export type GoalType = 'loss' | 'maintain' | 'gain';
