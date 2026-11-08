import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EXPORT_PAGE_SIZE, downloadJson, exportUserData } from './account';
import { getOperationArgs, supabaseMock } from '../test/supabaseMock';
import { makeProfile } from '../test/fixtures';

vi.mock('../lib/supabase', async () => {
  const { fakeSupabase } = await import('../test/supabaseMock');
  return { supabase: fakeSupabase };
});

beforeEach(() => {
  supabaseMock.reset();
});

describe('exportUserData', () => {
  it("rassemble toutes les données de l'utilisateur", async () => {
    supabaseMock.setHandler((call) => {
      if (call.table === 'profiles') return { data: makeProfile({ id: 'user-1' }), error: null };
      if (call.table === 'entries') return { data: [{ id: 'e1', label: 'Riz' }], error: null };
      if (call.table === 'weight_logs') return { data: [{ id: 'w1', weight_kg: 80 }], error: null };
      return { data: [], error: null };
    });

    const data = await exportUserData({ id: 'user-1', email: 'eva@example.com' }, new Date('2026-11-08T10:00:00Z'));

    expect(data).toMatchObject({
      format: 'caltrack-export',
      version: 1,
      exported_at: '2026-11-08T10:00:00.000Z',
      user: { id: 'user-1', email: 'eva@example.com' },
      profile: expect.objectContaining({ id: 'user-1' }),
      entries: [{ id: 'e1', label: 'Riz' }],
      weight_logs: [{ id: 'w1', weight_kg: 80 }],
      goals: [],
      daily_targets: [],
      foods: [],
      user_preferences: [],
    });

    // Chaque table est filtrée sur l'utilisateur connecté
    for (const table of ['goals', 'daily_targets', 'entries', 'weight_logs', 'foods', 'user_preferences']) {
      const [call] = supabaseMock.callsFor(table);
      expect(getOperationArgs(call, 'eq')).toEqual(['user_id', 'user-1']);
    }
  });

  it('lit les grandes tables page par page (limite de lignes Supabase)', async () => {
    const fullPage = Array.from({ length: EXPORT_PAGE_SIZE }, (_, i) => ({ id: `e${i}` }));
    let entriesPage = 0;
    supabaseMock.setHandler((call) => {
      if (call.table === 'entries') {
        entriesPage += 1;
        return { data: entriesPage === 1 ? fullPage : [{ id: 'last' }], error: null };
      }
      return { data: call.table === 'profiles' ? null : [], error: null };
    });

    const data = await exportUserData({ id: 'user-1' });

    expect(data.entries).toHaveLength(EXPORT_PAGE_SIZE + 1);
    const ranges = supabaseMock.callsFor('entries').map((call) => getOperationArgs(call, 'range'));
    expect(ranges).toEqual([
      [0, EXPORT_PAGE_SIZE - 1],
      [EXPORT_PAGE_SIZE, 2 * EXPORT_PAGE_SIZE - 1],
    ]);
  });

  it("échoue si une table n'a pas pu être lue (pas d'export incomplet)", async () => {
    supabaseMock.setHandler((call) =>
      call.table === 'goals' ? { data: null, error: new Error('réseau') } : { data: [], error: null }
    );

    await expect(exportUserData({ id: 'user-1' })).rejects.toThrow('réseau');
  });
});

describe('downloadJson', () => {
  it('déclenche le téléchargement du fichier JSON', () => {
    const createObjectURL = vi.fn(() => 'blob:fake');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    downloadJson('export.json', { a: 1 });

    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(click).toHaveBeenCalledTimes(1);
    const anchor = click.mock.instances[0] as unknown as HTMLAnchorElement;
    expect(anchor.download).toBe('export.json');

    click.mockRestore();
    vi.unstubAllGlobals();
  });
});
