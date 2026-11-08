// Accès Supabase aux préférences d'affichage (table user_preferences).
import { supabase } from '../lib/supabase';
import {
  DEFAULT_PREFERENCES,
  preferencesFromRow,
  preferencesToRow,
  UserPreferences,
  UserPreferencesRow,
} from '../utils/preferences';

export async function fetchPreferences(userId: string): Promise<UserPreferences> {
  const { data, error } = await supabase
    .from('user_preferences')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data ? preferencesFromRow(data as UserPreferencesRow) : DEFAULT_PREFERENCES;
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
