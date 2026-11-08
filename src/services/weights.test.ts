import { beforeEach, describe, expect, it } from 'vitest';
import { getOperationArgs, hasOperation, supabaseMock } from '../test/supabaseMock';
import { makeGoal, makeProfile } from '../test/fixtures';
import { fetchWeightLogs, recordWeight, upsertWeightLog } from './weights';
import { vi } from 'vitest';

vi.mock('../lib/supabase', async () => {
  const { fakeSupabase } = await import('../test/supabaseMock');
  return { supabase: fakeSupabase };
});

const profile = makeProfile({ poids_kg: 80 });

beforeEach(() => {
  supabaseMock.reset();
});

describe('services/weights', () => {
  it('lit les pesées depuis une date, converties en nombres', async () => {
    supabaseMock.setHandler(() => ({ data: [{ id: 'w', date: '2025-01-01', weight_kg: '80.4' }], error: null }));

    const logs = await fetchWeightLogs('user-1', '2024-12-01');

    expect(logs[0].weight_kg).toBe(80.4);
    const [call] = supabaseMock.calls;
    expect(call.operations).toContainEqual({ method: 'gte', args: ['date', '2024-12-01'] });
    expect(getOperationArgs(call, 'order')).toEqual(['date', { ascending: true }]);
  });

  it('remplace la pesée du jour (une par jour)', async () => {
    supabaseMock.setHandler(() => ({ data: { id: 'w' }, error: null }));
    await upsertWeightLog('user-1', '2025-01-10', 79.6);

    const [call] = supabaseMock.calls;
    expect(getOperationArgs(call, 'upsert')).toEqual([
      { user_id: 'user-1', date: '2025-01-10', weight_kg: 79.6 },
      { onConflict: 'user_id,date' },
    ]);
  });

  it('met à jour le profil et la cible du jour quand la pesée est la plus récente', async () => {
    supabaseMock.setHandler((call) => {
      if (call.table === 'weight_logs' && hasOperation(call, 'select') && !hasOperation(call, 'upsert')) {
        return { data: [{ date: '2025-01-10', weight_kg: 79.6 }], error: null };
      }
      return { data: { id: 'ok' }, error: null };
    });

    const updated = await recordWeight({
      userId: 'user-1', date: '2025-01-10', weightKg: 79.6, profile, goalForToday: makeGoal(), today: '2025-01-10',
    });

    expect(updated).toBe(true);
    const [profileUpdate] = supabaseMock.callsFor('profiles', 'update');
    expect((getOperationArgs(profileUpdate, 'update')?.[0] as { poids_kg: number }).poids_kg).toBe(79.6);
    expect(supabaseMock.callsFor('daily_targets', 'upsert')).toHaveLength(1);
  });

  it("ne touche pas au profil pour une pesée antidatée (une plus récente existe)", async () => {
    supabaseMock.setHandler((call) => {
      if (call.table === 'weight_logs' && hasOperation(call, 'select') && !hasOperation(call, 'upsert')) {
        return { data: [{ date: '2025-01-05', weight_kg: 81 }, { date: '2025-01-10', weight_kg: 79.6 }], error: null };
      }
      return { data: { id: 'ok' }, error: null };
    });

    const updated = await recordWeight({
      userId: 'user-1', date: '2025-01-05', weightKg: 81, profile, goalForToday: makeGoal(), today: '2025-01-10',
    });

    expect(updated).toBe(false);
    expect(supabaseMock.callsFor('profiles', 'update')).toHaveLength(0);
    expect(supabaseMock.callsFor('daily_targets', 'upsert')).toHaveLength(0);
  });
});
