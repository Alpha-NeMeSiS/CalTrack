// Accès Supabase de la bibliothèque d'aliments : entrées récentes du journal,
// favoris (favorite_foods) et aliments personnels (foods, user_id renseigné).
import { Entry, FavoriteFood, Food, supabase } from '../lib/supabase';
import { buildFavoritePayload, buildPersonalFoodPayload, PortionValues } from '../utils/foodLibrary';

/** Nombre d'entrées lues pour calculer les aliments récents */
export const RECENT_ENTRIES_SAMPLE = 100;

/** Dernières entrées du journal, les plus récentes d'abord. */
export async function fetchRecentEntries(userId: string): Promise<Entry[]> {
  const { data, error } = await supabase
    .from('entries')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(RECENT_ENTRIES_SAMPLE);
  if (error) throw error;
  return (data as Entry[]) ?? [];
}

export async function fetchFavorites(userId: string): Promise<FavoriteFood[]> {
  const { data, error } = await supabase
    .from('favorite_foods')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data as FavoriteFood[]) ?? [];
}

export async function addFavorite(payload: ReturnType<typeof buildFavoritePayload>): Promise<FavoriteFood> {
  const { data, error } = await supabase.from('favorite_foods').insert(payload).select().single();
  if (error) throw error;
  return data as FavoriteFood;
}

export async function removeFavorite(favoriteId: string): Promise<void> {
  const { error } = await supabase.from('favorite_foods').delete().eq('id', favoriteId);
  if (error) throw error;
}

export async function fetchPersonalFoods(userId: string): Promise<Food[]> {
  const { data, error } = await supabase
    .from('foods')
    .select('*')
    .eq('user_id', userId)
    .order('name', { ascending: true });
  if (error) throw error;
  return (data as Food[]) ?? [];
}

/**
 * Enregistre un aliment personnel (valeurs de la portion ramenées à 100 g).
 * Si un aliment a déjà ce code-barres, il est mis à jour : un code-barres ne
 * correspond qu'à un seul de vos aliments.
 */
export async function savePersonalFood(userId: string, values: PortionValues, barcode?: string | null): Promise<Food> {
  const payload = buildPersonalFoodPayload(userId, values, barcode);

  if (payload.barcode) {
    const { data: existing, error: lookupError } = await supabase
      .from('foods')
      .select('id')
      .eq('user_id', userId)
      .eq('barcode', payload.barcode)
      .maybeSingle();
    if (lookupError) throw lookupError;
    if (existing) {
      const { data, error } = await supabase
        .from('foods')
        .update(payload)
        .eq('id', (existing as { id: string }).id)
        .select()
        .single();
      if (error) throw error;
      return data as Food;
    }
  }

  const { data, error } = await supabase.from('foods').insert(payload).select().single();
  if (error) throw error;
  return data as Food;
}

export async function deletePersonalFood(foodId: string): Promise<void> {
  const { error } = await supabase.from('foods').delete().eq('id', foodId);
  if (error) throw error;
}
