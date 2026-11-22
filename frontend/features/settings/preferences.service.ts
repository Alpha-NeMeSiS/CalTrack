// Accès Supabase aux préférences d'affichage (table user_preferences).
import { supabase } from '../../shared/supabase';
import {
  preferencesFromRow,
  preferencesToRow,
  UserPreferences,
  UserPreferencesRow,
} from './preferences';

/** Préférences enregistrées, ou null si l'utilisateur n'en a jamais enregistré */
export async function fetchPreferences(userId: string): Promise<UserPreferences | null> {
  const { data, error } = await supabase
    .from('user_preferences')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data ? preferencesFromRow(data as UserPreferencesRow) : null;
}

/**
 * Fin de la visite guidée : visite et version vues enregistrées ensemble.
 * Seules ces colonnes sont envoyées (les autres préférences ne bougent pas).
 */
export async function markTourCompleted(userId: string, version: string, now = new Date()): Promise<string> {
  const completedAt = now.toISOString();
  const { error } = await supabase
    .from('user_preferences')
    .upsert({ user_id: userId, tour_completed_at: completedAt, last_seen_version: version }, { onConflict: 'user_id' });
  if (error) throw error;
  return completedAt;
}

/** Nouveautés vues pour cette version (seule cette colonne est envoyée) */
export async function markVersionSeen(userId: string, version: string): Promise<void> {
  const { error } = await supabase
    .from('user_preferences')
    .upsert({ user_id: userId, last_seen_version: version }, { onConflict: 'user_id' });
  if (error) throw error;
}

export async function savePreferences(userId: string, preferences: UserPreferences): Promise<UserPreferences> {
  const { data, error } = await supabase
    .from('user_preferences')
    .upsert(preferencesToRow(userId, preferences), { onConflict: 'user_id' })
    .select()
    .single();
  if (error) throw error;
  return preferencesFromRow(data as UserPreferencesRow);
}
