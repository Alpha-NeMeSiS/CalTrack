// Accès Supabase pour le journal alimentaire (modification et copie d'entrées).
import { supabase, Entry } from '../lib/supabase';
import { buildCopiedEntries, MealType, scaleEntry } from '../utils/entries';

/** Modifie la quantité (nutriments recalculés proportionnellement) et le repas d'une entrée. */
export async function updateEntry(entry: Entry, quantity: number, mealType: MealType | null): Promise<void> {
  const { error } = await supabase
    .from('entries')
    .update({ ...scaleEntry(entry, quantity), meal_type: mealType })
    .eq('id', entry.id);
  if (error) throw error;
}

/**
 * Copie toutes les entrées d'une journée vers une autre.
 * @returns le nombre d'entrées copiées (0 si la journée source est vide).
 */
export async function copyDayEntries(userId: string, fromDate: string, toDate: string): Promise<number> {
  const { data, error } = await supabase
    .from('entries')
    .select('*')
    .eq('user_id', userId)
    .eq('date', fromDate)
    .order('created_at', { ascending: true });
  if (error) throw error;

  const source = (data as Entry[] | null) ?? [];
  if (source.length === 0) return 0;

  const { error: insertError } = await supabase.from('entries').insert(buildCopiedEntries(source, userId, toDate));
  if (insertError) throw insertError;
  return source.length;
}
