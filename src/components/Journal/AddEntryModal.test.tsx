import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AddEntryModal } from './AddEntryModal';
import { supabaseMock } from '../../test/supabaseMock';

const authValue = { user: { id: 'user-1' } };

vi.mock('../../contexts/useAuth', () => ({
  useAuth: () => authValue,
}));

vi.mock('../../lib/supabase', async () => {
  const { fakeSupabase } = await import('../../test/supabaseMock');
  return { supabase: fakeSupabase };
});

// La recherche réelle est testée dans FoodSearch.test.tsx : ici, un bouton
// simule le choix d'un produit OFF ayant une portion de 125 g.
vi.mock('../Foods/FoodSearch', () => ({
  FoodSearch: ({ onSelect }: { onSelect: (food: unknown) => void }) => (
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
  ),
}));

beforeEach(() => {
  supabaseMock.reset();
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
  it('ajoute une saisie manuelle puis ferme la fenêtre', async () => {
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
    expect(onClose).toHaveBeenCalled();
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
});
