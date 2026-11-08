// Accès Supabase des prises d'eau (une ligne par verre ou bouteille).
import { supabase, WaterLog } from '../lib/supabase';

/** Prises d'eau entre deux dates incluses, dans l'ordre où elles ont été notées. */
export async function fetchWaterLogs(userId: string, from: string, to: string): Promise<WaterLog[]> {
  const { data, error } = await supabase
    .from('water_logs')
    .select('*')
    .eq('user_id', userId)
    .gte('date', from)
    .lte('date', to)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data as WaterLog[]) ?? [];
}

export async function addWaterLog(userId: string, date: string, amountMl: number): Promise<WaterLog> {
  const { data, error } = await supabase
    .from('water_logs')
    .insert({ user_id: userId, date, amount_ml: amountMl })
    .select()
    .single();
  if (error) throw error;
  return data as WaterLog;
}

export async function deleteWaterLog(id: string): Promise<void> {
  const { error } = await supabase.from('water_logs').delete().eq('id', id);
  if (error) throw error;
}
