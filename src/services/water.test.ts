import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getOperationArgs, supabaseMock } from '../test/supabaseMock';
import { addWaterLog, deleteWaterLog, fetchWaterLogs } from './water';

vi.mock('../lib/supabase', async () => {
  const { fakeSupabase } = await import('../test/supabaseMock');
  return { supabase: fakeSupabase };
});

beforeEach(() => {
  supabaseMock.reset();
});

describe('services/water', () => {
  it('lit les prises d’une période, dans l’ordre où elles ont été notées', async () => {
    supabaseMock.setHandler(() => ({ data: [{ id: 'w1', amount_ml: 250 }], error: null }));
    expect(await fetchWaterLogs('user-1', '2026-11-01', '2026-11-07')).toEqual([{ id: 'w1', amount_ml: 250 }]);

    const [call] = supabaseMock.calls;
    expect(call.table).toBe('water_logs');
    expect(call.operations).toContainEqual({ method: 'eq', args: ['user_id', 'user-1'] });
    expect(call.operations).toContainEqual({ method: 'gte', args: ['date', '2026-11-01'] });
    expect(call.operations).toContainEqual({ method: 'lte', args: ['date', '2026-11-07'] });
    expect(getOperationArgs(call, 'order')).toEqual(['created_at', { ascending: true }]);
  });

  it('ajoute et supprime une prise', async () => {
    supabaseMock.setHandler(() => ({ data: { id: 'w2', amount_ml: 500 }, error: null }));
    expect(await addWaterLog('user-1', '2026-11-08', 500)).toEqual({ id: 'w2', amount_ml: 500 });
    expect(getOperationArgs(supabaseMock.calls[0], 'insert')).toEqual([{ user_id: 'user-1', date: '2026-11-08', amount_ml: 500 }]);

    await deleteWaterLog('w2');
    expect(supabaseMock.calls[1].operations).toContainEqual({ method: 'eq', args: ['id', 'w2'] });
  });

  it('fait remonter les erreurs', async () => {
    supabaseMock.setHandler(() => ({ data: null, error: { message: 'réseau' } }));
    await expect(addWaterLog('user-1', '2026-11-08', 250)).rejects.toMatchObject({ message: 'réseau' });
  });
});
