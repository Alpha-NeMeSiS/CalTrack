import { render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GoalProgressCard } from './GoalProgressCard';
import { makeGoal } from '../../test/fixtures';

// Objectif de perte : 82 kg → 76 kg en 8 semaines, démarré le 1er janvier
const lossGoal = makeGoal({
  type: 'loss',
  target_weight_kg: 76,
  start_weight_kg: 82,
  duration_weeks: 8,
  start_date: '2025-01-01',
  end_date: '2025-02-26',
});

beforeEach(() => {
  // Date figée : 2 semaines après le début
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2025, 0, 15, 12));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('GoalProgressCard', () => {
  it("affiche l'évolution réelle depuis le poids de départ", () => {
    render(<GoalProgressCard goal={lossGoal} currentWeight={79} />);

    const section = screen.getByTestId('weight-progress');
    expect(within(section).getByText('Départ : 82 kg')).toBeInTheDocument();
    expect(within(section).getByText('Évolution : −3,0 kg · 50 %')).toBeInTheDocument();
    expect(within(section).getByText('Dans les temps')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Progression vers le poids cible' })).toHaveAttribute(
      'aria-valuenow',
      '50'
    );
    expect(screen.getByText('−3,0 kg')).toBeInTheDocument(); // reste à perdre
  });

  it('signale un retard sur le rythme prévu', () => {
    render(<GoalProgressCard goal={lossGoal} currentWeight={83} />);
    expect(screen.getByText('En retard sur le rythme prévu')).toBeInTheDocument();
  });

  it('signale un objectif atteint', () => {
    render(<GoalProgressCard goal={lossGoal} currentWeight={75.5} />);
    expect(screen.getByText('Objectif atteint')).toBeInTheDocument();
    expect(screen.getByText('0,0 kg')).toBeInTheDocument();
  });

  it("masque l'évolution du poids pour un ancien objectif sans poids de départ", () => {
    render(<GoalProgressCard goal={{ ...lossGoal, start_weight_kg: null }} currentWeight={79} />);

    expect(screen.getByText("Progression de l'objectif")).toBeInTheDocument();
    expect(screen.queryByTestId('weight-progress')).not.toBeInTheDocument();
  });

  it("ne s'affiche pas pour un maintien ou sans poids cible", () => {
    const { container, rerender } = render(
      <GoalProgressCard goal={{ ...lossGoal, type: 'maintain' }} currentWeight={79} />
    );
    expect(container).toBeEmptyDOMElement();

    rerender(<GoalProgressCard goal={{ ...lossGoal, target_weight_kg: null }} currentWeight={79} />);
    expect(container).toBeEmptyDOMElement();
  });
});
