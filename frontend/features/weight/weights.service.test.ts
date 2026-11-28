import { beforeEach, describe, expect, it } from 'vitest';
import { getOperationArgs, hasOperation, supabaseMock } from '../../test/supabaseMock';
import { makeGoal, makeProfile } from '../../test/fixtures';
import { fetchWeightLogs, recordWeight, upsertWeightLog } from './weights.service';
import { vi } from 'vitest';

vi.mock('../../shared/supabase', async () => {
  const { fakeSupabase } = await import('../../test/supabaseMock');
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

  it("envoie le moment de la pesée seulement s'il est fourni", async () => {
    supabaseMock.setHandler(() => ({ data: { id: 'w' }, error: null }));
    await upsertWeightLog('user-1', '2025-01-10', 68.1, {}, 'later');

    const [call] = supabaseMock.calls;
    expect(getOperationArgs(call, 'upsert')?.[0]).toEqual({ user_id: 'user-1', date: '2025-01-10', weight_kg: 68.1, moment: 'later' });
  });

  describe('pesée « plus tard dans la journée »', () => {
    // Pesées relues après l'enregistrement : matin la veille, plus tard ce jour
    const withLogs = (logs: object[]) =>
      supabaseMock.setHandler((call) => {
        if (call.table === 'weight_logs' && hasOperation(call, 'select') && !hasOperation(call, 'upsert')) {
          return { data: logs, error: null };
        }
        return { data: { id: 'ok' }, error: null };
      });
    const eveningAfterMorning = [
      { date: '2026-11-27', weight_kg: 66.1, moment: 'morning' },
      { date: '2026-11-28', weight_kg: 68.1, moment: 'later' },
    ];
    const save = (poids_kg: number) =>
      recordWeight({
        userId: 'user-1',
        date: '2026-11-28',
        weightKg: 68.1,
        moment: 'later',
        composition: { body_fat_pct: 19 },
        profile: makeProfile({ poids_kg }),
        goalForToday: makeGoal(),
        today: '2026-11-28',
      });

    it('enregistre le moment et relit les 14 jours précédents', async () => {
      withLogs(eveningAfterMorning);
      await save(66.1);

      const [upsert] = supabaseMock.callsFor('weight_logs', 'upsert');
      expect((getOperationArgs(upsert, 'upsert')?.[0] as { moment: string }).moment).toBe('later');
      const [read] = supabaseMock.calls.filter((call) => call.table === 'weight_logs' && !hasOperation(call, 'upsert'));
      expect(read.operations).toContainEqual({ method: 'gte', args: ['date', '2026-11-14'] });
    });

    it('ne touche pas au profil quand la pesée du matin reste la référence et le poids du profil est déjà le bon', async () => {
      withLogs(eveningAfterMorning);

      expect(await save(66.1)).toBe(false);
      expect(supabaseMock.callsFor('profiles', 'update')).toHaveLength(0);
      expect(supabaseMock.callsFor('daily_targets', 'upsert')).toHaveLength(0);
    });

    it('ramène le profil sur la pesée du matin, sans recopier la composition du soir', async () => {
      withLogs(eveningAfterMorning);

      expect(await save(68.1)).toBe(true);
      const [profileUpdate] = supabaseMock.callsFor('profiles', 'update');
      const update = getOperationArgs(profileUpdate, 'update')?.[0] as Record<string, unknown>;
      expect(update.poids_kg).toBe(66.1);
      expect(update).not.toHaveProperty('body_fat_pct');
      expect(supabaseMock.callsFor('daily_targets', 'upsert')).toHaveLength(1);
    });

    it('compte comme référence sans pesée du matin dans les 14 jours', async () => {
      withLogs([{ date: '2026-11-28', weight_kg: 68.1, moment: 'later' }]);

      expect(await save(66.1)).toBe(true);
      const [profileUpdate] = supabaseMock.callsFor('profiles', 'update');
      expect(getOperationArgs(profileUpdate, 'update')?.[0]).toMatchObject({ poids_kg: 68.1, body_fat_pct: 19 });
    });
  });

  it('enregistre la composition avec la pesée, sans écraser les mesures laissées vides', async () => {
    supabaseMock.setHandler(() => ({ data: { id: 'w' }, error: null }));
    await upsertWeightLog('user-1', '2025-01-10', 79.6, { body_fat_pct: 18.5, muscle_mass_kg: undefined, bone_mass_kg: null });

    const [call] = supabaseMock.calls;
    expect(getOperationArgs(call, 'upsert')?.[0]).toEqual({ user_id: 'user-1', date: '2025-01-10', weight_kg: 79.6, body_fat_pct: 18.5 });
  });

  it('dernière pesée : la composition met aussi à jour le profil et la cible du jour', async () => {
    supabaseMock.setHandler((call) => {
      if (call.table === 'weight_logs' && hasOperation(call, 'select') && !hasOperation(call, 'upsert')) {
        return { data: [{ date: '2025-01-10', weight_kg: 79.6 }], error: null };
      }
      return { data: { id: 'ok' }, error: null };
    });

    await recordWeight({
      userId: 'user-1',
      date: '2025-01-10',
      weightKg: 79.6,
      composition: { muscle_mass_kg: 60.1, bone_mass_kg: 3.2 },
      profile,
      goalForToday: makeGoal(),
      today: '2025-01-10',
    });

    const [profileUpdate] = supabaseMock.callsFor('profiles', 'update');
    expect(getOperationArgs(profileUpdate, 'update')?.[0]).toMatchObject({ poids_kg: 79.6, muscle_mass_kg: 60.1, bone_mass_kg: 3.2 });
    const [target] = supabaseMock.callsFor('daily_targets', 'upsert');
    expect(target).toBeDefined();
  });
});
