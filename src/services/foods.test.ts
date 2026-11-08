import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getOperationArgs, hasOperation, supabaseMock } from '../test/supabaseMock';
import {
  addFavorite,
  deletePersonalFood,
  fetchFavorites,
  fetchPersonalFoods,
  fetchRecentEntries,
  removeFavorite,
  savePersonalFood,
} from './foods';

vi.mock('../lib/supabase', async () => {
  const { fakeSupabase } = await import('../test/supabaseMock');
  return { supabase: fakeSupabase };
});

beforeEach(() => {
  supabaseMock.reset();
});

const portion = { name: 'Galette', qty_grammes: 40, kcal: 150, protein_g: 3, fat_g: 6, carbs_g: 21, fiber_g: 1.2 };

describe('services/foods', () => {
  it('lit les dernières entrées du journal, les plus récentes d’abord', async () => {
    supabaseMock.setHandler(() => ({ data: [{ id: 'e1' }], error: null }));
    expect(await fetchRecentEntries('user-1')).toEqual([{ id: 'e1' }]);

    const [call] = supabaseMock.calls;
    expect(call.table).toBe('entries');
    expect(call.operations).toContainEqual({ method: 'eq', args: ['user_id', 'user-1'] });
    expect(getOperationArgs(call, 'order')).toEqual(['created_at', { ascending: false }]);
    expect(getOperationArgs(call, 'limit')).toEqual([100]);
  });

  it('lit, ajoute et retire les favoris', async () => {
    supabaseMock.setHandler((call) =>
      hasOperation(call, 'insert') ? { data: { id: 'fav-1', label: 'Yaourt' }, error: null } : { data: [], error: null }
    );

    await fetchFavorites('user-1');
    const favorite = await addFavorite({
      user_id: 'user-1',
      label: 'Yaourt',
      kcal_per_100g: 53,
      protein_g: 4,
      fat_g: 1.5,
      carbs_g: 5.5,
      fiber_g: 0,
      default_qty_g: 125,
    });
    await removeFavorite('fav-1');

    expect(favorite).toEqual({ id: 'fav-1', label: 'Yaourt' });
    const [read, insert, remove] = supabaseMock.callsFor('favorite_foods');
    expect(read.operations).toContainEqual({ method: 'eq', args: ['user_id', 'user-1'] });
    expect(getOperationArgs(insert, 'insert')?.[0]).toMatchObject({ label: 'Yaourt', default_qty_g: 125 });
    expect(hasOperation(remove, 'delete')).toBe(true);
    expect(remove.operations).toContainEqual({ method: 'eq', args: ['id', 'fav-1'] });
  });

  it('lit les aliments personnels de l’utilisateur', async () => {
    supabaseMock.setHandler(() => ({ data: [{ id: 'f1', name: 'Granola' }], error: null }));
    expect(await fetchPersonalFoods('user-1')).toEqual([{ id: 'f1', name: 'Granola' }]);
    const [call] = supabaseMock.calls;
    expect(call.table).toBe('foods');
    expect(call.operations).toContainEqual({ method: 'eq', args: ['user_id', 'user-1'] });
  });

  it('crée un aliment personnel (valeurs ramenées à 100 g)', async () => {
    supabaseMock.setHandler((call) =>
      hasOperation(call, 'insert') ? { data: { id: 'f-new' }, error: null } : { data: null, error: null }
    );

    const food = await savePersonalFood('user-1', portion);

    expect(food).toEqual({ id: 'f-new' });
    const [insert] = supabaseMock.callsFor('foods', 'insert');
    expect(getOperationArgs(insert, 'insert')?.[0]).toMatchObject({
      user_id: 'user-1',
      name: 'Galette',
      kcal_per_100g: 375,
      barcode: null,
      is_public: false,
    });
  });

  it('met à jour l’aliment qui a déjà ce code-barres au lieu d’en créer un second', async () => {
    supabaseMock.setHandler((call) => {
      if (hasOperation(call, 'update')) return { data: { id: 'f-old' }, error: null };
      if (hasOperation(call, 'maybeSingle')) return { data: { id: 'f-old' }, error: null };
      return { data: null, error: null };
    });

    const food = await savePersonalFood('user-1', portion, '3017620422003');

    expect(food).toEqual({ id: 'f-old' });
    const [lookup] = supabaseMock.callsFor('foods', 'maybeSingle');
    expect(lookup.operations).toContainEqual({ method: 'eq', args: ['barcode', '3017620422003'] });
    expect(supabaseMock.callsFor('foods', 'insert')).toHaveLength(0);
    const [update] = supabaseMock.callsFor('foods', 'update');
    expect(update.operations).toContainEqual({ method: 'eq', args: ['id', 'f-old'] });
  });

  it('propage les erreurs Supabase', async () => {
    supabaseMock.setHandler(() => ({ data: null, error: { message: 'boom' } }));
    await expect(fetchFavorites('user-1')).rejects.toEqual({ message: 'boom' });
    await expect(deletePersonalFood('f1')).rejects.toEqual({ message: 'boom' });
  });
});
