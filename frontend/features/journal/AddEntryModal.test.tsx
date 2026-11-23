import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AddEntryModal } from './AddEntryModal';
import { getOperationArgs, hasOperation, QueryCall, supabaseMock } from '../../test/supabaseMock';
import { PreferencesContext } from '../../app/contexts/preferencesContextValue';
import { DEFAULT_PREFERENCES } from '../settings/preferences';
import { makeRecipe } from '../../test/fixtures';

const authValue = { user: { id: 'user-1' } };

vi.mock('../../app/contexts/useAuth', () => ({
  useAuth: () => authValue,
}));

vi.mock('../../shared/supabase', async () => {
  const { fakeSupabase } = await import('../../test/supabaseMock');
  return { supabase: fakeSupabase };
});

// La recherche réelle est testée dans FoodSearch.test.tsx : ici, des boutons
// simulent le choix d'un produit OFF (portion de 125 g) et un scan inconnu ;
// le contenu « au repos » (favoris et récents) est affiché tel quel.
vi.mock('../foods/FoodSearch', () => ({
  FoodSearch: ({
    onSelect,
    idleContent,
    onCreateFood,
    personalFoods,
    focusKey,
  }: {
    onSelect: (food: unknown) => void;
    idleContent?: React.ReactNode;
    onCreateFood?: (draft: import('../foods/types').FoodDraft) => void;
    personalFoods?: { name: string }[];
    focusKey?: number;
  }) => (
    <div>
      <p data-testid="search-focus-key">{focusKey ?? 0}</p>
      <button
        type="button"
        onClick={() =>
          onSelect({
            source: 'off', name: 'Yaourt nature', brand: 'Danone', offCode: '123',
            kcal_per_100g: 60, protein_g: 4, fat_g: 3, carbs_g: 5, fiber_g: 0,
            servingGrams: 125, servingLabel: '1 pot (125 g)',
          })
        }
      >
        Choisir un yaourt
      </button>
      <button
        type="button"
        onClick={() =>
          onSelect({
            source: 'off', name: 'Jus multifruits', brand: 'Paquito', offCode: '3250391995684',
            kcal_per_100g: 47, protein_g: 0.5, fat_g: 0, carbs_g: 10, fiber_g: 0,
            servingGrams: 200, servingLabel: '20 cl',
          })
        }
      >
        Choisir un jus
      </button>
      <button type="button" onClick={() => onCreateFood?.({ barcode: '3245678901236', name: 'Mystère' })}>
        Simuler un produit inconnu
      </button>
      <button
        type="button"
        onClick={() =>
          onCreateFood?.({
            barcode: '3242272270157',
            name: 'PastaBox bolognaise',
            servingGrams: 330,
            estimate: {
              values: { kcal_per_100g: 123, protein_g: 6.7, fat_g: 3, carbs_g: 16, fiber_g: 0 },
              source: '1 produit proche : Pasta Box fusilli à la bolognaise (Sodebo)',
            },
          })
        }
      >
        Simuler un produit estimé
      </button>
      <p data-testid="personal-foods">{(personalFoods ?? []).map((food) => food.name).join(', ')}</p>
      {idleContent}
    </div>
  ),
}));

/** Données renvoyées par le faux Supabase, par table */
let tables: { entries: unknown[]; favorite_foods: unknown[]; foods: unknown[]; recipes: unknown[] };

const entry = (label: string, qty: number, kcal: number, meal: string, createdAt: string) => ({
  id: `${label}-${createdAt}`, user_id: 'user-1', date: '2025-01-09', label, qty_grammes: qty, kcal,
  protein_g: 1.5, fat_g: 0.4, carbs_g: 27, fiber_g: 3, meal_type: meal, created_at: createdAt,
});

const granola = {
  id: 'food-1', user_id: 'user-1', name: 'Granola maison', kcal_per_100g: 450, protein_g: 10,
  fat_g: 18, carbs_g: 60, fiber_g: 7, is_public: false, barcode: null, created_at: '2025-01-01T00:00:00Z',
};

function handler(call: QueryCall) {
  const isWrite = ['insert', 'update', 'delete'].some((method) => hasOperation(call, method));
  if (call.table === 'favorite_foods' && hasOperation(call, 'insert')) {
    const payload = getOperationArgs(call, 'insert')?.[0] as Record<string, unknown>;
    return { data: { id: 'fav-new', created_at: '2025-01-10T00:00:00Z', ...payload }, error: null };
  }
  if (call.table === 'foods' && hasOperation(call, 'maybeSingle')) return { data: null, error: null };
  if (call.table === 'foods' && hasOperation(call, 'insert')) {
    const payload = getOperationArgs(call, 'insert')?.[0] as Record<string, unknown>;
    return { data: { id: 'food-new', created_at: '2025-01-10T00:00:00Z', ...payload }, error: null };
  }
  if (isWrite) return { data: null, error: null };
  return { data: tables[call.table as keyof typeof tables] ?? [], error: null };
}

beforeEach(() => {
  supabaseMock.reset();
  tables = { entries: [], favorite_foods: [], foods: [], recipes: [] };
  supabaseMock.setHandler(handler);
});

async function fillManualForm() {
  const user = userEvent.setup();
  await user.click(screen.getByRole('tab', { name: 'Saisie manuelle' }));
  await user.type(screen.getByLabelText("Nom de l'aliment"), '  Salade maison ');
  const setNumber = (label: string, value: string) =>
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  setNumber('Quantité (g)', '250');
  setNumber('Calories (kcal)', '320');
  setNumber('Protéines (g)', '12.5');
  setNumber('Lipides (g)', '18');
  setNumber('Glucides (g)', '25');
  return user;
}

describe('AddEntryModal', () => {
  it('ajoute une saisie manuelle et reste ouverte : formulaire vidé, repas gardé', async () => {
    const onAdd = vi.fn().mockResolvedValue(true);
    const onClose = vi.fn();
    render(<AddEntryModal date="2025-01-10" onAdd={onAdd} onClose={onClose} />);

    const user = await fillManualForm();
    await user.click(screen.getByRole('button', { name: 'Collation' }));
    await user.click(screen.getByRole('button', { name: 'Ajouter' }));

    expect(onAdd).toHaveBeenCalledWith({
      label: 'Salade maison',
      qty_grammes: 250,
      kcal: 320,
      protein_g: 12.5,
      fat_g: 18,
      carbs_g: 25,
      fiber_g: 0,
      meal_type: 'snack',
    });
    expect(onClose).not.toHaveBeenCalled();
    expect(await screen.findByRole('status')).toHaveTextContent('✓ Salade maison ajouté · Collation · 320 kcal');
    expect(screen.getByLabelText("Nom de l'aliment")).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Collation' })).toHaveAttribute('aria-pressed', 'true');
    // Clavier : prêt à saisir le nom de l'aliment suivant
    expect(screen.getByLabelText("Nom de l'aliment")).toHaveFocus();
  });

  it('ajoute un aliment de la recherche et reste ouverte, prête pour le suivant', async () => {
    const onAdd = vi.fn().mockResolvedValue(true);
    const onClose = vi.fn();
    render(<AddEntryModal date="2025-01-10" onAdd={onAdd} onClose={onClose} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Choisir un yaourt' }));
    await user.click(screen.getByRole('button', { name: 'Ajouter' }));

    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
    // 125 g à 60 kcal pour 100 g, sans repas choisi
    expect(await screen.findByRole('status')).toHaveTextContent('✓ Danone Yaourt nature ajouté · 75 kcal');
    // Sélection retirée : un second clic n'ajoute rien
    expect(screen.queryByLabelText('Quantité (grammes)')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ajouter' })).toBeDisabled();
    // Le champ de recherche reprend le focus
    expect(screen.getByTestId('search-focus-key')).toHaveTextContent('1');
  });

  it('remonte en haut de la fenêtre pour montrer la confirmation', async () => {
    // scrollTo n'existe pas sur les éléments dans jsdom : on note les appels
    const scrolled: Array<{ element: Element; options: unknown }> = [];
    Element.prototype.scrollTo = function (this: Element, options?: unknown) {
      scrolled.push({ element: this, options });
    } as Element['scrollTo'];
    try {
      render(<AddEntryModal date="2025-01-10" onAdd={vi.fn().mockResolvedValue(true)} onClose={vi.fn()} />);
      const user = await fillManualForm();
      await user.click(screen.getByRole('button', { name: 'Ajouter' }));
      await screen.findByRole('status');

      const dialog = screen.getByRole('dialog', { name: 'Ajouter un aliment' });
      expect(scrolled.some(({ element, options }) => dialog.contains(element) && (options as { top?: number })?.top === 0)).toBe(true);
    } finally {
      // @ts-expect-error nettoyage du simulacre (absent de jsdom)
      delete Element.prototype.scrollTo;
    }
  });

  it("efface la confirmation si l'ajout suivant échoue", async () => {
    const onAdd = vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    render(<AddEntryModal date="2025-01-10" onAdd={onAdd} onClose={vi.fn()} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Choisir un yaourt' }));
    await user.click(screen.getByRole('button', { name: 'Ajouter' }));
    expect(await screen.findByRole('status')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Choisir un yaourt' }));
    await user.click(screen.getByRole('button', { name: 'Ajouter' }));
    expect(await screen.findByRole('alert')).toHaveTextContent("L'ajout a échoué");
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('efface la confirmation au changement d’onglet', async () => {
    render(<AddEntryModal date="2025-01-10" onAdd={vi.fn().mockResolvedValue(true)} onClose={vi.fn()} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Choisir un yaourt' }));
    await user.click(screen.getByRole('button', { name: 'Ajouter' }));
    expect(await screen.findByRole('status')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Saisie manuelle' }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it("affiche un message si l'ajout échoue et garde la fenêtre ouverte (régression)", async () => {
    const onAdd = vi.fn().mockResolvedValue(false);
    const onClose = vi.fn();
    render(<AddEntryModal date="2025-01-10" onAdd={onAdd} onClose={onClose} />);

    const user = await fillManualForm();
    await user.click(screen.getByRole('button', { name: 'Ajouter' }));

    expect(await screen.findByRole('alert')).toHaveTextContent("L'ajout a échoué");
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Ajouter' })).toBeEnabled();
  });

  it('bloque une saisie manuelle invalide', async () => {
    const onAdd = vi.fn();
    render(<AddEntryModal date="2025-01-10" onAdd={onAdd} onClose={vi.fn()} />);

    const user = userEvent.setup();
    await user.click(screen.getByRole('tab', { name: 'Saisie manuelle' }));

    // Nom vide : le bouton est désactivé
    expect(screen.getByRole('button', { name: 'Ajouter' })).toBeDisabled();
    expect(onAdd).not.toHaveBeenCalled();
  });

  it('propose la portion du fabricant par défaut et des portions rapides', async () => {
    const onAdd = vi.fn().mockResolvedValue(true);
    render(<AddEntryModal date="2025-01-10" onAdd={onAdd} onClose={vi.fn()} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Choisir un yaourt' }));
    expect(screen.getByLabelText('Quantité (grammes)')).toHaveValue(125);
    expect(screen.getByRole('button', { name: '1 portion (125 g)' })).toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getByRole('button', { name: '2 portions' }));
    expect(screen.getByLabelText('Quantité (grammes)')).toHaveValue(250);

    await user.click(screen.getByRole('button', { name: 'Ajouter' }));
    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ qty_grammes: 250, kcal: 150, label: 'Danone Yaourt nature' }));
  });

  it('propose la portion d’une boisson en ml (1 ml ≈ 1 g)', async () => {
    render(<AddEntryModal date="2025-01-10" onAdd={vi.fn().mockResolvedValue(true)} onClose={vi.fn()} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Choisir un jus' }));
    expect(screen.getByLabelText('Quantité (grammes)')).toHaveValue(200);
    expect(screen.getByRole('button', { name: '1 portion (200 ml)' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: '2 portions' }));
    expect(screen.getByLabelText('Quantité (grammes)')).toHaveValue(400);
  });

  it('se ferme avec la touche Échap', async () => {
    const onClose = vi.fn();
    render(<AddEntryModal date="2025-01-10" onAdd={vi.fn()} onClose={onClose} />);

    await userEvent.setup().keyboard('{Escape}');

    expect(onClose).toHaveBeenCalled();
  });

  it('expose une boîte de dialogue accessible', () => {
    render(<AddEntryModal date="2025-01-10" onAdd={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByRole('dialog', { name: 'Ajouter un aliment' })).toBeInTheDocument();
  });

  it('propose les repas visibles avec leurs noms personnalisés', async () => {
    render(
      <PreferencesContext.Provider
        value={{
          preferences: { ...DEFAULT_PREFERENCES, mealLabels: { snack: 'Goûter' }, hiddenMeals: ['dinner'] },
          savePreferences: vi.fn(),
          status: 'ready',
          markTourCompleted: vi.fn(),
          markVersionSeen: vi.fn(),
        }}
      >
        <AddEntryModal date="2025-01-10" onAdd={vi.fn()} onClose={vi.fn()} />
      </PreferencesContext.Provider>
    );
    await userEvent.setup().click(screen.getByRole('tab', { name: 'Saisie manuelle' }));

    expect(screen.getByRole('button', { name: 'Goûter' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Dîner' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Petit-déjeuner' })).toBeInTheDocument();
  });

  describe('favoris et récents', () => {
    beforeEach(() => {
      tables.entries = [
        entry('Banane', 120, 107, 'breakfast', '2025-01-09T08:00:00Z'),
        entry('Banane', 120, 107, 'breakfast', '2025-01-08T08:00:00Z'),
      ];
    });

    it('ajoute un aliment récent en un tap, avec sa quantité et son repas habituels, sans fermer', async () => {
      const onAdd = vi.fn().mockResolvedValue(true);
      const onClose = vi.fn();
      render(<AddEntryModal date="2025-01-10" onAdd={onAdd} onClose={onClose} />);

      await userEvent.setup().click(await screen.findByRole('button', { name: 'Ajouter « Banane » (120 g) au journal' }));

      expect(onAdd).toHaveBeenCalledWith({
        label: 'Banane',
        qty_grammes: 120,
        kcal: 107,
        protein_g: 1.5,
        fat_g: 0.4,
        carbs_g: 27,
        fiber_g: 3,
        meal_type: 'breakfast',
      });
      expect(onClose).not.toHaveBeenCalled();
      expect(await screen.findByRole('status')).toHaveTextContent('✓ Banane ajouté · Petit-déjeuner · 107 kcal');
    });

    it('enchaîne deux ajouts rapides puis se ferme avec la croix', async () => {
      const onAdd = vi.fn().mockResolvedValue(true);
      const onClose = vi.fn();
      render(<AddEntryModal date="2025-01-10" onAdd={onAdd} onClose={onClose} />);
      const user = userEvent.setup();

      const quickAdd = await screen.findByRole('button', { name: 'Ajouter « Banane » (120 g) au journal' });
      await user.click(quickAdd);
      await screen.findByRole('status');
      await user.click(screen.getByRole('button', { name: 'Ajouter « Banane » (120 g) au journal' }));
      await waitFor(() => expect(onAdd).toHaveBeenCalledTimes(2));
      expect(onClose).not.toHaveBeenCalled();

      await user.click(screen.getByRole('button', { name: 'Fermer la fenêtre' }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('propose le repas du dernier ajout pour l’aliment suivant', async () => {
      render(<AddEntryModal date="2025-01-10" onAdd={vi.fn().mockResolvedValue(true)} onClose={vi.fn()} />);
      const user = userEvent.setup();

      await screen.findByRole('list', { name: 'Récents' });
      await user.click(screen.getByRole('button', { name: 'Choisir un yaourt' }));
      await user.click(screen.getByRole('button', { name: 'Déjeuner' }));
      await user.click(screen.getByRole('button', { name: 'Ajouter' }));
      await screen.findByRole('status');

      // La banane se mange d'habitude au petit-déjeuner : le repas en cours l'emporte
      await user.click(screen.getByRole('button', { name: /^Banane/ }));
      expect(screen.getByRole('button', { name: 'Déjeuner' })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByRole('button', { name: 'Petit-déjeuner' })).toHaveAttribute('aria-pressed', 'false');
    });

    it('sélectionne un récent pour ajuster la quantité avant l’ajout', async () => {
      const onAdd = vi.fn().mockResolvedValue(true);
      render(<AddEntryModal date="2025-01-10" onAdd={onAdd} onClose={vi.fn()} />);
      const user = userEvent.setup();

      await user.click(await screen.findByRole('button', { name: /^Banane/ }));
      expect(screen.getByLabelText('Quantité (grammes)')).toHaveValue(120);
      fireEvent.change(screen.getByLabelText('Quantité (grammes)'), { target: { value: '60' } });
      await user.click(screen.getByRole('button', { name: 'Ajouter' }));

      expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ label: 'Banane', qty_grammes: 60, kcal: 54, meal_type: 'breakfast' }));
    });

    it('ajoute un récent aux favoris puis le retire', async () => {
      render(<AddEntryModal date="2025-01-10" onAdd={vi.fn()} onClose={vi.fn()} />);
      const user = userEvent.setup();

      await user.click(await screen.findByRole('button', { name: 'Ajouter « Banane » aux favoris' }));

      const [insert] = supabaseMock.callsFor('favorite_foods', 'insert');
      expect(getOperationArgs(insert, 'insert')?.[0]).toMatchObject({ user_id: 'user-1', label: 'Banane', default_qty_g: 120 });
      const favorites = await screen.findByRole('list', { name: 'Favoris' });
      expect(within(favorites).getByText('Banane')).toBeInTheDocument();
      expect(screen.queryByRole('list', { name: 'Récents' })).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Retirer « Banane » des favoris' }));
      const [remove] = supabaseMock.callsFor('favorite_foods', 'delete');
      expect(remove.operations).toContainEqual({ method: 'eq', args: ['id', 'fav-new'] });
      expect(await screen.findByRole('list', { name: 'Récents' })).toBeInTheDocument();
    });

    it('un aliment choisi dans la recherche reprend sa quantité et son repas habituels', async () => {
      tables.entries = [entry('Danone Yaourt nature', 150, 90, 'snack', '2025-01-09T16:00:00Z')];
      render(<AddEntryModal date="2025-01-10" onAdd={vi.fn()} onClose={vi.fn()} />);
      const user = userEvent.setup();

      await screen.findByRole('list', { name: 'Récents' });
      await user.click(screen.getByRole('button', { name: 'Choisir un yaourt' }));

      // 150 g habituels plutôt que la portion du fabricant (125 g)
      expect(screen.getByLabelText('Quantité (grammes)')).toHaveValue(150);
      expect(screen.getByRole('button', { name: 'Collation' })).toHaveAttribute('aria-pressed', 'true');
    });

    it('met en favori l’aliment choisi avec la quantité en cours', async () => {
      render(<AddEntryModal date="2025-01-10" onAdd={vi.fn()} onClose={vi.fn()} />);
      const user = userEvent.setup();

      await user.click(screen.getByRole('button', { name: 'Choisir un yaourt' }));
      await user.click(screen.getByRole('button', { name: 'Ajouter aux favoris' }));

      const [insert] = supabaseMock.callsFor('favorite_foods', 'insert');
      expect(getOperationArgs(insert, 'insert')?.[0]).toMatchObject({
        label: 'Danone Yaourt nature',
        kcal_per_100g: 60,
        default_qty_g: 125,
      });
      expect(await screen.findByRole('button', { name: 'Retirer des favoris' })).toHaveAttribute('aria-pressed', 'true');
    });
  });

  describe('mes aliments', () => {
    it('enregistre une saisie manuelle dans mes aliments et relie l’entrée', async () => {
      const onAdd = vi.fn().mockResolvedValue(true);
      render(<AddEntryModal date="2025-01-10" onAdd={onAdd} onClose={vi.fn()} />);

      const user = await fillManualForm();
      await user.click(screen.getByRole('checkbox', { name: /Enregistrer dans mes aliments/ }));
      await user.click(screen.getByRole('button', { name: 'Ajouter' }));

      const [insert] = supabaseMock.callsFor('foods', 'insert');
      // 320 kcal pour 250 g → 128 kcal pour 100 g
      expect(getOperationArgs(insert, 'insert')?.[0]).toMatchObject({
        user_id: 'user-1',
        name: 'Salade maison',
        kcal_per_100g: 128,
        protein_g: 5,
        barcode: null,
      });
      expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ label: 'Salade maison', food_id: 'food-new', kcal: 320 }));
    });

    it('produit scanné inconnu : saisie manuelle pré-remplie avec son nom et son code-barres', async () => {
      const onAdd = vi.fn().mockResolvedValue(true);
      render(<AddEntryModal date="2025-01-10" onAdd={onAdd} onClose={vi.fn()} />);
      const user = userEvent.setup();

      await user.click(screen.getByRole('button', { name: 'Simuler un produit inconnu' }));

      expect(screen.getByRole('tab', { name: 'Saisie manuelle' })).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByLabelText("Nom de l'aliment")).toHaveValue('Mystère');
      expect(screen.getByRole('checkbox', { name: /Enregistrer dans mes aliments/ })).toBeChecked();
      expect(screen.getByLabelText('Code-barres')).toHaveValue('3245678901236');
      expect(screen.getByText(/valeurs de l’étiquette pour 100 g/)).toBeInTheDocument();

      fireEvent.change(screen.getByLabelText('Calories (kcal)'), { target: { value: '250' } });
      await user.click(screen.getByRole('button', { name: 'Ajouter' }));

      await waitFor(() => expect(supabaseMock.callsFor('foods', 'insert')).toHaveLength(1));
      const [insert] = supabaseMock.callsFor('foods', 'insert');
      expect(getOperationArgs(insert, 'insert')?.[0]).toMatchObject({
        name: 'Mystère',
        barcode: '3245678901236',
        kcal_per_100g: 250,
        values_estimated: false,
      });
      expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ label: 'Mystère', qty_grammes: 100, food_id: 'food-new' }));
    });

    describe('produit scanné sans valeurs : estimation', () => {
      const pastaBox = {
        id: 'food-pasta', user_id: 'user-1', name: 'PastaBox bolognaise', kcal_per_100g: 123, protein_g: 6.7,
        fat_g: 3, carbs_g: 16, fiber_g: 0, is_public: false, barcode: '3242272270157', values_estimated: true,
        created_at: '2025-01-01T00:00:00Z',
      };

      async function openEstimate() {
        const onAdd = vi.fn().mockResolvedValue(true);
        render(<AddEntryModal date="2025-01-10" onAdd={onAdd} onClose={vi.fn()} />);
        const user = userEvent.setup();
        await user.click(screen.getByRole('button', { name: 'Simuler un produit estimé' }));
        return { user, onAdd };
      }

      async function savedPayload() {
        await waitFor(() => expect(supabaseMock.callsFor('foods', 'insert')).toHaveLength(1));
        return getOperationArgs(supabaseMock.callsFor('foods', 'insert')[0], 'insert')?.[0] as Record<string, unknown>;
      }

      it('pré-remplit la saisie avec les valeurs estimées et le signale', async () => {
        await openEstimate();

        expect(screen.getByRole('tab', { name: 'Saisie manuelle' })).toHaveAttribute('aria-selected', 'true');
        expect(screen.getByLabelText("Nom de l'aliment")).toHaveValue('PastaBox bolognaise');
        expect(screen.getByLabelText('Quantité (g)')).toHaveValue(330);
        expect(screen.getByRole('radio', { name: '100 g (étiquette)' })).toBeChecked();
        expect(screen.getByLabelText('Calories (kcal)')).toHaveValue(123);
        expect(screen.getByLabelText('Protéines (g)')).toHaveValue(6.7);
        expect(screen.getByLabelText('Lipides (g)')).toHaveValue(3);
        expect(screen.getByLabelText('Glucides (g)')).toHaveValue(16);
        expect(screen.getByRole('checkbox', { name: /Enregistrer dans mes aliments/ })).toBeChecked();
        expect(screen.getByLabelText('Code-barres')).toHaveValue('3242272270157');
        expect(screen.getByText(/d’après 1 produit proche/)).toHaveTextContent(
          'Valeurs estimées d’après 1 produit proche : Pasta Box fusilli à la bolognaise (Sodebo). Corrigez-les avec l’étiquette si vous l’avez. Le produit sera enregistré dans vos aliments et reconnu au prochain scan.'
        );
        expect(screen.queryByText(/recopiez les valeurs de l’étiquette/)).not.toBeInTheDocument();
      });

      it('enregistre l’aliment comme estimé si les valeurs n’ont pas changé', async () => {
        const { user, onAdd } = await openEstimate();
        await user.click(screen.getByRole('button', { name: 'Ajouter' }));

        expect(await savedPayload()).toMatchObject({ barcode: '3242272270157', kcal_per_100g: 123, values_estimated: true });
        expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ label: 'PastaBox bolognaise', qty_grammes: 330, kcal: 406 }));
      });

      it('n’est plus estimé dès qu’une valeur est corrigée', async () => {
        const { user } = await openEstimate();
        fireEvent.change(screen.getByLabelText('Calories (kcal)'), { target: { value: '127' } });
        await user.click(screen.getByRole('button', { name: 'Ajouter' }));

        expect(await savedPayload()).toMatchObject({ kcal_per_100g: 127, values_estimated: false });
      });

      it('n’est plus estimé si les valeurs sont saisies pour la quantité indiquée', async () => {
        const { user } = await openEstimate();
        await user.click(screen.getByRole('radio', { name: 'La quantité indiquée' }));
        await user.click(screen.getByRole('button', { name: 'Ajouter' }));

        expect(await savedPayload()).toMatchObject({ values_estimated: false });
      });

      it('affiche le badge « Estimé » dans mes aliments', async () => {
        tables.foods = [pastaBox];
        render(<AddEntryModal date="2025-01-10" onAdd={vi.fn()} onClose={vi.fn()} />);
        const user = userEvent.setup();

        await user.click(screen.getByRole('tab', { name: 'Mes aliments' }));
        const list = await screen.findByRole('list', { name: 'Mes aliments' });
        const row = within(list).getByText('PastaBox bolognaise').closest('li')!;
        expect(within(row).getByText('Estimé')).toBeInTheDocument();
      });

      it('corrige un aliment estimé avec les valeurs de l’étiquette', async () => {
        tables.foods = [pastaBox];
        render(<AddEntryModal date="2025-01-10" onAdd={vi.fn().mockResolvedValue(true)} onClose={vi.fn()} />);
        const user = userEvent.setup();

        await user.click(screen.getByRole('tab', { name: 'Mes aliments' }));
        const list = await screen.findByRole('list', { name: 'Mes aliments' });
        await user.click(within(list).getByRole('button', { name: 'Utiliser « PastaBox bolognaise »' }));

        expect(screen.getByText('Estimé')).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Corriger avec l’étiquette' }));

        expect(screen.getByRole('tab', { name: 'Saisie manuelle' })).toHaveAttribute('aria-selected', 'true');
        expect(screen.getByLabelText("Nom de l'aliment")).toHaveValue('PastaBox bolognaise');
        expect(screen.getByLabelText('Calories (kcal)')).toHaveValue(123);
        expect(screen.getByLabelText('Code-barres')).toHaveValue('3242272270157');
        expect(screen.getByText('Valeurs estimées : remplacez-les par celles de l’étiquette.')).toBeInTheDocument();

        fireEvent.change(screen.getByLabelText('Calories (kcal)'), { target: { value: '127' } });
        await user.click(screen.getByRole('button', { name: 'Ajouter' }));
        expect(await savedPayload()).toMatchObject({ barcode: '3242272270157', kcal_per_100g: 127, values_estimated: false });
      });
    });

    it('refuse un code-barres invalide sans rien enregistrer', async () => {
      const onAdd = vi.fn();
      render(<AddEntryModal date="2025-01-10" onAdd={onAdd} onClose={vi.fn()} />);

      const user = await fillManualForm();
      await user.click(screen.getByRole('checkbox', { name: /Enregistrer dans mes aliments/ }));
      await user.type(screen.getByLabelText('Code-barres'), '12345');
      await user.click(screen.getByRole('button', { name: 'Ajouter' }));

      expect(screen.getByText(/Code-barres invalide/)).toBeInTheDocument();
      expect(supabaseMock.callsFor('foods', 'insert')).toHaveLength(0);
      expect(onAdd).not.toHaveBeenCalled();
    });

    it('onglet Mes aliments : utiliser puis supprimer un aliment', async () => {
      tables.foods = [granola];
      const onAdd = vi.fn().mockResolvedValue(true);
      render(<AddEntryModal date="2025-01-10" onAdd={onAdd} onClose={vi.fn()} />);
      const user = userEvent.setup();

      // Mes aliments sont aussi transmis à la recherche
      await waitFor(() => expect(screen.getByTestId('personal-foods')).toHaveTextContent('Granola maison'));

      await user.click(screen.getByRole('tab', { name: 'Mes aliments' }));
      const list = await screen.findByRole('list', { name: 'Mes aliments' });
      expect(within(list).getByText('450 kcal pour 100 g')).toBeInTheDocument();

      await user.click(within(list).getByRole('button', { name: 'Utiliser « Granola maison »' }));
      expect(screen.getByRole('tab', { name: 'Recherche' })).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByLabelText('Quantité (grammes)')).toHaveValue(100);
      await user.click(screen.getByRole('button', { name: 'Ajouter' }));
      expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ label: 'Granola maison', food_id: 'food-1', kcal: 450 }));
    });

    it('supprime un aliment après confirmation', async () => {
      tables.foods = [granola];
      render(<AddEntryModal date="2025-01-10" onAdd={vi.fn()} onClose={vi.fn()} />);
      const user = userEvent.setup();

      await user.click(screen.getByRole('tab', { name: 'Mes aliments' }));
      await user.click(await screen.findByRole('button', { name: 'Supprimer « Granola maison »' }));
      expect(supabaseMock.callsFor('foods', 'delete')).toHaveLength(0);
      await user.click(screen.getByRole('button', { name: 'Confirmer la suppression de « Granola maison »' }));

      const [remove] = supabaseMock.callsFor('foods', 'delete');
      expect(remove.operations).toContainEqual({ method: 'eq', args: ['id', 'food-1'] });
      expect(await screen.findByText(/Aucun aliment personnel/)).toBeInTheDocument();
    });
  });

  describe('onglet Recettes', () => {
    it('est accessible au clavier après « Mes aliments »', async () => {
      render(<AddEntryModal date="2025-01-10" onAdd={vi.fn()} onClose={vi.fn()} />);
      const user = userEvent.setup();
      await user.click(screen.getByRole('tab', { name: 'Mes aliments' }));
      await user.keyboard('{ArrowRight}');
      const tab = screen.getByRole('tab', { name: 'Recettes' });
      expect(tab).toHaveAttribute('aria-selected', 'true');
      expect(tab).toHaveFocus();
    });

    it('ajoute une part de recette en un geste et reste ouverte', async () => {
      tables.recipes = [makeRecipe()];
      tables.entries = [entry('Chili maison — 1 part', 450, 491, 'dinner', '2025-01-08T19:00:00Z')];
      const onAdd = vi.fn().mockResolvedValue(true);
      const onClose = vi.fn();
      render(<AddEntryModal date="2025-01-10" onAdd={onAdd} onClose={onClose} />);
      const user = userEvent.setup();

      await user.click(screen.getByRole('tab', { name: 'Recettes' }));
      await user.click(await screen.findByRole('button', { name: 'Ajouter 1 part de « Chili maison » au journal' }));

      expect(onAdd).toHaveBeenCalledWith(
        expect.objectContaining({ label: 'Chili maison — 1 part', qty_grammes: 450, kcal: 491, meal_type: 'dinner' })
      );
      expect(await screen.findByRole('status')).toHaveTextContent('✓ Chili maison — 1 part ajouté · Dîner · 491 kcal');
      expect(onClose).not.toHaveBeenCalled();
    });

    it('garde le focus dans la fenêtre après l’ajout d’une portion (retour à la liste)', async () => {
      tables.recipes = [makeRecipe()];
      render(<AddEntryModal date="2025-01-10" onAdd={vi.fn().mockResolvedValue(true)} onClose={vi.fn()} />);
      const user = userEvent.setup();

      await user.click(screen.getByRole('tab', { name: 'Recettes' }));
      await user.click(await screen.findByRole('button', { name: /^Chili maison/ }));
      await user.click(screen.getByRole('button', { name: 'Ajouter' }));

      const status = await screen.findByRole('status');
      await waitFor(() => expect(status).toHaveFocus());
    });
  });
});
