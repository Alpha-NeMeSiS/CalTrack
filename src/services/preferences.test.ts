import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchPreferences, savePreferences } from './preferences';
import { getOperationArgs, supabaseMock } from '../test/supabaseMock';
import { DEFAULT_PREFERENCES } from '../utils/preferences';

vi.mock('../lib/supabase', async () => {
  const { fakeSupabase } = await import('../test/supabaseMock');
  return { supabase: fakeSupabase };
});

beforeEach(() => supabaseMock.reset());

describe('services/preferences', () => {
  it("renvoie null si l'utilisateur n'a rien enregistré", async () => {
    supabaseMock.setHandler(() => ({ data: null, error: null }));
    await expect(fetchPreferences('user-1')).resolves.toBeNull();
    const [call] = supabaseMock.callsFor('user_preferences');
    expect(getOperationArgs(call, 'eq')).toEqual(['user_id', 'user-1']);
  });

  it('enregistre par upsert sur user_id et relit la ligne enregistrée', async () => {
    supabaseMock.setHandler(() => ({
      data: { user_id: 'user-1', calorie_display: 'remaining', macro_display: 'grams', hidden_meals: [] },
      error: null,
    }));

    const saved = await savePreferences('user-1', { ...DEFAULT_PREFERENCES, calorieDisplay: 'remaining' });

    const [call] = supabaseMock.callsFor('user_preferences', 'upsert');
    const [row, options] = getOperationArgs(call, 'upsert') as [Record<string, unknown>, unknown];
    expect(row).toMatchObject({ user_id: 'user-1', calorie_display: 'remaining' });
    expect(options).toEqual({ onConflict: 'user_id' });
    expect(saved.calorieDisplay).toBe('remaining');
  });

  it("remonte l'erreur d'enregistrement", async () => {
    supabaseMock.setHandler(() => ({ data: null, error: new Error('RLS') }));
    await expect(savePreferences('user-1', DEFAULT_PREFERENCES)).rejects.toThrow('RLS');
  });
});
