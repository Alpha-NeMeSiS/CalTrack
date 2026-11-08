// Accès Supabase pour les objectifs et les cibles quotidiennes.
// Centralise une logique auparavant dupliquée entre Onboarding, Settings et Dashboard.
import { supabase, DailyTarget, Goal } from '../lib/supabase';
import type { UserProfile } from '../utils/calculations';
import {
  buildDailyTargetPayload,
  buildGoalInsertPayload,
  GoalInput,
  hasGoalStarted,
} from '../utils/goals';

/** Récupère l'objectif actif le plus récent de l'utilisateur. */
export async function fetchActiveGoal(userId: string): Promise<Goal | null> {
  const { data, error } = await supabase
    .from('goals')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return (data as Goal | null) ?? null;
}

/**
 * Récupère les objectifs de l'utilisateur, du plus récent au plus ancien.
 * Permet de retrouver l'objectif en vigueur à n'importe quelle date (findGoalForDate).
 */
export async function fetchUserGoals(userId: string): Promise<Goal[]> {
  const { data, error } = await supabase
    .from('goals')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) throw error;
  return (data as Goal[] | null) ?? [];
}

/**
 * Calcule et enregistre (insert ou mise à jour) la cible d'une date pour un objectif.
 * L'upsert garantit qu'un changement d'objectif le même jour remplace bien la cible.
 */
export async function upsertDailyTargetForGoal(
  userId: string,
  date: string,
  profile: UserProfile,
  goal: Goal
): Promise<DailyTarget> {
  const payload = buildDailyTargetPayload(userId, date, profile, goal);

  const { data, error } = await supabase
    .from('daily_targets')
    .upsert(payload, { onConflict: 'user_id,date' })
    .select()
    .single();

  if (error) throw error;
  return data as DailyTarget;
}

/**
 * Retourne la cible de la date si elle existe déjà. Sinon, si l'objectif fourni
 * (celui en vigueur à cette date) la couvre, la calcule à partir du profil
 * courant et l'enregistre.
 * Retourne null si aucun objectif ne s'applique à cette date.
 */
export async function ensureDailyTargetForDate(
  userId: string,
  date: string,
  profile: UserProfile,
  goal: Goal | null
): Promise<DailyTarget | null> {
  const { data: existing, error } = await supabase
    .from('daily_targets')
    .select('*')
    .eq('user_id', userId)
    .eq('date', date)
    .maybeSingle();

  if (error) throw error;
  if (existing) return existing as DailyTarget;

  // Avant le début de l'objectif : rien à calculer. Après sa fin : maintien
  // (géré par buildDailyTargetPayload).
  if (!goal || !hasGoalStarted(goal, date)) {
    return null;
  }

  return upsertDailyTargetForGoal(userId, date, profile, goal);
}

/**
 * Crée un nouvel objectif actif, désactive les précédents et enregistre la cible du jour.
 *
 * L'ordre (insertion PUIS désactivation des autres) évite de laisser l'utilisateur
 * sans aucun objectif actif si l'insertion échoue.
 */
export async function activateNewGoal(
  userId: string,
  profile: UserProfile,
  input: GoalInput,
  today: string
): Promise<Goal> {
  const { data: newGoal, error: insertError } = await supabase
    .from('goals')
    .insert(buildGoalInsertPayload(userId, profile, input, today))
    .select()
    .single();

  if (insertError) throw insertError;
  const goal = newGoal as Goal;

  const { error: deactivateError } = await supabase
    .from('goals')
    .update({ is_active: false })
    .eq('user_id', userId)
    .eq('is_active', true)
    .neq('id', goal.id);

  if (deactivateError) throw deactivateError;

  await upsertDailyTargetForGoal(userId, today, profile, goal);
  return goal;
}
