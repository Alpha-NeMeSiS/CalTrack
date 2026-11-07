// Données de test réutilisables
import type { DailyTarget, Entry, Goal, Profile } from '../lib/supabase';

export function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: 'user-1',
    email: 'test@example.com',
    sexe: 'M',
    date_naissance: '1995-06-15',
    taille_cm: 175,
    poids_kg: 70,
    body_fat_pct: null,
    created_at: '2025-01-01T12:00:00Z',
    updated_at: '2025-01-01T12:00:00Z',
    ...overrides,
  };
}

export function makeGoal(overrides: Partial<Goal> = {}): Goal {
  return {
    id: 'goal-1',
    user_id: 'user-1',
    type: 'maintain',
    activity_level: 1.55,
    method: 'mifflin',
    deficit_or_surplus_pct: 0,
    protein_g_per_kg: 2,
    fat_g_per_kg_min: 0.8,
    is_active: true,
    target_weight_kg: null,
    duration_weeks: null,
    start_date: '2025-01-01',
    end_date: null,
    created_at: '2025-01-01T12:00:00Z',
    ...overrides,
  };
}

export function makeDailyTarget(overrides: Partial<DailyTarget> = {}): DailyTarget {
  return {
    id: 'target-1',
    user_id: 'user-1',
    date: '2025-01-10',
    calories_kcal: 2000,
    protein_g: 140,
    fat_g: 56,
    carbs_g: 234,
    fiber_g: 25,
    goal_id: 'goal-1',
    created_at: '2025-01-10T12:00:00Z',
    ...overrides,
  };
}

export function makeEntry(overrides: Partial<Entry> = {}): Entry {
  return {
    id: 'entry-1',
    user_id: 'user-1',
    date: '2025-01-10',
    label: 'Poulet rôti',
    qty_grammes: 150,
    kcal: 247.5,
    protein_g: 46.5,
    fat_g: 5.4,
    carbs_g: 0,
    fiber_g: 0,
    meal_type: 'lunch',
    created_at: '2025-01-10T12:00:00Z',
    ...overrides,
  };
}
