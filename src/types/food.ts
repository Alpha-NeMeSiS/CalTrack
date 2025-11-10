export type FoodSource = 'local' | 'off';

export interface NormalizedFood {
  source: FoodSource;
  name: string;
  brand?: string;
  imageUrl?: string;
  offCode?: string;
  kcal_per_100g: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
  fiber_g: number;
}
