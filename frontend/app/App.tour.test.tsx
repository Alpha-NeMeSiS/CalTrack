import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { PreferencesContext, PreferencesContextValue } from './contexts/preferencesContextValue';
import { DEFAULT_PREFERENCES } from '../features/settings/preferences';
import { APP_VERSION } from './appInfo';
import { makeProfile } from '../test/fixtures';

// Connecté avec un profil ; préférences fournies par le test
const prefsValue: { current: PreferencesContextValue } = { current: null as unknown as PreferencesContextValue };
vi.mock('./contexts/AuthContext', () => ({ AuthProvider: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock('./contexts/PreferencesContext', () => ({
  PreferencesProvider: ({ children }: { children: ReactNode }) => (
    <PreferencesContext.Provider value={prefsValue.current}>{children}</PreferencesContext.Provider>
  ),
}));
const profile = makeProfile();
vi.mock('./contexts/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'user-1', email: 'alex@example.com' },
    profile,
    loading: false,
    profileError: null,
    passwordRecovery: false,
    authNotice: null,
    clearAuthNotice: vi.fn(),
    refreshProfile: vi.fn(),
    signOut: vi.fn(),
  }),
}));
vi.mock('../shared/supabase', async () => {
  const { fakeSupabase } = await import('../test/supabaseMock');
  return { supabase: fakeSupabase };
});
// Journal simplifié : la visite y est « affichée » quand tourActive est vrai
vi.mock('../features/journal/Dashboard', () => ({
  Dashboard: ({ tourActive, onTourFinish }: { tourActive?: boolean; onTourFinish?: (r: 'done' | 'skipped') => void }) =>
    tourActive ? (
      <div>
        <p>Visite en cours</p>
        <button type="button" onClick={() => onTourFinish?.('skipped')}>Passer la visite</button>
      </div>
    ) : (
      <p>Journal simulé</p>
    ),
}));

function setPrefs(overrides: Partial<PreferencesContextValue> & { tourCompletedAt?: string | null; lastSeenVersion?: string | null }) {
  const { tourCompletedAt = null, lastSeenVersion = null, ...rest } = overrides;
  prefsValue.current = {
    preferences: { ...DEFAULT_PREFERENCES, tourCompletedAt, lastSeenVersion },
    status: 'ready',
    savePreferences: vi.fn(),
    markTourCompleted: vi.fn().mockResolvedValue(undefined),
    markVersionSeen: vi.fn().mockResolvedValue(undefined),
    ...rest,
  };
}

beforeEach(() => setPrefs({}));

describe('App : visite guidée et « Quoi de neuf ? » au lancement', () => {
  it('nouvelle visite : la visite seule, enregistrée à la fin, sans « Quoi de neuf ? » ensuite', async () => {
    setPrefs({ tourCompletedAt: null, lastSeenVersion: null });
    render(<App />);
    expect(await screen.findByText('Visite en cours')).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Quoi de neuf ?' })).not.toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole('button', { name: 'Passer la visite' }));
    expect(prefsValue.current.markTourCompleted).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Journal simulé')).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Quoi de neuf ?' })).not.toBeInTheDocument();
  });

  it('visite déjà vue et mise à jour : « Quoi de neuf ? » une fois, puis enregistrée', async () => {
    setPrefs({ tourCompletedAt: '2026-11-01T08:00:00Z', lastSeenVersion: '2.0.0' });
    render(<App />);
    const dialog = await screen.findByRole('dialog', { name: 'Quoi de neuf ?' });
    expect(dialog).toHaveTextContent(`Version ${APP_VERSION}`);
    expect(screen.queryByText('Visite en cours')).not.toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole('button', { name: 'C’est noté' }));
    expect(prefsValue.current.markVersionSeen).toHaveBeenCalledWith(APP_VERSION);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Quoi de neuf ?' })).not.toBeInTheDocument());
  });

  it('rien quand la version actuelle est déjà vue', async () => {
    setPrefs({ tourCompletedAt: '2026-11-01T08:00:00Z', lastSeenVersion: APP_VERSION });
    render(<App />);
    expect(await screen.findByText('Journal simulé')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('« Revoir la visite » depuis le Guide relance la visite sur le journal, sans rien enregistrer', async () => {
    setPrefs({ tourCompletedAt: '2026-11-01T08:00:00Z', lastSeenVersion: APP_VERSION });
    render(<App />);
    const user = userEvent.setup();
    await screen.findByText('Journal simulé');

    for (let round = 0; round < 2; round++) {
      await user.click(screen.getByRole('button', { name: /Menu du compte/ }));
      await user.click(screen.getByRole('menuitem', { name: 'Guide' }));
      // Écran différé (audit A-12) : on attend le chargement du module
      expect(await screen.findByRole('heading', { level: 1, name: 'Guide' })).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Revoir la visite' }));
      // Relancée à chaque fois (Review Focus 5)
      expect(await screen.findByText('Visite en cours')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Passer la visite' }));
      expect(await screen.findByText('Journal simulé')).toBeInTheDocument();
    }
    expect(prefsValue.current.markTourCompleted).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog', { name: 'Quoi de neuf ?' })).not.toBeInTheDocument();
  });

  it.each(['loading', 'error'] as const)('rien tant que les préférences sont « %s »', async (status) => {
    setPrefs({ status, tourCompletedAt: null, lastSeenVersion: null });
    render(<App />);
    expect(await screen.findByText('Journal simulé')).toBeInTheDocument();
    expect(screen.queryByText('Visite en cours')).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
