import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProfilePage } from './ProfilePage';
import { getOperationArgs, supabaseMock } from '../../test/supabaseMock';
import { makeGoal, makeProfile } from '../../test/fixtures';

const refreshProfile = vi.fn();
const authValue = {
  user: { id: 'user-1' },
  profile: makeProfile({ email: 'eva@example.com', sexe: 'F', date_naissance: '1990-05-10', taille_cm: 165, poids_kg: 60 }),
  refreshProfile,
};
vi.mock('../../contexts/useAuth', () => ({ useAuth: () => authValue }));

vi.mock('../../lib/supabase', async () => {
  const { fakeSupabase } = await import('../../test/supabaseMock');
  return { supabase: fakeSupabase };
});

const fetchActiveGoal = vi.fn();
const upsertDailyTargetForGoal = vi.fn();
vi.mock('../../services/goals', () => ({
  fetchActiveGoal: (...args: unknown[]) => fetchActiveGoal(...args),
  upsertDailyTargetForGoal: (...args: unknown[]) => upsertDailyTargetForGoal(...args),
}));

const recordWeight = vi.fn();
vi.mock('../../services/weights', () => ({
  recordWeight: (...args: unknown[]) => recordWeight(...args),
  fetchWeightLogs: () => Promise.resolve([]),
}));

const goal = makeGoal({ activity_level: 1.55 });

beforeEach(() => {
  supabaseMock.reset();
  refreshProfile.mockReset();
  fetchActiveGoal.mockReset().mockResolvedValue(goal);
  upsertDailyTargetForGoal.mockReset().mockResolvedValue({});
  recordWeight.mockReset().mockResolvedValue(true);
});

const text = (element: HTMLElement) => (element.textContent ?? '').replace(/[\u202f\u00a0]/g, ' ');

describe('ProfilePage', () => {
  it('affiche identité et repères calculés', async () => {
    render(<ProfilePage />);

    expect(screen.getByRole('heading', { name: 'Mon profil' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Identité' })).toHaveTextContent('eva@example.com');

    const indicators = screen.getByRole('region', { name: 'Vos repères' });
    // IMC = 60 / 1,65² ≈ 22,0
    expect(text(indicators)).toContain('22,0');
    // Dépense estimée affichée une fois l'objectif chargé
    expect(await within(indicators).findByText(/Métabolisme de base × niveau/)).toBeInTheDocument();
  });

  it("n'a plus de champ poids : le poids passe par la pesée", () => {
    render(<ProfilePage />);
    expect(screen.queryByLabelText(/Poids actuel/)).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Ma pesée' })).toBeInTheDocument();
  });

  it('enregistre les données corporelles sans toucher au poids et recalcule la cible du jour', async () => {
    render(<ProfilePage />);
    const user = userEvent.setup();
    await screen.findByText(/Métabolisme de base × niveau/); // objectif chargé

    const height = screen.getByLabelText('Taille (cm)');
    await user.clear(height);
    await user.type(height, '168');
    await user.click(screen.getByRole('button', { name: 'Enregistrer les données' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Profil mis à jour');
    const [update] = supabaseMock.callsFor('profiles', 'update');
    const payload = getOperationArgs(update, 'update')?.[0] as Record<string, unknown>;
    expect(payload).toMatchObject({ taille_cm: 168, sexe: 'F', date_naissance: '1990-05-10' });
    expect(payload).not.toHaveProperty('poids_kg');
    expect(upsertDailyTargetForGoal).toHaveBeenCalledWith(
      'user-1',
      expect.any(String),
      expect.objectContaining({ taille_cm: 168, poids_kg: 60 }),
      goal
    );
    expect(refreshProfile).toHaveBeenCalled();
  });

  it('refuse des données invalides', async () => {
    render(<ProfilePage />);
    const user = userEvent.setup();

    const height = screen.getByLabelText('Taille (cm)');
    await user.clear(height);
    await user.type(height, '20');
    await user.click(screen.getByRole('button', { name: 'Enregistrer les données' }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(supabaseMock.callsFor('profiles', 'update')).toHaveLength(0);
  });

  it('enregistre une pesée et rafraîchit le profil', async () => {
    render(<ProfilePage />);
    const user = userEvent.setup();
    await screen.findByText(/Métabolisme de base × niveau/);

    await user.type(screen.getByLabelText("Poids aujourd'hui (kg)"), '59,4');
    await user.click(within(screen.getByRole('region', { name: 'Ma pesée' })).getByRole('button', { name: 'Enregistrer' }));

    expect(recordWeight).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user-1', weightKg: 59.4, goalForToday: goal }));
    await vi.waitFor(() => expect(refreshProfile).toHaveBeenCalled());
  });
});
