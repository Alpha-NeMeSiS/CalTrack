import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchPreferences, markTourCompleted, markVersionSeen, savePreferences } from './preferences';
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

  it('marque la visite vue et la version vue en une seule écriture, sans toucher au reste', async () => {
    supabaseMock.setHandler(() => ({ data: null, error: null }));
    const at = await markTourCompleted('user-1', '2.1.0', new Date('2026-11-17T10:00:00Z'));

    const [call] = supabaseMock.callsFor('user_preferences', 'upsert');
    const [row, options] = getOperationArgs(call, 'upsert') as [Record<string, unknown>, unknown];
    expect(row).toEqual({ user_id: 'user-1', tour_completed_at: '2026-11-17T10:00:00.000Z', last_seen_version: '2.1.0' });
    expect(options).toEqual({ onConflict: 'user_id' });
    expect(at).toBe('2026-11-17T10:00:00.000Z');
  });

  it('marque une version vue sans toucher au reste', async () => {
    supabaseMock.setHandler(() => ({ data: null, error: null }));
    await markVersionSeen('user-1', '2.1.0');

    const [call] = supabaseMock.callsFor('user_preferences', 'upsert');
    const [row, options] = getOperationArgs(call, 'upsert') as [Record<string, unknown>, unknown];
    expect(row).toEqual({ user_id: 'user-1', last_seen_version: '2.1.0' });
    expect(options).toEqual({ onConflict: 'user_id' });
  });

  it("remonte l'erreur d'une écriture de version vue", async () => {
    supabaseMock.setHandler(() => ({ data: null, error: new Error('RLS') }));
    await expect(markVersionSeen('user-1', '2.1.0')).rejects.toThrow('RLS');
  });

  it("remonte l'erreur d'enregistrement", async () => {
    supabaseMock.setHandler(() => ({ data: null, error: new Error('RLS') }));
    await expect(savePreferences('user-1', DEFAULT_PREFERENCES)).rejects.toThrow('RLS');
  });
});
