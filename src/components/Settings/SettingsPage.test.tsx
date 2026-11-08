import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsPage } from './SettingsPage';
import { PreferencesContext } from '../../contexts/preferencesContextValue';
import { DEFAULT_PREFERENCES, UserPreferences } from '../../utils/preferences';

const savePreferences = vi.fn();

// Notifications : indisponibles par défaut (jsdom), activables dans certains tests
const push = vi.hoisted(() => ({ state: 'unsupported' as string, enable: vi.fn() }));
vi.mock('../../contexts/useAuth', () => ({
  useAuth: () => ({ profile: { poids_kg: 79 } }),
}));

vi.mock('../../lib/push', () => ({
  getPushDeviceState: () => Promise.resolve(push.state),
  enablePushOnThisDevice: () => push.enable(),
  disablePushOnThisDevice: vi.fn(),
  sendTestNotification: vi.fn(),
}));

function renderPage(preferences: UserPreferences = DEFAULT_PREFERENCES) {
  return render(
    <PreferencesContext.Provider value={{ preferences, savePreferences }}>
      <SettingsPage />
    </PreferencesContext.Provider>
  );
}

beforeEach(() => {
  savePreferences.mockReset().mockResolvedValue(undefined);
  push.state = 'unsupported';
  push.enable.mockReset().mockImplementation(async () => {
    push.state = 'enabled';
  });
});

describe('SettingsPage', () => {
  it('reprend les préférences actuelles', () => {
    renderPage({ ...DEFAULT_PREFERENCES, theme: 'dark', calorieDisplay: 'remaining', macroDisplay: 'percent', mealLabels: { snack: 'Goûter' }, hiddenMeals: ['dinner'] });

    expect(screen.getByRole('radio', { name: /Calories restantes/ })).toBeChecked();
    expect(screen.getByRole('radio', { name: /En % de l’objectif/ })).toBeChecked();
    expect(screen.getByLabelText('Nom du repas « Collation »')).toHaveValue('Goûter');
    expect(screen.getByRole('checkbox', { name: 'Afficher « Dîner »' })).not.toBeChecked();
    expect(screen.getByLabelText('Nom du repas « Dîner »')).toBeDisabled();
  });

  it('enregistre les choix', async () => {
    renderPage();
    const user = userEvent.setup();

    await user.click(screen.getByRole('radio', { name: /Calories restantes/ }));
    await user.click(screen.getByRole('radio', { name: /En % de l’objectif/ }));
    await user.type(screen.getByLabelText('Nom du repas « Collation »'), 'Collation du matin');
    await user.click(screen.getByRole('checkbox', { name: 'Afficher « Dîner »' }));
    await user.click(screen.getByRole('button', { name: 'Enregistrer les paramètres' }));

    expect(savePreferences).toHaveBeenCalledWith(
      expect.objectContaining({
        theme: 'system',
        calorieDisplay: 'remaining',
        macroDisplay: 'percent',
        mealLabels: { snack: 'Collation du matin' },
        hiddenMeals: ['dinner'],
        reminderWeighInTime: null,
        reminderLogTime: null,
        // Fuseau horaire de l'appareil enregistré avec les rappels
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      })
    );
    expect(await screen.findByRole('status')).toHaveTextContent('Paramètres enregistrés');
  });

  it('garde toujours au moins un repas visible', async () => {
    renderPage({ ...DEFAULT_PREFERENCES, hiddenMeals: ['breakfast', 'lunch', 'dinner'] });
    expect(screen.getByRole('checkbox', { name: 'Afficher « Collation »' })).toBeDisabled();
  });

  it('signale un échec d’enregistrement', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    savePreferences.mockRejectedValue(new Error('réseau'));
    renderPage();

    await userEvent.setup().click(screen.getByRole('button', { name: 'Enregistrer les paramètres' }));
    expect(await screen.findByRole('alert')).toHaveTextContent("n'ont pas pu être enregistrés");
  });

  it('remet les valeurs par défaut dans le formulaire', async () => {
    renderPage({ ...DEFAULT_PREFERENCES, theme: 'dark', calorieDisplay: 'remaining', macroDisplay: 'percent', mealLabels: { snack: 'Goûter' }, hiddenMeals: [] });
    await userEvent.setup().click(screen.getByRole('button', { name: 'Valeurs par défaut' }));

    expect(screen.getByRole('radio', { name: /Consommées \/ objectif/ })).toBeChecked();
    expect(screen.getByLabelText('Nom du repas « Collation »')).toHaveValue('');
    expect(savePreferences).not.toHaveBeenCalled();
  });

  it('prévisualise le thème choisi et le rétablit en quittant sans enregistrer', async () => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
    const { unmount } = renderPage({ ...DEFAULT_PREFERENCES, theme: 'light' });

    await userEvent.setup().click(screen.getByRole('radio', { name: /Sombre/ }));
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    unmount();
    // Rien n'a été enregistré : le thème mémorisé (automatique, appareil clair) revient
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('enregistre le thème avec les autres paramètres', async () => {
    renderPage();
    const user = userEvent.setup();
    await user.click(screen.getByRole('radio', { name: /Sombre/ }));
    await user.click(screen.getByRole('button', { name: 'Enregistrer les paramètres' }));

    expect(savePreferences).toHaveBeenCalledWith(expect.objectContaining({ theme: 'dark' }));
  });

  it("programme les deux rappels par défaut à l'activation des notifications", async () => {
    push.state = 'disabled';
    renderPage();

    await userEvent.setup().click(await screen.findByRole('button', { name: 'Activer les notifications sur cet appareil' }));

    expect(savePreferences).toHaveBeenCalledWith(
      expect.objectContaining({ reminderWeighInTime: '08:00', reminderLogTime: '20:30' })
    );
    expect(await screen.findByText(/Rappels programmés : pesée à 08:00 et journal à 20:30/)).toBeInTheDocument();
  });

  it("garde l'heure déjà cochée (non enregistrée) plutôt que les heures par défaut", async () => {
    push.state = 'disabled';
    renderPage();
    const user = userEvent.setup();

    await user.click(screen.getByRole('checkbox', { name: /Rappel du journal/ }));
    await user.click(await screen.findByRole('button', { name: 'Activer les notifications sur cet appareil' }));

    expect(savePreferences).toHaveBeenCalledWith(
      expect.objectContaining({ reminderWeighInTime: null, reminderLogTime: '20:30' })
    );
  });

  it("ne reprogramme rien si des rappels sont déjà enregistrés", async () => {
    push.state = 'disabled';
    renderPage({ ...DEFAULT_PREFERENCES, reminderWeighInTime: '07:15' });

    await userEvent.setup().click(await screen.findByRole('button', { name: 'Activer les notifications sur cet appareil' }));

    expect(await screen.findByText('Notifications activées sur cet appareil.')).toBeInTheDocument();
    expect(savePreferences).not.toHaveBeenCalled();
  });

  it("conserve les modifications non enregistrées quand les rappels sont enregistrés à part", async () => {
    const { rerender } = renderPage();
    const user = userEvent.setup();
    await user.click(screen.getByRole('radio', { name: /Calories restantes/ }));

    // Les rappels viennent d'être enregistrés (activation des notifications)
    rerender(
      <PreferencesContext.Provider
        value={{ preferences: { ...DEFAULT_PREFERENCES, reminderWeighInTime: '08:00', reminderLogTime: '20:30' }, savePreferences }}
      >
        <SettingsPage />
      </PreferencesContext.Provider>
    );

    expect(screen.getByRole('radio', { name: /Calories restantes/ })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Rappel de pesée/ })).toBeChecked();
    expect(screen.getByLabelText('Heure — Rappel du journal')).toHaveValue('20:30');
  });

  describe('objectif d’eau', () => {
    it('propose l’objectif automatique d’après le poids', () => {
      renderPage();
      expect(screen.getByRole('radio', { name: /Automatique : 2,4 L/ })).toBeChecked();
      expect(screen.getByText('30 ml par kg × 79 kg, suit vos pesées')).toBeInTheDocument();
    });

    it('enregistre un objectif personnalisé (virgule acceptée)', async () => {
      renderPage();
      const user = userEvent.setup();
      await user.click(screen.getByRole('radio', { name: /Personnalisé/ }));
      const field = screen.getByLabelText('Objectif (L)');
      await user.clear(field);
      await user.type(field, '2,5');
      await user.click(screen.getByRole('button', { name: /Enregistrer/ }));
      expect(savePreferences).toHaveBeenCalledWith(expect.objectContaining({ waterGoalMl: 2500 }));
    });

    it('refuse un objectif hors limites', async () => {
      renderPage();
      const user = userEvent.setup();
      await user.click(screen.getByRole('radio', { name: /Personnalisé/ }));
      const field = screen.getByLabelText('Objectif (L)');
      await user.clear(field);
      await user.type(field, '0,3');
      await user.click(screen.getByRole('button', { name: /Enregistrer/ }));
      expect(await screen.findByText(/L’objectif d’eau doit être compris entre 0,5 et 6 L\./)).toBeInTheDocument();
      expect(savePreferences).not.toHaveBeenCalled();
    });

    it('revient à l’objectif automatique', async () => {
      renderPage({ ...DEFAULT_PREFERENCES, waterGoalMl: 3000 });
      const user = userEvent.setup();
      expect(screen.getByLabelText('Objectif (L)')).toHaveValue('3');
      await user.click(screen.getByRole('radio', { name: /Automatique : 2,4 L/ }));
      await user.click(screen.getByRole('button', { name: /Enregistrer/ }));
      expect(savePreferences).toHaveBeenCalledWith(expect.objectContaining({ waterGoalMl: null }));
    });
  });
});
