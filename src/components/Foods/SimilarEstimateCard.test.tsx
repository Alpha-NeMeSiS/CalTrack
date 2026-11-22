import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { NormalizedFood } from '../../types/food';
import { estimateFromSimilar, RankedProduct } from '../../lib/similarProducts';
import { SimilarEstimateCard } from './SimilarEstimateCard';

function off(name: string, brand: string, [kcal, protein, fat, carbs]: [number, number, number, number]): NormalizedFood {
  return { source: 'off', name, brand, offCode: name, kcal_per_100g: kcal, protein_g: protein, fat_g: fat, carbs_g: carbs, fiber_g: 0 };
}

const RANKED: RankedProduct[] = [
  { food: off('Pasta Box fusilli à la bolognaise', 'Sodebo', [123, 6.7, 3, 16]), score: 1.25, sameBrand: true },
  { food: off('Pastabox fusilli carbonara', 'Sodebo', [160, 5.8, 7.6, 17]), score: 0.92, sameBrand: true },
  { food: off('Pastabox fusilli napolitaine au poulet', 'Sodebo', [123, 6.6, 2.8, 17]), score: 0.92, sameBrand: true },
  { food: off('Pastabox fusilli aux fromages italiens', 'Sodebo', [176, 6.6, 8.5, 17]), score: 0.92, sameBrand: true },
  { food: off('PastaBOX Fusilli Jambon Champignons', 'Sodebo, PastaBOX', [147, 6.6999998, 4.8, 18.4]), score: 0.92, sameBrand: true },
  { food: off('Box fusilli bolognaise', 'Belle France', [144, 6.3, 5.2, 17]), score: 0.67, sameBrand: false },
];

function setup(ranked = RANKED) {
  const onUse = vi.fn();
  const onManual = vi.fn();
  const user = userEvent.setup();
  render(<SimilarEstimateCard estimate={estimateFromSimilar(ranked)!} onUse={onUse} onManual={onManual} />);
  return { user, onUse, onManual, card: screen.getByRole('region', { name: 'Estimation pour 100 g' }) };
}

describe('SimilarEstimateCard', () => {
  it('présente l’estimation, sa proximité et sa source', () => {
    const { card } = setup();
    expect(within(card).getByText('D’après le produit le plus proche')).toBeInTheDocument();
    expect(within(card).getByText('Même marque')).toBeInTheDocument();
    expect(card).toHaveTextContent('≈ 123 kcal');
    expect(within(card).getByText('Protéines 6,7 g · Lipides 3 g · Glucides 16 g')).toBeInTheDocument();
    expect(
      within(card).getByText('Pasta Box fusilli à la bolognaise (Sodebo). À vérifier avec l’étiquette si vous l’avez.')
    ).toBeInTheDocument();
  });

  it('utilise l’estimation ou ouvre la saisie de l’étiquette', async () => {
    const { user, onUse, onManual } = setup();
    await user.click(screen.getByRole('button', { name: 'Utiliser l’estimation' }));
    expect(onUse).toHaveBeenCalledWith(
      { kcal_per_100g: 123, protein_g: 6.7, fat_g: 3, carbs_g: 16, fiber_g: 0 },
      '1 produit proche : Pasta Box fusilli à la bolognaise (Sodebo)'
    );
    await user.click(screen.getByRole('button', { name: 'Saisir l’étiquette' }));
    expect(onManual).toHaveBeenCalled();
  });

  it('déplie la liste des produits proches et en utilise un', async () => {
    const { user, onUse } = setup();
    const toggle = screen.getByRole('button', { name: 'Ou choisir un produit proche (5)' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('list')).not.toBeInTheDocument();

    await user.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(within(screen.getByRole('list')).getAllByRole('listitem')).toHaveLength(5);
    expect(screen.getByText('Sodebo · 160 kcal · P 5,8 · L 7,6 · G 17')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Utiliser les valeurs de « Pastabox fusilli carbonara »' }));
    expect(onUse).toHaveBeenCalledWith(
      { kcal_per_100g: 160, protein_g: 5.8, fat_g: 7.6, carbs_g: 17, fiber_g: 0 },
      '1 produit proche : Pastabox fusilli carbonara (Sodebo)'
    );

    // Valeurs d'Open Food Facts arrondies au dixième
    await user.click(screen.getByRole('button', { name: 'Utiliser les valeurs de « PastaBOX Fusilli Jambon Champignons »' }));
    expect(onUse).toHaveBeenLastCalledWith(
      { kcal_per_100g: 147, protein_g: 6.7, fat_g: 4.8, carbs_g: 18.4, fiber_g: 0 },
      '1 produit proche : PastaBOX Fusilli Jambon Champignons (Sodebo)'
    );
  });

  it('signale des produits d’autres marques', () => {
    const { card } = setup([RANKED[5]]);
    expect(within(card).getByText('Autres marques')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ou choisir un produit proche (1)' })).toBeInTheDocument();
  });
});
