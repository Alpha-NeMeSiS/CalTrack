import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GoalPage } from './GoalPage';
import { makeGoal, makeProfile } from '../../test/fixtures';
import type { Goal } from '../../lib/supabase';

const authValue = { user: { id: 'user-1' }, profile: makeProfile({ poids_kg: 80, taille_cm: 178, sexe: 'M' }) };
vi.mock('../../contexts/useAuth', () => ({ useAuth: () => authValue }));

const fetchUserGoals = vi.fn<[string], Promise<Goal[]>>();
const activateNewGoal = vi.fn();
vi.mock('../../services/goals', () => ({
  fetchUserGoals: (userId: string) => fetchUserGoals(userId),
  activateNewGoal: (...args: unknown[]) => activateNewGoal(...args),
}));

beforeEach(() => {
  fetchUserGoals.mockReset();
  activateNewGoal.mockReset();
});

const lossGoal = makeGoal({
  id: 'current',
  type: 'loss',
  is_active: true,
  start_date: '2099-01-01',
  end_date: '2099-03-26',
  deficit_or_surplus_pct: 20,
  target_weight_kg: 74,
  duration_weeks: 12,
  start_weight_kg: 82,
  activity_level: 1.55,
});

describe('GoalPage', () => {
  it("résume l'objectif actuel et liste l'historique", async () => {
    const old = makeGoal({ id: 'old', type: 'maintain', is_active: false, start_date: '2098-06-01', end_date: null, created_at: '2098-06-01T08:00:00Z' });
    fetchUserGoals.mockResolvedValue([lossGoal, old]);

    render(<GoalPage />);

    const current = await screen.findByRole('region', { name: 'Objectif actuel' });
    expect(current).toHaveTextContent('Perte de poids');
    expect(current).toHaveTextContent('En cours');
    expect(current).toHaveTextContent('Déficit20 %');
    expect(current).toHaveTextContent('Poids cible74 kg');

    const history = screen.getByRole('region', { name: 'Historique' });
    expect(within(history).getByText('Maintien')).toBeInTheDocument();
    expect(history).toHaveTextContent('au 31 décembre 2098 (remplacé)');

    expect(screen.getByRole('heading', { name: "Modifier l'objectif" })).toBeInTheDocument();
    // Le formulaire est pré-rempli avec l'objectif actuel
    expect(screen.getByRole('button', { name: 'Perte' })).toHaveAttribute('aria-pressed', 'true');
  });

  it("propose d'en définir un quand il n'y a aucun objectif", async () => {
    fetchUserGoals.mockResolvedValue([]);
    render(<GoalPage />);

    expect(await screen.findByRole('heading', { name: 'Définir un objectif' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Objectif actuel' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Historique' })).not.toBeInTheDocument();
  });

  it('enregistre un nouvel objectif puis recharge la page', async () => {
    fetchUserGoals.mockResolvedValue([]);
    activateNewGoal.mockResolvedValue(undefined);
    render(<GoalPage />);
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Prise' }));
    await user.selectOptions(screen.getByLabelText("Niveau d'activité"), '1.375');
    await user.click(screen.getByRole('button', { name: "Enregistrer l'objectif" }));

    expect(activateNewGoal).toHaveBeenCalledWith(
      'user-1',
      authValue.profile,
      expect.objectContaining({ type: 'gain', activity_level: 1.375 }),
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/)
    );
    expect(await screen.findByRole('status')).toHaveTextContent('Objectif enregistré');
    expect(fetchUserGoals).toHaveBeenCalledTimes(2);
  });

  it("affiche l'erreur de validation sans rien enregistrer", async () => {
    fetchUserGoals.mockResolvedValue([]);
    render(<GoalPage />);
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Perte' }));
    // Poids cible au-dessus du poids actuel pour une perte
    await user.type(screen.getByLabelText('Poids cible (kg)'), '90');
    await user.click(screen.getByRole('button', { name: "Enregistrer l'objectif" }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(activateNewGoal).not.toHaveBeenCalled();
  });

  it('signale une erreur de chargement et permet de réessayer', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    fetchUserGoals.mockRejectedValueOnce(new Error('réseau')).mockResolvedValueOnce([lossGoal]);
    render(<GoalPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Impossible de charger vos objectifs');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(await screen.findByRole('region', { name: 'Objectif actuel' })).toBeInTheDocument();
  });
});
