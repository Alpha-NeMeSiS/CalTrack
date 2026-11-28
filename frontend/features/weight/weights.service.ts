// Accès Supabase pour le journal de pesées.
import { BodyComposition, supabase, Goal, WeightLog } from '../../shared/supabase';
import { pickComposition } from './bodyComposition';
import type { UserProfile } from '../goals/calculations';
import { addDaysToDateString } from '../../shared/date';
import { getLatestWeight, referenceWeights, REFERENCE_FALLBACK_DAYS, WeighInMoment } from './weights';
import { upsertDailyTargetForGoal } from '../goals/goals.service';

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
 * remplace pas celle déjà enregistrée ce jour-là. Sans moment fourni, la base
 * garde celui déjà enregistré (ou « matin » pour une nouvelle pesée).
 */
export async function upsertWeightLog(
  userId: string,
  date: string,
  weightKg: number,
  composition: BodyComposition = {},
  moment?: WeighInMoment
): Promise<WeightLog> {
  const { data, error } = await supabase
    .from('weight_logs')
    .upsert(
      { user_id: userId, date, weight_kg: weightKg, ...pickComposition(composition), ...(moment ? { moment } : {}) },
      { onConflict: 'user_id,date' }
    )
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
 * Enregistre une pesée puis, si c'est la plus récente, aligne le profil sur la
 * dernière pesée de référence (matin à jeun, voir `referenceWeights`) et
 * recalcule la cible du jour : les besoins dépendent du poids et de la masse
 * maigre. Une pesée « plus tard » qui ne compte pas laisse donc le profil sur
 * la pesée du matin ; sa composition n'entre pas dans le profil.
 *
 * @returns true si le profil a été mis à jour.
 */
export async function recordWeight({
  userId,
  date,
  weightKg,
  moment = 'morning',
  composition = {},
  profile,
  goalForToday,
  today,
}: {
  userId: string;
  date: string;
  weightKg: number;
  moment?: WeighInMoment;
  composition?: BodyComposition;
  profile: UserProfile;
  goalForToday: Goal | null;
  today: string;
}): Promise<boolean> {
  await upsertWeightLog(userId, date, weightKg, composition, moment);

  // Une pesée antidatée ne doit pas écraser une pesée plus récente.
  // Les 14 jours précédents suffisent pour savoir si une pesée « plus tard » compte.
  const logs = await fetchWeightLogs(userId, addDaysToDateString(date, -REFERENCE_FALLBACK_DAYS));
  const newest = getLatestWeight(logs);
  const reference = getLatestWeight(referenceWeights(logs));
  if (!newest || newest.date !== date || !reference) {
    return false;
  }

  const countsForTracking = reference.date === date;
  // Pesée hors suivi et profil déjà sur la pesée de référence : rien à changer
  if (!countsForTracking && reference.weight_kg === profile.poids_kg) {
    return false;
  }

  const measured = countsForTracking ? pickComposition(composition) : {};
  const { error } = await supabase
    .from('profiles')
    .update({ poids_kg: reference.weight_kg, ...measured, updated_at: new Date().toISOString() })
    .eq('id', userId);
  if (error) throw error;

  if (goalForToday) {
    await upsertDailyTargetForGoal(userId, today, { ...profile, ...measured, poids_kg: reference.weight_kg }, goalForToday);
  }
  return true;
}
