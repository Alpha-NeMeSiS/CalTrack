/**
 * Origine d'un aliment : base Ciqual, Open Food Facts, aliment personnel
 * (« Mes aliments ») ou historique (favoris et récents).
 */
export type FoodSource = 'ciqual' | 'off' | 'custom' | 'history';
/** Catégories de la recherche */
export type SearchCategory = 'ciqual' | 'off';

export interface NormalizedFood {
  source: FoodSource;
  name: string;
  brand?: string;
  imageUrl?: string;
  offCode?: string;
  extCode?: string;
  kcal_per_100g: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
  fiber_g: number;
  /** Portion indiquée par le fabricant, en grammes (Open Food Facts) */
  servingGrams?: number;
  /** Libellé de la portion (ex : « 1 pot (125 g) ») */
  servingLabel?: string;
  /** Identifiant de l'aliment personnel (table foods), relié à l'entrée du journal */
  foodId?: string;
  /** Code-barres d'un aliment personnel */
  barcode?: string;
}
