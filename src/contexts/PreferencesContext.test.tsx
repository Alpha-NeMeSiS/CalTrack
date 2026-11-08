import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PreferencesProvider } from './PreferencesContext';
import { usePreferences } from './usePreferences';
import { DEFAULT_PREFERENCES } from '../utils/preferences';

const authValue = { user: { id: 'user-1' } as { id: string } | null };
vi.mock('./useAuth', () => ({ useAuth: () => authValue }));

const fetchPreferences = vi.fn();
vi.mock('../services/preferences', () => ({
  fetchPreferences: (...args: unknown[]) => fetchPreferences(...args),
  savePreferences: vi.fn(),
}));

function Probe() {
  const { preferences } = usePreferences();
  return <span data-testid="display">{preferences.calorieDisplay}</span>;
}

beforeEach(() => {
  fetchPreferences.mockReset();
  authValue.user = { id: 'user-1' };
});

describe('PreferencesProvider', () => {
  it("charge les préférences de l'utilisateur connecté", async () => {
    fetchPreferences.mockResolvedValue({ ...DEFAULT_PREFERENCES, calorieDisplay: 'remaining' });
    render(<PreferencesProvider><Probe /></PreferencesProvider>);

    await waitFor(() => expect(screen.getByTestId('display')).toHaveTextContent('remaining'));
    expect(fetchPreferences).toHaveBeenCalledWith('user-1');
  });

  it('garde les valeurs par défaut si le chargement échoue', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    fetchPreferences.mockRejectedValue(new Error('réseau'));
    render(<PreferencesProvider><Probe /></PreferencesProvider>);

    await waitFor(() => expect(fetchPreferences).toHaveBeenCalled());
    expect(screen.getByTestId('display')).toHaveTextContent('consumed');
  });

  it('ne charge rien sans utilisateur connecté', () => {
    authValue.user = null;
    render(<PreferencesProvider><Probe /></PreferencesProvider>);
    expect(fetchPreferences).not.toHaveBeenCalled();
    expect(screen.getByTestId('display')).toHaveTextContent('consumed');
  });
});
