import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CalorieAdjustmentCard } from './CalorieAdjustmentCard';
import { makeGoal } from '../../test/fixtures';
import { CalorieAdjustmentSuggestion, dismissKey } from '../../utils/calorieAdjustment';
import type { Goal } from '../../lib/supabase';

const applyCalorieAdjustment = vi.hoisted(() => vi.fn());
vi.mock('../../services/goals', () => ({ applyCalorieAdjustment }));

const profile = { sexe: 'M' as const, date_naissance: '1995-01-01', taille_cm: 178, poids_kg: 80 };
const goal = makeGoal({ id: 'goal-1', type: 'loss' }) as Goal;

const suggestion: CalorieAdjustmentSuggestion = {
  direction: 'more',
  currentTargetKcal: 2150,
  proposedTargetKcal: 2300,
  deltaKcal: 150,
  newAdjustmentKcal: 150,
  expenditureKcal: 2870,
  weeklyChangeKg: -0.9,
};

const text = (element: HTMLElement) => (element.textContent ?? '').replace(/[\u202f\u00a0]/g, ' ');

function setup(props: Partial<React.ComponentProps<typeof CalorieAdjustmentCard>> = {}) {
  const onApplied = vi.fn();
  render(
    <CalorieAdjustmentCard
      userId="user-1"
      profile={profile}
      goal={goal}
      suggestion={suggestion}
      today="2026-11-08"
      onApplied={onApplied}
      {...props}
    />
  );
  return { onApplied, user: userEvent.setup() };
}

beforeEach(() => {
  localStorage.clear();
  applyCalorieAdjustment.mockReset().mockResolvedValue({ ...goal, calorie_adjustment_kcal: 150 });
});

describe('CalorieAdjustmentCard', () => {
  it('explique la proposition : perte plus rapide que prévu, cible actuelle et proposée', () => {
    setup();
    const card = screen.getByRole('region', { name: 'Ajuster vos calories ?' });
    expect(text(card)).toContain('Vous perdez plus vite que prévu (−0,9 kg/semaine)');
    expect(text(card)).toContain('≈ 2 870 kcal/j');
    expect(text(card)).toContain('2 150 kcal/j → 2 300 kcal/j (+150 kcal)');
  });

  it('formule adaptée à une perte plus lente que prévu', () => {
    setup({ suggestion: { ...suggestion, direction: 'less', deltaKcal: -120, proposedTargetKcal: 2030, weeklyChangeKg: -0.1 } });
    expect(text(screen.getByRole('region'))).toContain('Votre perte est plus lente que prévu (−0,1 kg/semaine)');
    expect(text(screen.getByRole('region'))).toContain('(−120 kcal)');
  });

  it('applique l’ajustement et prévient l’utilisateur', async () => {
    const { onApplied, user } = setup();

    await user.click(screen.getByRole('button', { name: 'Appliquer' }));

    expect(applyCalorieAdjustment).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', goal, adjustmentKcal: 150, profile, today: '2026-11-08' })
    );
    expect(onApplied).toHaveBeenCalledWith({ ...goal, calorie_adjustment_kcal: 150 });
    expect(await screen.findByRole('status')).toHaveTextContent('Objectif ajusté : 2 300 kcal/j dès aujourd’hui');
  });

  it('« Pas maintenant » masque la proposition pendant une semaine', async () => {
    const { user } = setup();

    await user.click(screen.getByRole('button', { name: 'Pas maintenant' }));

    expect(screen.queryByRole('region')).not.toBeInTheDocument();
    expect(localStorage.getItem(dismissKey('goal-1'))).toBe('2026-11-08');
  });

  it('reste masquée si elle a été écartée il y a moins de 7 jours', () => {
    localStorage.setItem(dismissKey('goal-1'), '2026-11-03');
    setup();
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
  });

  it('signale un échec sans masquer la proposition', async () => {
    applyCalorieAdjustment.mockRejectedValue(new Error('réseau'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { user, onApplied } = setup();

    await user.click(screen.getByRole('button', { name: 'Appliquer' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('n’a pas pu être appliqué');
    expect(onApplied).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Appliquer' })).toBeEnabled();
  });
});
