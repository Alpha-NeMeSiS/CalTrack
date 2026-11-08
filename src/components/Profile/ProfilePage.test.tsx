import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProfilePage } from './ProfilePage';
import { getOperationArgs, supabaseMock } from '../../test/supabaseMock';
import { makeGoal, makeProfile } from '../../test/fixtures';

const refreshProfile = vi.fn();
const baseProfile = makeProfile({ email: 'eva@example.com', sexe: 'F', date_naissance: '1990-05-10', taille_cm: 165, poids_kg: 60 });
const authValue = {
  user: { id: 'user-1' },
  profile: baseProfile,
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
  authValue.profile = baseProfile;
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

  it('enregistre les mesures détaillées facultatives et les utilise pour la cible du jour', async () => {
    render(<ProfilePage />);
    const user = userEvent.setup();
    await screen.findByText(/Métabolisme de base × niveau/);

    await user.click(screen.getByText('Mesures détaillées'));
    await user.type(screen.getByLabelText('Masse musculaire (kg)'), '42.5');
    await user.type(screen.getByLabelText('Masse osseuse (kg)'), '2.3');
    await user.type(screen.getByLabelText('Graisse viscérale (indice)'), '5');
    await user.click(screen.getByRole('button', { name: 'Enregistrer les données' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Profil mis à jour');
    const [update] = supabaseMock.callsFor('profiles', 'update');
    const payload = getOperationArgs(update, 'update')?.[0] as Record<string, unknown>;
    // Les mesures laissées vides sont enregistrées à NULL
    expect(payload).toMatchObject({ muscle_mass_kg: 42.5, bone_mass_kg: 2.3, visceral_fat_rating: 5, body_water_pct: null });
    expect(upsertDailyTargetForGoal).toHaveBeenCalledWith(
      'user-1',
      expect.any(String),
      expect.objectContaining({ muscle_mass_kg: 42.5, bone_mass_kg: 2.3, poids_kg: 60 }),
      goal
    );
  });

  it('refuse une mesure détaillée invraisemblable', async () => {
    render(<ProfilePage />);
    const user = userEvent.setup();

    await user.click(screen.getByText('Mesures détaillées'));
    await user.type(screen.getByLabelText('Eau corporelle (%)'), '95');
    await user.click(screen.getByRole('button', { name: 'Enregistrer les données' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Le taux d’eau doit être compris entre 30 et 80 %.');
    expect(supabaseMock.callsFor('profiles', 'update')).toHaveLength(0);
  });

  it('repères : masse maigre et formule utilisée selon les mesures', async () => {
    authValue.profile = makeProfile({
      ...baseProfile,
      muscle_mass_kg: 42.5,
      bone_mass_kg: 2.3,
      visceral_fat_rating: 5,
    });
    render(<ProfilePage />);

    const indicators = screen.getByRole('region', { name: 'Vos repères' });
    expect(text(indicators)).toContain('44,8 kg');
    expect(indicators).toHaveTextContent('Masse musculaire + masse osseuse');
    expect(indicators).toHaveTextContent('Katch-McArdle');
    // 370 + 21,6 × 44,8 ≈ 1 338 kcal
    expect(text(indicators)).toContain('1 338 kcal/j');
    expect(indicators).toHaveTextContent('Graisse viscérale');
    // Mesures déjà saisies : la section détaillée est ouverte
    expect(screen.getByLabelText('Masse musculaire (kg)')).toHaveValue(42.5);
  });

  it('repères : sans mesure, Mifflin-St Jeor et invitation à compléter', () => {
    render(<ProfilePage />);

    const indicators = screen.getByRole('region', { name: 'Vos repères' });
    expect(indicators).toHaveTextContent('Mifflin-St Jeor');
    expect(indicators).toHaveTextContent('Ajoutez une mesure détaillée');
    expect(indicators).not.toHaveTextContent('Graisse viscérale');
  });

  it('reprend la composition enregistrée avec une pesée (pas d’écrasement par d’anciennes valeurs)', () => {
    const { rerender } = render(<ProfilePage />);
    expect(screen.getByLabelText('Masse musculaire (kg)')).toHaveValue(null);

    // Profil rafraîchi après une pesée avec composition
    authValue.profile = makeProfile({ ...baseProfile, muscle_mass_kg: 43.1, body_fat_pct: 24.5 });
    rerender(<ProfilePage />);

    expect(screen.getByLabelText('Masse musculaire (kg)')).toHaveValue(43.1);
    expect(screen.getByLabelText('Masse grasse (%, optionnel)')).toHaveValue(24.5);
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
