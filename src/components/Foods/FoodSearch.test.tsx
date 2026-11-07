import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FoodSearch } from './FoodSearch';
import { searchCiqual } from '../../lib/ciqual';
import { searchOFF } from '../../lib/openfoodfacts';
import type { NormalizedFood } from '../../types/food';

vi.mock('../../lib/ciqual', () => ({ searchCiqual: vi.fn() }));
vi.mock('../../lib/openfoodfacts', () => ({ searchOFF: vi.fn() }));

const mockedSearchCiqual = vi.mocked(searchCiqual);
const mockedSearchOFF = vi.mocked(searchOFF);

const pomme: NormalizedFood = {
  source: 'ciqual',
  name: 'Pomme, crue',
  extCode: '13039',
  kcal_per_100g: 52,
  protein_g: 0.3,
  fat_g: 0.2,
  carbs_g: 14,
  fiber_g: 2.4,
};

beforeEach(() => {
  // Faux minuteurs : on contrôle les délais d'attente (300 ms / 1200 ms)
  vi.useFakeTimers({ shouldAdvanceTime: true });
  mockedSearchCiqual.mockReset();
  mockedSearchOFF.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

function setup() {
  const onSelect = vi.fn();
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });
  render(<FoodSearch onSelect={onSelect} />);
  return { user, onSelect, input: screen.getByRole('combobox', { name: "Recherche d'aliment" }) };
}

async function wait(ms: number) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
}

describe('FoodSearch', () => {
  it('recherche dans Ciqual à partir de 2 caractères et permet de choisir un aliment', async () => {
    mockedSearchCiqual.mockResolvedValue([pomme]);
    const { user, onSelect, input } = setup();

    await user.type(input, 'p');
    await wait(400);
    expect(mockedSearchCiqual).not.toHaveBeenCalled();

    await user.type(input, 'o');
    await wait(400);
    expect(mockedSearchCiqual).toHaveBeenCalledWith('po');

    await user.click(await screen.findByRole('option', { name: /Pomme, crue/ }));
    expect(onSelect).toHaveBeenCalledWith(pomme);
  });

  it('Open Food Facts : attend 3 caractères et un délai plus long', async () => {
    mockedSearchOFF.mockResolvedValue([]);
    const { user, input } = setup();

    await user.click(screen.getByRole('tab', { name: 'Produits supermarché' }));
    await user.type(input, 'nu');
    await wait(1500);
    expect(mockedSearchOFF).not.toHaveBeenCalled();

    await user.type(input, 't');
    await wait(1000);
    expect(mockedSearchOFF).not.toHaveBeenCalled(); // délai de 1200 ms pas encore écoulé

    await wait(300);
    expect(mockedSearchOFF).toHaveBeenCalledWith('nut', expect.any(AbortSignal));
  });

  it('affiche un message dédié quand Open Food Facts est indisponible', async () => {
    mockedSearchOFF.mockRejectedValue(new Error('OFF search failed with status 503'));
    vi.spyOn(console, 'error').mockImplementation(() => {}); // erreur attendue, loguée en dev
    const { user, input } = setup();

    await user.click(screen.getByRole('tab', { name: 'Produits supermarché' }));
    await user.type(input, 'nutella');
    await wait(1300);

    expect(await screen.findByText('Service OFF indisponible, réessayez dans un instant.')).toBeInTheDocument();
  });

  it('affiche "Aucun résultat" quand la recherche ne trouve rien', async () => {
    mockedSearchCiqual.mockResolvedValue([]);
    const { user, input } = setup();

    await user.type(input, 'zzz');
    await wait(400);

    expect(await screen.findByText('Aucun résultat')).toBeInTheDocument();
  });
});
