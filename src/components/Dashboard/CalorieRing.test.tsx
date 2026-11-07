import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CalorieRing } from './CalorieRing';

describe('CalorieRing', () => {
  it('affiche les kcal restantes sous l’objectif', () => {
    render(<CalorieRing consumed={1500} target={2000} status="under" />);
    expect(screen.getByText("Sous l'objectif")).toBeInTheDocument();
    expect(screen.getByText('Encore 500 kcal')).toBeInTheDocument();
  });

  it('affiche le dépassement', () => {
    render(<CalorieRing consumed={2300} target={2000} status="over" />);
    expect(screen.getByText('Au-dessus')).toBeInTheDocument();
    expect(screen.getByText('+300 kcal')).toBeInTheDocument();
  });

  it('félicite quand l’objectif est atteint', () => {
    render(<CalorieRing consumed={2000} target={2000} status="ok" />);
    expect(screen.getByText('Objectif atteint')).toBeInTheDocument();
    expect(screen.getByText('Parfait !')).toBeInTheDocument();
  });

  it('ne produit pas de NaN avec une cible à 0', () => {
    const { container } = render(<CalorieRing consumed={0} target={0} status="ok" />);
    const progressCircle = container.querySelectorAll('circle')[1];
    expect(progressCircle.getAttribute('stroke-dashoffset')).not.toBe('NaN');
  });
});
