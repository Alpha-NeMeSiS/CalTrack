import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { WeightChart } from './WeightChart';

const points = [
  { date: '2025-01-01', weight_kg: 82 },
  { date: '2025-01-15', weight_kg: 80.6 },
  { date: '2025-01-29', weight_kg: 79.4 },
];

describe('WeightChart', () => {
  it('invite à saisir des pesées tant qu’il y en a moins de deux', () => {
    render(<WeightChart points={[points[0]]} />);
    expect(screen.getByText(/Enregistrez au moins deux pesées/)).toBeInTheDocument();
  });

  it('décrit la courbe et l’évolution', () => {
    render(<WeightChart points={points} targetWeight={76} />);

    expect(screen.getByRole('img')).toHaveAccessibleName('Poids passé de 82,0 kg le 1 janv. à 79,4 kg le 29 janv.');
    expect(screen.getByTestId('weight-change')).toHaveTextContent('-2,6 kg depuis le 1 janv.');
    expect(screen.getByText('Cible 76,0 kg')).toBeInTheDocument();
    expect(document.querySelectorAll('circle')).toHaveLength(3);
  });

  it('dessine en point creux une pesée plus tard hors suivi, avec sa légende', () => {
    render(
      <WeightChart
        points={[
          { date: '2025-01-20', weight_kg: 80, moment: 'morning' },
          { date: '2025-01-21', weight_kg: 82, moment: 'later' },
          { date: '2025-01-22', weight_kg: 79.8, moment: 'morning' },
        ]}
      />
    );

    expect(document.querySelectorAll('circle')).toHaveLength(3);
    expect(screen.getByText('21 janv. : 82,0 kg, plus tard (hors suivi)')).toBeInTheDocument();
    expect(screen.getByText('Plus tard, hors suivi')).toBeInTheDocument();
    // La moyenne ne passe que par les deux pesées du matin
    expect(document.querySelector('path')?.getAttribute('d')?.split('L')).toHaveLength(2);
  });

  it('pas de légende « hors suivi » quand toutes les pesées comptent', () => {
    render(<WeightChart points={points} />);
    expect(screen.queryByText('Plus tard, hors suivi')).not.toBeInTheDocument();
  });
});
