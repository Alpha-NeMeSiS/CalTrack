import { render, screen, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PreferencesProvider } from './PreferencesContext';
import { usePreferences } from './usePreferences';
import { DEFAULT_PREFERENCES } from '../utils/preferences';
import { APP_VERSION } from '../utils/appInfo';

const authValue = { user: { id: 'user-1' } as { id: string } | null };
vi.mock('./useAuth', () => ({ useAuth: () => authValue }));

const fetchPreferences = vi.fn();
const markTourCompleted = vi.fn();
const markVersionSeen = vi.fn();
vi.mock('../services/preferences', () => ({
  fetchPreferences: (...args: unknown[]) => fetchPreferences(...args),
  savePreferences: vi.fn(),
  markTourCompleted: (...args: unknown[]) => markTourCompleted(...args),
  markVersionSeen: (...args: unknown[]) => markVersionSeen(...args),
}));

function Probe() {
  const { preferences } = usePreferences();
  return <span data-testid="display">{preferences.calorieDisplay}</span>;
}

function StatusProbe() {
  const { status, preferences, markTourCompleted: markTour, markVersionSeen: markVersion } = usePreferences();
  return (
    <div>
      <span data-testid="status">{status}</span>
      <span data-testid="tour">{preferences.tourCompletedAt ?? 'non'}</span>
      <span data-testid="seen">{preferences.lastSeenVersion ?? 'aucune'}</span>
      <button type="button" onClick={() => markTour()}>Visite finie</button>
      <button type="button" onClick={() => markVersion('2.1.0')}>Version vue</button>
    </div>
  );
}

beforeEach(() => {
  markTourCompleted.mockReset();
  markVersionSeen.mockReset();
  fetchPreferences.mockReset();
  authValue.user = { id: 'user-1' };
  localStorage.clear();
  document.documentElement.classList.remove('dark');
});

describe('PreferencesProvider : état et visite', () => {
  it('passe de « loading » à « ready » quand aucune préférence n’existe', async () => {
    let resolve: (value: null) => void = () => {};
    fetchPreferences.mockReturnValue(new Promise((r) => { resolve = r; }));
    render(<PreferencesProvider><StatusProbe /></PreferencesProvider>);
    expect(screen.getByTestId('status')).toHaveTextContent('loading');
    resolve(null);
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('ready'));
  });

  it('n’annonce jamais « ready » avec les préférences d’un autre compte (connexion en cours)', async () => {
    // Un composant enfant lit l'état dans son effet, avant celui du fournisseur
    const seen: string[] = [];
    function EffectProbe() {
      const { status, preferences } = usePreferences();
      useEffect(() => {
        seen.push(`${authValue.user?.id ?? 'aucun'}:${status}:${preferences.tourCompletedAt ?? 'non'}`);
      });
      return null;
    }
    authValue.user = null;
    fetchPreferences.mockResolvedValue({ ...DEFAULT_PREFERENCES, tourCompletedAt: '2026-11-01T08:00:00Z' });
    const { rerender } = render(<PreferencesProvider><EffectProbe /></PreferencesProvider>);

    authValue.user = { id: 'user-1' };
    rerender(<PreferencesProvider><EffectProbe /></PreferencesProvider>);
    await waitFor(() => expect(seen).toContain('user-1:ready:2026-11-01T08:00:00Z'));
    // Jamais « prêt » avec les valeurs par défaut (visite non vue) pour ce compte
    expect(seen).not.toContain('user-1:ready:non');
  });

  it('passe à « error » si la lecture échoue', async () => {
    fetchPreferences.mockRejectedValue(new Error('réseau'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<PreferencesProvider><StatusProbe /></PreferencesProvider>);
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('error'));
  });

  it('enregistre la fin de la visite avec la version de l’app, puis la version vue', async () => {
    fetchPreferences.mockResolvedValue(null);
    markTourCompleted.mockResolvedValue('2026-11-22T10:00:00.000Z');
    markVersionSeen.mockResolvedValue(undefined);
    render(<PreferencesProvider><StatusProbe /></PreferencesProvider>);
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('ready'));

    screen.getByRole('button', { name: 'Visite finie' }).click();
    await waitFor(() => expect(screen.getByTestId('tour')).toHaveTextContent('2026-11-22T10:00:00.000Z'));
    expect(markTourCompleted).toHaveBeenCalledWith('user-1', APP_VERSION);
    expect(screen.getByTestId('seen')).toHaveTextContent(APP_VERSION);

    screen.getByRole('button', { name: 'Version vue' }).click();
    await waitFor(() => expect(markVersionSeen).toHaveBeenCalledWith('user-1', '2.1.0'));
    expect(screen.getByTestId('seen')).toHaveTextContent('2.1.0');
  });
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

  it('applique le thème du compte sur cet appareil', async () => {
    fetchPreferences.mockResolvedValue({ ...DEFAULT_PREFERENCES, theme: 'dark' });
    render(<PreferencesProvider><Probe /></PreferencesProvider>);

    await waitFor(() => expect(document.documentElement.classList.contains('dark')).toBe(true));
    expect(localStorage.getItem('caltrack-theme')).toBe('dark');
  });

  it("garde le thème de l'appareil si le compte n'a rien enregistré", async () => {
    localStorage.setItem('caltrack-theme', 'dark');
    fetchPreferences.mockResolvedValue(null);
    render(<PreferencesProvider><Probe /></PreferencesProvider>);

    await waitFor(() => expect(fetchPreferences).toHaveBeenCalled());
    expect(localStorage.getItem('caltrack-theme')).toBe('dark');
  });
});

