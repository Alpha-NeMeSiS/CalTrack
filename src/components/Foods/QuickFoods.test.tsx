import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { QuickFoods } from './QuickFoods';
import type { QuickFood } from '../../utils/foodLibrary';

const item = (label: string, extra: Partial<QuickFood> = {}): QuickFood => ({
  key: label.toLowerCase(),
  label,
  food: { source: 'history', name: label, kcal_per_100g: 53, protein_g: 4, fat_g: 1.5, carbs_g: 5.5, fiber_g: 0 },
  usualQty: 125,
  ...extra,
});

const mealLabel = (meal: string) => ({ breakfast: 'Petit-déjeuner', snack: 'Collation' })[meal] ?? meal;

function setup(props: Partial<React.ComponentProps<typeof QuickFoods>> = {}) {
  const handlers = { onPick: vi.fn(), onQuickAdd: vi.fn(), onToggleFavorite: vi.fn() };
  render(<QuickFoods favorites={[]} recents={[]} loading={false} error={null} mealLabel={mealLabel} {...handlers} {...props} />);
  return handlers;
}

describe('QuickFoods', () => {
  it('liste favoris puis récents avec quantité, calories et repas habituels', () => {
    setup({
      favorites: [item('Yaourt nature', { favoriteId: 'fav-1', usualMeal: 'breakfast' })],
      recents: [item('Banane', { usualQty: 120 })],
    });

    const favorites = screen.getByRole('list', { name: 'Favoris' });
    // 53 kcal/100 g × 125 g ≈ 66 kcal
    expect(within(favorites).getByText('125 g · 66 kcal · Petit-déjeuner')).toBeInTheDocument();
    const recents = screen.getByRole('list', { name: 'Récents' });
    expect(within(recents).getByText('Banane')).toBeInTheDocument();
  });

  it('ajoute en un tap, sélectionne pour ajuster, et gère les favoris', async () => {
    const yaourt = item('Yaourt nature', { favoriteId: 'fav-1' });
    const banane = item('Banane');
    const { onPick, onQuickAdd, onToggleFavorite } = setup({ favorites: [yaourt], recents: [banane] });
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Ajouter « Yaourt nature » (125 g) au journal' }));
    expect(onQuickAdd).toHaveBeenCalledWith(yaourt);

    await user.click(screen.getByRole('button', { name: /^Banane/ }));
    expect(onPick).toHaveBeenCalledWith(banane);

    const star = screen.getByRole('button', { name: 'Ajouter « Banane » aux favoris' });
    expect(star).toHaveAttribute('aria-pressed', 'false');
    await user.click(star);
    expect(onToggleFavorite).toHaveBeenCalledWith(banane);
    expect(screen.getByRole('button', { name: 'Retirer « Yaourt nature » des favoris' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('message d’accueil sans historique, chargement et erreur', () => {
    const { rerender } = render(
      <QuickFoods favorites={[]} recents={[]} loading={false} error={null} mealLabel={mealLabel} onPick={vi.fn()} onQuickAdd={vi.fn()} onToggleFavorite={vi.fn()} />
    );
    expect(screen.getByText(/Vos aliments récents et favoris apparaîtront ici/)).toBeInTheDocument();

    rerender(
      <QuickFoods favorites={[]} recents={[]} loading error={null} mealLabel={mealLabel} onPick={vi.fn()} onQuickAdd={vi.fn()} onToggleFavorite={vi.fn()} />
    );
    expect(screen.getByText('Chargement de vos aliments…')).toBeInTheDocument();

    rerender(
      <QuickFoods
        favorites={[]}
        recents={[]}
        loading={false}
        error="Vos aliments récents n’ont pas pu être chargés."
        mealLabel={mealLabel}
        onPick={vi.fn()}
        onQuickAdd={vi.fn()}
        onToggleFavorite={vi.fn()}
      />
    );
    expect(screen.getByRole('alert')).toHaveTextContent('n’ont pas pu être chargés');
  });

  it('désactive les boutons pendant un ajout', () => {
    setup({ recents: [item('Banane')], disabled: true });
    expect(screen.getByRole('button', { name: 'Ajouter « Banane » (125 g) au journal' })).toBeDisabled();
  });
});
