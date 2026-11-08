import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsPage } from './SettingsPage';
import { PreferencesContext } from '../../contexts/preferencesContextValue';
import { DEFAULT_PREFERENCES, UserPreferences } from '../../utils/preferences';

const savePreferences = vi.fn();

function renderPage(preferences: UserPreferences = DEFAULT_PREFERENCES) {
  return render(
    <PreferencesContext.Provider value={{ preferences, savePreferences }}>
      <SettingsPage />
    </PreferencesContext.Provider>
  );
}

beforeEach(() => {
  savePreferences.mockReset().mockResolvedValue(undefined);
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
});

