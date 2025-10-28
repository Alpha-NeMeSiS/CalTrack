import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface Profile {
  id: string;
  email: string;
  sexe: 'M' | 'F';
  date_naissance: string;
  taille_cm: number;
  poids_kg: number;
  body_fat_pct?: number;
  created_at: string;
  updated_at: string;
}

export interface Goal {
  id: string;
  user_id: string;
  type: 'loss' | 'maintain' | 'gain';
  activity_level: number;
  method: 'mifflin' | 'katch';
  deficit_or_surplus_pct: number;
  protein_g_per_kg: number;
  fat_g_per_kg_min: number;
  is_active: boolean;
  target_weight_kg?: number;
  duration_weeks?: number;
  start_date?: string;
  end_date?: string;
  created_at: string;
}

export interface DailyTarget {
  id: string;
  user_id: string;
  date: string;
  calories_kcal: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
  fiber_g: number;
  goal_id: string;
  created_at: string;
}

export interface Food {
  id: string;
  user_id?: string;
  name: string;
  kcal_per_100g: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
  fiber_g: number;
  is_public: boolean;
  created_at: string;
}

export interface Entry {
  id: string;
  user_id: string;
  date: string;
  food_id?: string;
  label?: string;
  qty_grammes: number;
  kcal: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
  fiber_g: number;
  meal_type?: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  created_at: string;
}
