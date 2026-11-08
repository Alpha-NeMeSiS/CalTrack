import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getOperationArgs, hasOperation, supabaseMock } from '../test/supabaseMock';
import { makeEntry } from '../test/fixtures';
import { copyDayEntries, updateEntry } from './entries';

vi.mock('../lib/supabase', async () => {
  const { fakeSupabase } = await import('../test/supabaseMock');
  return { supabase: fakeSupabase };
});

beforeEach(() => supabaseMock.reset());

describe('services/entries', () => {
  it('met à jour quantité, nutriments et repas', async () => {
    await updateEntry(makeEntry({ id: 'e1', qty_grammes: 100, kcal: 200, protein_g: 10, fat_g: 5, carbs_g: 20, fiber_g: 2 }), 150, 'dinner');

    const [call] = supabaseMock.calls;
    expect(getOperationArgs(call, 'update')).toEqual([
      { qty_grammes: 150, kcal: 300, protein_g: 15, fat_g: 7.5, carbs_g: 30, fiber_g: 3, meal_type: 'dinner' },
    ]);
    expect(getOperationArgs(call, 'eq')).toEqual(['id', 'e1']);
  });

  it('copie les entrées de la veille', async () => {
    supabaseMock.setHandler((call) =>
      hasOperation(call, 'select') ? { data: [makeEntry({ id: 'a' }), makeEntry({ id: 'b' })], error: null } : { data: null, error: null }
    );

    await expect(copyDayEntries('user-1', '2025-01-09', '2025-01-10')).resolves.toBe(2);

    const [insertCall] = supabaseMock.callsFor('entries', 'insert');
    const rows = getOperationArgs(insertCall, 'insert')?.[0] as Array<{ date: string }>;
    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.date === '2025-01-10')).toBe(true);
  });

  it("n'insère rien si la veille est vide", async () => {
    supabaseMock.setHandler(() => ({ data: [], error: null }));
    await expect(copyDayEntries('user-1', '2025-01-09', '2025-01-10')).resolves.toBe(0);
    expect(supabaseMock.callsFor('entries', 'insert')).toHaveLength(0);
  });
});
