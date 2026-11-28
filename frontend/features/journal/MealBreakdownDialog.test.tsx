import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MealBreakdownDialog } from './MealBreakdownDialog';
import type { MealBreakdown } from './entries';

// Mêmes valeurs que les tests de summarizeMeals (entries.test.ts)
const breakdown: MealBreakdown = {
  meals: [
    { meal: 'breakfast', label: 'Petit-déjeuner', kcal: 420, protein_g: 18, fat_g: 12, carbs_g: 58, fiber_g: 6, sharePct: 39 },
    { meal: 'dinner', label: 'Dîner', kcal: 650, protein_g: 35, fat_g: 22, carbs_g: 70, fiber_g: 7, sharePct: 61 },
  ],
  total: { kcal: 1070, protein_g: 53, fat_g: 34, carbs_g: 128, fiber_g: 13 },
};

function renderDialog(onClose = vi.fn()) {
  render(<MealBreakdownDialog breakdown={breakdown} dateLabel="vendredi 28 novembre" onClose={onClose} />);
  return onClose;
}

describe('MealBreakdownDialog', () => {
  it('affiche une ligne par repas et la ligne Total', () => {
    renderDialog();
    const dialog = screen.getByRole('dialog', { name: 'Détail par repas' });
    // En-tête + 2 repas + Total
    expect(within(dialog).getAllByRole('row')).toHaveLength(4);

    const breakfast = within(dialog).getByRole('row', { name: /Petit-déjeuner/ });
    expect(breakfast).toHaveTextContent('420');
    expect(breakfast).toHaveTextContent('39 %');
    expect(breakfast).toHaveTextContent('18 g');

    const total = within(dialog).getByRole('row', { name: /Total/ });
    expect(total).toHaveTextContent('1070');
    expect(total).toHaveTextContent('128 g');
  });

  it("nomme les colonnes en entier pour les lecteurs d'écran", () => {
    renderDialog();
    for (const name of ['Protéines', 'Lipides', 'Glucides', 'Fibres']) {
      expect(screen.getByRole('columnheader', { name: new RegExp(name) })).toBeInTheDocument();
    }
  });

  it('affiche la date', () => {
    renderDialog();
    expect(screen.getByText('vendredi 28 novembre')).toBeInTheDocument();
  });

  it('se ferme avec la croix', async () => {
    const onClose = renderDialog();
    await userEvent.click(screen.getByRole('button', { name: 'Fermer' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('se ferme avec Échap', async () => {
    const onClose = renderDialog();
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
