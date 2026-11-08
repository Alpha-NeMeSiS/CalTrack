// Accès Supabase pour le journal de pesées.
import { supabase, Goal, WeightLog } from '../lib/supabase';
import type { UserProfile } from '../utils/calculations';
import { getLatestWeight } from '../utils/weights';
import { upsertDailyTargetForGoal } from './goals';

/** Pesées de l'utilisateur, de la plus ancienne à la plus récente (depuis `fromDate`). */
export async function fetchWeightLogs(userId: string, fromDate?: string): Promise<WeightLog[]> {
  let query = supabase.from('weight_logs').select('*').eq('user_id', userId);
  if (fromDate) {
    query = query.gte('date', fromDate);
  }
  const { data, error } = await query.order('date', { ascending: true });
  if (error) throw error;
  return ((data as WeightLog[] | null) ?? []).map((log) => ({ ...log, weight_kg: Number(log.weight_kg) }));
}

/** Enregistre (ou remplace) la pesée d'une date. */
export async function upsertWeightLog(userId: string, date: string, weightKg: number): Promise<WeightLog> {
  const { data, error } = await supabase
    .from('weight_logs')
    .upsert({ user_id: userId, date, weight_kg: weightKg }, { onConflict: 'user_id,date' })
    .select()
    .single();
  if (error) throw error;
  return data as WeightLog;
}

export async function deleteWeightLog(id: string): Promise<void> {
  const { error } = await supabase.from('weight_logs').delete().eq('id', id);
  if (error) throw error;
}

/**
 * Enregistre une pesée et, si c'est la plus récente, met à jour le poids du
 * profil et recalcule la cible du jour (les besoins dépendent du poids).
 *
 * @returns true si le poids du profil a été mis à jour.
 */
export async function recordWeight({
  userId,
  date,
  weightKg,
  profile,
  goalForToday,
  today,
}: {
  userId: string;
  date: string;
  weightKg: number;
  profile: UserProfile;
  goalForToday: Goal | null;
  today: string;
}): Promise<boolean> {
  await upsertWeightLog(userId, date, weightKg);

  // Une pesée antidatée ne doit pas écraser une pesée plus récente
  const latest = getLatestWeight(await fetchWeightLogs(userId, date));
  if (!latest || latest.date !== date) {
    return false;
  }

  const { error } = await supabase
    .from('profiles')
    .update({ poids_kg: weightKg, updated_at: new Date().toISOString() })
    .eq('id', userId);
  if (error) throw error;

  if (goalForToday) {
    await upsertDailyTargetForGoal(userId, today, { ...profile, poids_kg: weightKg }, goalForToday);
  }
  return true;
}
