import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FoodSearch } from './FoodSearch';
import { searchCiqual } from '../../lib/ciqual';
import { fetchOFFProduct, searchOFF } from '../../lib/openfoodfacts';
import type { NormalizedFood } from '../../types/food';

vi.mock('../../lib/ciqual', () => ({ searchCiqual: vi.fn() }));
vi.mock('../../lib/openfoodfacts', () => ({ searchOFF: vi.fn(), fetchOFFProduct: vi.fn() }));
// Le scanner (caméra) est testé à part : ici, un bouton simule la lecture d'un code
vi.mock('./BarcodeScanner', () => ({
  BarcodeScanner: ({ onDetected, onCancel }: { onDetected: (code: string) => void; onCancel: () => void }) => (
    <div>
      <button type="button" onClick={() => onDetected('3017620422003')}>
        Simuler la lecture
      </button>
      <button type="button" onClick={onCancel}>
        Annuler le scan
      </button>
    </div>
  ),
}));

const mockedSearchCiqual = vi.mocked(searchCiqual);
const mockedSearchOFF = vi.mocked(searchOFF);
const mockedFetchOFFProduct = vi.mocked(fetchOFFProduct);

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
  mockedFetchOFFProduct.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

function setup(props: Partial<React.ComponentProps<typeof FoodSearch>> = {}) {
  const onSelect = vi.fn();
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });
  render(<FoodSearch onSelect={onSelect} {...props} />);
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

  describe('scanner de code-barres', () => {
    const nutella: NormalizedFood = {
      source: 'off',
      name: 'Nutella',
      brand: 'Ferrero',
      offCode: '3017620422003',
      kcal_per_100g: 539,
      protein_g: 6.3,
      fat_g: 30.9,
      carbs_g: 57.5,
      fiber_g: 0,
    };

    async function scan(user: ReturnType<typeof userEvent.setup>) {
      await user.click(screen.getByRole('button', { name: 'Scanner un code-barres' }));
      await user.click(screen.getByRole('button', { name: 'Simuler la lecture' }));
    }

    it('cherche le produit scanné et le sélectionne', async () => {
      mockedFetchOFFProduct.mockResolvedValue({ status: 'found', food: nutella });
      const { user, onSelect } = setup();

      await scan(user);

      expect(mockedFetchOFFProduct).toHaveBeenCalledWith('3017620422003', expect.any(AbortSignal));
      await vi.waitFor(() => expect(onSelect).toHaveBeenCalledWith(nutella));
      expect(screen.queryByRole('button', { name: 'Simuler la lecture' })).not.toBeInTheDocument();
    });

    it('propose la recherche par nom si le produit est inconnu', async () => {
      mockedFetchOFFProduct.mockResolvedValue({ status: 'not_found' });
      const { user, onSelect } = setup();

      await scan(user);

      expect(await screen.findByText(/Aucun produit trouvé pour le code 3017620422003/)).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'Produits supermarché' })).toHaveAttribute('aria-selected', 'true');
      expect(onSelect).not.toHaveBeenCalled();

      // Un nouveau scan reste possible
      await user.click(screen.getByRole('button', { name: 'Scanner un code-barres' }));
      expect(screen.getByRole('button', { name: 'Simuler la lecture' })).toBeInTheDocument();
    });

    it('signale un produit sans valeurs nutritionnelles', async () => {
      mockedFetchOFFProduct.mockResolvedValue({ status: 'no_nutrition', name: 'Mystère' });
      const { user } = setup();

      await scan(user);

      expect(await screen.findByText(/« Mystère » est dans Open Food Facts, mais sans valeurs nutritionnelles/)).toBeInTheDocument();
    });

    it('signale une panne d’Open Food Facts', async () => {
      mockedFetchOFFProduct.mockRejectedValue(new Error('503'));
      const { user } = setup();

      await scan(user);

      expect(await screen.findByRole('alert')).toHaveTextContent('Open Food Facts est indisponible');
    });

    it('referme le scanner', async () => {
      const { user } = setup();

      await user.click(screen.getByRole('button', { name: 'Scanner un code-barres' }));
      await user.click(screen.getByRole('button', { name: 'Annuler le scan' }));

      expect(screen.queryByRole('button', { name: 'Simuler la lecture' })).not.toBeInTheDocument();
      expect(mockedFetchOFFProduct).not.toHaveBeenCalled();
    });
  });

  describe('mes aliments et contenu au repos', () => {
    const granola: NormalizedFood = {
      source: 'custom',
      name: 'Pomme au four maison',
      foodId: 'food-1',
      barcode: '3245678901236',
      kcal_per_100g: 120,
      protein_g: 0.5,
      fat_g: 3,
      carbs_g: 22,
      fiber_g: 2,
    };

    it('affiche le contenu au repos tant que rien n’est saisi', async () => {
      const { user, input } = setup({ idleContent: <p>Favoris et récents</p> });
      expect(screen.getByText('Favoris et récents')).toBeInTheDocument();

      await user.type(input, 'po');
      expect(screen.queryByText('Favoris et récents')).not.toBeInTheDocument();

      await user.clear(input);
      expect(screen.getByText('Favoris et récents')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Scanner un code-barres' }));
      expect(screen.queryByText('Favoris et récents')).not.toBeInTheDocument();
    });

    it('propose mes aliments en premier dans les résultats', async () => {
      mockedSearchCiqual.mockResolvedValue([pomme]);
      const { user, input, onSelect } = setup({ personalFoods: [granola] });

      await user.type(input, 'pomme');
      await wait(400);

      const options = await screen.findAllByRole('option');
      expect(options[0]).toHaveTextContent('Pomme au four maison');
      expect(options[0]).toHaveTextContent('PERSO');
      expect(options[1]).toHaveTextContent('Pomme, crue');

      await user.click(options[0]);
      expect(onSelect).toHaveBeenCalledWith(granola);
    });

    it('retrouve au scan un produit de mes aliments sans interroger Open Food Facts', async () => {
      const { user, onSelect } = setup({ personalFoods: [{ ...granola, barcode: '3017620422003' }] });

      await user.click(screen.getByRole('button', { name: 'Scanner un code-barres' }));
      await user.click(screen.getByRole('button', { name: 'Simuler la lecture' }));

      expect(onSelect).toHaveBeenCalledWith({ ...granola, barcode: '3017620422003' });
      expect(mockedFetchOFFProduct).not.toHaveBeenCalled();
    });

    it('propose de créer un produit inconnu avec son code-barres', async () => {
      mockedFetchOFFProduct.mockResolvedValue({ status: 'not_found' });
      const onCreateFood = vi.fn();
      const { user } = setup({ onCreateFood });

      await user.click(screen.getByRole('button', { name: 'Scanner un code-barres' }));
      await user.click(screen.getByRole('button', { name: 'Simuler la lecture' }));
      await user.click(await screen.findByRole('button', { name: 'Créer cet aliment' }));

      expect(onCreateFood).toHaveBeenCalledWith({ barcode: '3017620422003' });
    });

    it('garde le nom connu d’un produit sans valeurs nutritionnelles', async () => {
      mockedFetchOFFProduct.mockResolvedValue({ status: 'no_nutrition', name: 'Mystère' });
      const onCreateFood = vi.fn();
      const { user } = setup({ onCreateFood });

      await user.click(screen.getByRole('button', { name: 'Scanner un code-barres' }));
      await user.click(screen.getByRole('button', { name: 'Simuler la lecture' }));
      await user.click(await screen.findByRole('button', { name: 'Créer cet aliment' }));

      expect(onCreateFood).toHaveBeenCalledWith({ barcode: '3017620422003', name: 'Mystère' });
    });
  });
});
