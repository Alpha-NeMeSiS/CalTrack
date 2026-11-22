import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FoodSearch } from './FoodSearch';
import { searchCiqual } from '../../lib/ciqual';
import { fetchOFFProduct, searchOFF } from '../../lib/openfoodfacts';
import { estimateFromSimilar, findSimilarProducts, SimilarEstimate } from '../../lib/similarProducts';
import type { NormalizedFood } from '../../types/food';

vi.mock('../../lib/ciqual', () => ({ searchCiqual: vi.fn() }));
vi.mock('../../lib/openfoodfacts', () => ({ searchOFF: vi.fn(), fetchOFFProduct: vi.fn() }));
// Produits similaires : seule la recherche réseau est simulée, les textes restent réels
vi.mock('../../lib/similarProducts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/similarProducts')>()),
  findSimilarProducts: vi.fn(),
}));
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
const mockedFindSimilar = vi.mocked(findSimilarProducts);

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
  mockedFindSimilar.mockReset();
  mockedFindSimilar.mockResolvedValue(null);
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
  it('reprend le focus quand focusKey change (aliment suivant)', () => {
    const onSelect = vi.fn();
    const { rerender } = render(<FoodSearch onSelect={onSelect} />);
    const input = screen.getByRole('combobox', { name: "Recherche d'aliment" });
    expect(input).not.toHaveFocus();

    rerender(<FoodSearch onSelect={onSelect} focusKey={1} />);
    expect(input).toHaveFocus();
  });

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
      mockedFetchOFFProduct.mockResolvedValue({ status: 'no_nutrition', code: '3017620422003', name: 'Mystère' });
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
      mockedFetchOFFProduct.mockResolvedValue({ status: 'no_nutrition', code: '3017620422003', name: 'Mystère' });
      const onCreateFood = vi.fn();
      const { user } = setup({ onCreateFood });

      await user.click(screen.getByRole('button', { name: 'Scanner un code-barres' }));
      await user.click(screen.getByRole('button', { name: 'Simuler la lecture' }));
      await user.click(await screen.findByRole('button', { name: 'Créer cet aliment' }));

      expect(onCreateFood).toHaveBeenCalledWith({ barcode: '3017620422003', name: 'Mystère' });
    });
  });

  describe('produit scanné sans valeurs : produits similaires', () => {
    const pastaBox: NormalizedFood = {
      source: 'off',
      name: 'Pasta Box fusilli à la bolognaise',
      brand: 'Sodebo',
      offCode: '3242272252054',
      kcal_per_100g: 123,
      protein_g: 6.7,
      fat_g: 3,
      carbs_g: 16,
      fiber_g: 0,
    };
    const estimate = estimateFromSimilar([{ food: pastaBox, score: 1.25, sameBrand: true }])!;

    function emptyProduct() {
      mockedFetchOFFProduct.mockResolvedValue({
        status: 'no_nutrition',
        code: '3017620422003',
        name: 'Mystère',
        brand: 'Marque',
        servingGrams: 330,
      });
    }

    async function scan(user: ReturnType<typeof userEvent.setup>) {
      await user.click(screen.getByRole('button', { name: 'Scanner un code-barres' }));
      await user.click(screen.getByRole('button', { name: 'Simuler la lecture' }));
    }

    function deferred() {
      let resolve!: (value: SimilarEstimate | null) => void;
      const promise = new Promise<SimilarEstimate | null>((done) => {
        resolve = done;
      });
      return { promise, resolve };
    }

    it('cherche des produits similaires puis affiche l’estimation', async () => {
      emptyProduct();
      const pending = deferred();
      mockedFindSimilar.mockReturnValue(pending.promise);
      const { user } = setup({ onCreateFood: vi.fn() });

      await scan(user);

      expect(await screen.findByText('Recherche de produits similaires…')).toBeInTheDocument();
      expect(mockedFindSimilar).toHaveBeenCalledWith(
        { code: '3017620422003', name: 'Mystère', brand: 'Marque' },
        expect.any(AbortSignal)
      );
      expect(screen.queryByRole('button', { name: 'Créer cet aliment' })).not.toBeInTheDocument();

      await act(async () => pending.resolve(estimate));

      expect(screen.getByRole('region', { name: 'Estimation pour 100 g' })).toBeInTheDocument();
      expect(screen.queryByText('Recherche de produits similaires…')).not.toBeInTheDocument();
    });

    it('pré-remplit la création avec l’estimation', async () => {
      emptyProduct();
      mockedFindSimilar.mockResolvedValue(estimate);
      const onCreateFood = vi.fn();
      const { user } = setup({ onCreateFood });

      await scan(user);
      await user.click(await screen.findByRole('button', { name: 'Utiliser l’estimation' }));

      expect(onCreateFood).toHaveBeenCalledWith({
        barcode: '3017620422003',
        name: 'Mystère',
        servingGrams: 330,
        estimate: {
          values: { kcal_per_100g: 123, protein_g: 6.7, fat_g: 3, carbs_g: 16, fiber_g: 0 },
          source: '1 produit proche : Pasta Box fusilli à la bolognaise (Sodebo)',
        },
      });
    });

    it('ouvre la saisie de l’étiquette sans estimation', async () => {
      emptyProduct();
      mockedFindSimilar.mockResolvedValue(estimate);
      const onCreateFood = vi.fn();
      const { user } = setup({ onCreateFood });

      await scan(user);
      await user.click(await screen.findByRole('button', { name: 'Saisir l’étiquette' }));

      expect(onCreateFood).toHaveBeenCalledWith({ barcode: '3017620422003', name: 'Mystère', servingGrams: 330 });
    });

    it.each([
      ['aucun produit similaire', () => mockedFindSimilar.mockResolvedValue(null)],
      ['une panne de la recherche', () => mockedFindSimilar.mockRejectedValue(new Error('503'))],
    ])('propose la saisie de l’étiquette après %s', async (_case, arrange) => {
      emptyProduct();
      arrange();
      const onCreateFood = vi.fn();
      const { user } = setup({ onCreateFood });

      await scan(user);

      expect(
        await screen.findByText(/Aucun produit similaire trouvé : créez-le avec les valeurs de l’étiquette\./)
      ).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Créer cet aliment' }));
      expect(onCreateFood).toHaveBeenCalledWith({ barcode: '3017620422003', name: 'Mystère', servingGrams: 330 });
    });

    it('ignore une estimation arrivée après un nouveau scan', async () => {
      emptyProduct();
      const pending = deferred();
      mockedFindSimilar.mockReturnValue(pending.promise);
      const { user, onSelect } = setup({ onCreateFood: vi.fn() });

      await scan(user);
      await screen.findByText('Recherche de produits similaires…');

      mockedFetchOFFProduct.mockResolvedValue({ status: 'found', food: pastaBox });
      await scan(user);
      await vi.waitFor(() => expect(onSelect).toHaveBeenCalledWith(pastaBox));

      await act(async () => pending.resolve(estimate));
      expect(screen.queryByRole('region', { name: 'Estimation pour 100 g' })).not.toBeInTheDocument();
      expect(screen.queryByText('Recherche de produits similaires…')).not.toBeInTheDocument();
    });

    it('signale un aliment personnel aux valeurs estimées dans les résultats', async () => {
      mockedSearchCiqual.mockResolvedValue([]);
      const estimated: NormalizedFood = {
        source: 'custom',
        name: 'PastaBox bolognaise',
        foodId: 'f1',
        barcode: '3242272270157',
        estimated: true,
        kcal_per_100g: 123,
        protein_g: 6.7,
        fat_g: 3,
        carbs_g: 16,
        fiber_g: 0,
      };
      const { user, input } = setup({ personalFoods: [estimated] });

      await user.type(input, 'pasta');
      await wait(400);

      const option = await screen.findByRole('option', { name: /PastaBox bolognaise/ });
      expect(within(option).getByText('Estimé')).toBeInTheDocument();
    });
  });
});
