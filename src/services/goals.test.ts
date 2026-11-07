import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getOperationArgs, hasOperation, supabaseMock } from '../test/supabaseMock';
import { makeDailyTarget, makeGoal, makeProfile } from '../test/fixtures';
import { buildDailyTargetPayload } from '../utils/goals';
import {
  activateNewGoal,
  ensureDailyTargetForDate,
  fetchActiveGoal,
  fetchUserGoals,
  upsertDailyTargetForGoal,
} from './goals';

vi.mock('../lib/supabase', async () => {
  const { fakeSupabase } = await import('../test/supabaseMock');
  return { supabase: fakeSupabase };
});

const profile = makeProfile();

beforeEach(() => {
  supabaseMock.reset();
});

describe('fetchActiveGoal', () => {
  it("renvoie l'objectif actif le plus récent", async () => {
    const goal = makeGoal();
    supabaseMock.setHandler(() => ({ data: goal, error: null }));

    await expect(fetchActiveGoal('user-1')).resolves.toEqual(goal);

    const [call] = supabaseMock.calls;
    expect(call.table).toBe('goals');
    expect(call.operations).toContainEqual({ method: 'eq', args: ['is_active', true] });
    expect(getOperationArgs(call, 'order')).toEqual(['created_at', { ascending: false }]);
  });

  it('propage les erreurs Supabase', async () => {
    supabaseMock.setHandler(() => ({ data: null, error: new Error('boom') }));
    await expect(fetchActiveGoal('user-1')).rejects.toThrow('boom');
  });
});

describe('fetchUserGoals', () => {
  it("renvoie tous les objectifs de l'utilisateur, du plus récent au plus ancien", async () => {
    const goals = [makeGoal({ id: 'g2' }), makeGoal({ id: 'g1' })];
    supabaseMock.setHandler(() => ({ data: goals, error: null }));

    await expect(fetchUserGoals('user-1')).resolves.toEqual(goals);

    const [call] = supabaseMock.calls;
    expect(call.table).toBe('goals');
    expect(call.operations).toContainEqual({ method: 'eq', args: ['user_id', 'user-1'] });
    expect(getOperationArgs(call, 'order')).toEqual(['created_at', { ascending: false }]);
  });

  it('renvoie une liste vide sans données et propage les erreurs', async () => {
    supabaseMock.setHandler(() => ({ data: null, error: null }));
    await expect(fetchUserGoals('user-1')).resolves.toEqual([]);

    supabaseMock.setHandler(() => ({ data: null, error: new Error('boom') }));
    await expect(fetchUserGoals('user-1')).rejects.toThrow('boom');
  });
});

describe('upsertDailyTargetForGoal', () => {
  it('fait un upsert sur (user_id, date) avec les cibles calculées', async () => {
    const goal = makeGoal();
    const saved = makeDailyTarget();
    supabaseMock.setHandler(() => ({ data: saved, error: null }));

    await expect(upsertDailyTargetForGoal('user-1', '2025-01-10', profile, goal)).resolves.toEqual(saved);

    const [call] = supabaseMock.calls;
    expect(call.table).toBe('daily_targets');
    expect(getOperationArgs(call, 'upsert')).toEqual([
      buildDailyTargetPayload('user-1', '2025-01-10', profile, goal),
      { onConflict: 'user_id,date' },
    ]);
  });
});

describe('ensureDailyTargetForDate', () => {
  it('renvoie la cible existante sans rien écrire', async () => {
    const existing = makeDailyTarget();
    supabaseMock.setHandler(() => ({ data: existing, error: null }));

    await expect(ensureDailyTargetForDate('user-1', '2025-01-10', profile, makeGoal())).resolves.toEqual(existing);
    expect(supabaseMock.callsFor('daily_targets', 'upsert')).toHaveLength(0);
  });

  it("crée la cible des jours suivants pour un objectif de maintien sans date de fin (régression)", async () => {
    const goal = makeGoal({ type: 'maintain', start_date: null, end_date: null, created_at: '2025-01-01T12:00:00Z' });
    const created = makeDailyTarget({ date: '2025-03-15' });
    supabaseMock.setHandler((call) =>
      hasOperation(call, 'upsert') ? { data: created, error: null } : { data: null, error: null }
    );

    await expect(ensureDailyTargetForDate('user-1', '2025-03-15', profile, goal)).resolves.toEqual(created);

    const [upsertCall] = supabaseMock.callsFor('daily_targets', 'upsert');
    expect(getOperationArgs(upsertCall, 'upsert')?.[0]).toEqual(
      buildDailyTargetPayload('user-1', '2025-03-15', profile, goal)
    );
  });

  it("renvoie null pour une date antérieure à l'objectif", async () => {
    supabaseMock.setHandler(() => ({ data: null, error: null }));
    const goal = makeGoal({ start_date: '2025-02-01' });

    await expect(ensureDailyTargetForDate('user-1', '2025-01-15', profile, goal)).resolves.toBeNull();
    expect(supabaseMock.callsFor('daily_targets', 'upsert')).toHaveLength(0);
  });

  it("renvoie null sans objectif actif", async () => {
    supabaseMock.setHandler(() => ({ data: null, error: null }));
    await expect(ensureDailyTargetForDate('user-1', '2025-01-15', profile, null)).resolves.toBeNull();
  });

  it('propage les erreurs de lecture', async () => {
    supabaseMock.setHandler(() => ({ data: null, error: new Error('lecture impossible') }));
    await expect(ensureDailyTargetForDate('user-1', '2025-01-15', profile, makeGoal())).rejects.toThrow(
      'lecture impossible'
    );
  });
});

describe('activateNewGoal', () => {
  const input = { type: 'loss' as const, activity_level: 1.375, deficit_or_surplus_pct: 15 };

  it("insère l'objectif, désactive les autres puis met à jour la cible du jour", async () => {
    const newGoal = makeGoal({ id: 'goal-new', type: 'loss', deficit_or_surplus_pct: 15, start_date: '2025-02-10' });
    supabaseMock.setHandler((call) => {
      if (call.table === 'goals' && hasOperation(call, 'insert')) return { data: newGoal, error: null };
      if (call.table === 'daily_targets') return { data: makeDailyTarget(), error: null };
      return { data: null, error: null };
    });

    await expect(activateNewGoal('user-1', profile, input, '2025-02-10')).resolves.toEqual(newGoal);

    const [insertCall, deactivateCall, upsertCall] = supabaseMock.calls;

    expect(insertCall.table).toBe('goals');
    expect(getOperationArgs(insertCall, 'insert')?.[0]).toMatchObject({
      user_id: 'user-1',
      type: 'loss',
      start_date: '2025-02-10',
      is_active: true,
    });

    expect(deactivateCall.table).toBe('goals');
    expect(getOperationArgs(deactivateCall, 'update')).toEqual([{ is_active: false }]);
    expect(getOperationArgs(deactivateCall, 'neq')).toEqual(['id', 'goal-new']);

    expect(upsertCall.table).toBe('daily_targets');
    expect(getOperationArgs(upsertCall, 'upsert')).toEqual([
      buildDailyTargetPayload('user-1', '2025-02-10', profile, newGoal),
      { onConflict: 'user_id,date' },
    ]);
  });

  it("ne désactive pas l'ancien objectif si l'insertion échoue", async () => {
    supabaseMock.setHandler(() => ({ data: null, error: new Error('insert refusé') }));

    await expect(activateNewGoal('user-1', profile, input, '2025-02-10')).rejects.toThrow('insert refusé');
    expect(supabaseMock.calls).toHaveLength(1);
  });

  it('remonte une erreur de désactivation', async () => {
    supabaseMock.setHandler((call) =>
      hasOperation(call, 'insert')
        ? { data: makeGoal({ id: 'goal-new' }), error: null }
        : { data: null, error: new Error('update refusé') }
    );

    await expect(activateNewGoal('user-1', profile, input, '2025-02-10')).rejects.toThrow('update refusé');
    expect(supabaseMock.callsFor('daily_targets')).toHaveLength(0);
  });
});
