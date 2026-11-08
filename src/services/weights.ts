// Accès Supabase pour le journal de pesées.
import { BodyComposition, supabase, Goal, WeightLog } from '../lib/supabase';
import { pickComposition } from '../utils/bodyComposition';
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

/**
 * Enregistre (ou remplace) la pesée d'une date, avec sa composition facultative.
 * Seules les mesures renseignées sont envoyées : une mesure laissée vide ne
 * remplace pas celle déjà enregistrée ce jour-là.
 */
export async function upsertWeightLog(
  userId: string,
  date: string,
  weightKg: number,
  composition: BodyComposition = {}
): Promise<WeightLog> {
  const { data, error } = await supabase
    .from('weight_logs')
    .upsert({ user_id: userId, date, weight_kg: weightKg, ...pickComposition(composition) }, { onConflict: 'user_id,date' })
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
 * Enregistre une pesée et, si c'est la plus récente, met à jour le poids (et
 * la composition saisie) du profil puis recalcule la cible du jour : les
 * besoins dépendent du poids et de la masse maigre.
 *
 * @returns true si le poids du profil a été mis à jour.
 */
export async function recordWeight({
  userId,
  date,
  weightKg,
  composition = {},
  profile,
  goalForToday,
  today,
}: {
  userId: string;
  date: string;
  weightKg: number;
  composition?: BodyComposition;
  profile: UserProfile;
  goalForToday: Goal | null;
  today: string;
}): Promise<boolean> {
  await upsertWeightLog(userId, date, weightKg, composition);

  // Une pesée antidatée ne doit pas écraser une pesée plus récente
  const latest = getLatestWeight(await fetchWeightLogs(userId, date));
  if (!latest || latest.date !== date) {
    return false;
  }

  const measured = pickComposition(composition);
  const { error } = await supabase
    .from('profiles')
    .update({ poids_kg: weightKg, ...measured, updated_at: new Date().toISOString() })
    .eq('id', userId);
  if (error) throw error;

  if (goalForToday) {
    await upsertDailyTargetForGoal(userId, today, { ...profile, ...measured, poids_kg: weightKg }, goalForToday);
  }
  return true;
}
