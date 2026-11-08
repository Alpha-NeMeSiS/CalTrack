import { createClient } from '@supabase/supabase-js';
import { AuthNotice, parseAuthRedirect } from '../utils/authRedirect';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

/**
 * Retour d'un lien envoyé par Supabase Auth (mot de passe oublié, confirmation,
 * changement d'email, lien expiré…).
 * Supabase (flux implicite) redirige vers l'app avec un fragment `#…` que le
 * client efface pendant son initialisation (asynchrone), et ses événements
 * (PASSWORD_RECOVERY…) peuvent partir avant l'abonnement de React : on lit
 * donc l'URL ici, AVANT de créer le client.
 */
const initialAuthRedirect =
  typeof window !== 'undefined'
    ? parseAuthRedirect(window.location.hash)
    : { isRecovery: false, notice: null, isMessageOnly: false };

/** true si l'application a été ouverte depuis le lien « mot de passe oublié » */
export const openedFromPasswordRecoveryLink = initialAuthRedirect.isRecovery;

/** Message à afficher après un lien d'authentification (ou null) */
export const initialAuthNotice: AuthNotice | null = initialAuthRedirect.notice;

/**
 * Efface de l'URL un fragment qui ne contient qu'un message de Supabase
 * (le client ne le fait pas) : sinon il resterait affiché et serait relu.
 */
export function clearAuthMessageFromUrl() {
  if (typeof window === 'undefined' || !initialAuthRedirect.isMessageOnly) return;
  if (!window.location.hash) return;
  window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface Profile {
  id: string;
  email: string;
  sexe: 'M' | 'F';
  date_naissance: string;
  taille_cm: number;
  poids_kg: number;
  body_fat_pct?: number | null;
  /** Mesures détaillées facultatives (migration 20261108162648) */
  body_water_pct?: number | null;
  visceral_fat_rating?: number | null;
  muscle_mass_kg?: number | null;
  bone_mass_kg?: number | null;
  /** Identité (migration 20261108125514) : facultatifs */
  first_name?: string | null;
  last_name?: string | null;
  /** URL publique de la photo (stockage « profile-pictures ») */
  profile_picture_url?: string | null;
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
  // Colonnes ajoutées par la migration 20251024092148 (nullable)
  // NB : la table `goals` ne stocke PAS les calories/macros calculées ; elles
  // sont recalculées depuis le profil (voir src/utils/goals.ts).
  target_weight_kg?: number | null;
  // Migration 20261107235000 : poids à la création de l'objectif (null pour
  // les anciens objectifs inactifs)
  start_weight_kg?: number | null;
  duration_weeks?: number | null;
  start_date?: string | null;
  end_date?: string | null;
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

export interface WeightLog {
  id: string;
  user_id: string;
  date: string;
  weight_kg: number;
  created_at: string;
}
