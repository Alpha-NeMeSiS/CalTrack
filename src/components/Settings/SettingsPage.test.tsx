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
    renderPage({ calorieDisplay: 'remaining', macroDisplay: 'percent', mealLabels: { snack: 'Goûter' }, hiddenMeals: ['dinner'] });

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

    expect(savePreferences).toHaveBeenCalledWith({
      calorieDisplay: 'remaining',
      macroDisplay: 'percent',
      mealLabels: { snack: 'Collation du matin' },
      hiddenMeals: ['dinner'],
    });
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
    renderPage({ calorieDisplay: 'remaining', macroDisplay: 'percent', mealLabels: { snack: 'Goûter' }, hiddenMeals: [] });
    await userEvent.setup().click(screen.getByRole('button', { name: 'Valeurs par défaut' }));

    expect(screen.getByRole('radio', { name: /Consommées \/ objectif/ })).toBeChecked();
    expect(screen.getByLabelText('Nom du repas « Collation »')).toHaveValue('');
    expect(savePreferences).not.toHaveBeenCalled();
  });
});
