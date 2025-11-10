export type FoodSource = 'ciqual' | 'off';
export type SearchCategory = FoodSource;

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
}
