// Logo cliquable : retour au tableau de bord, sur la date du jour
// (spec 2026-11-28-journal-detail-repas).
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { PreferencesContext, PreferencesContextValue } from './contexts/preferencesContextValue';
import { DEFAULT_PREFERENCES } from '../features/settings/preferences';
import { APP_VERSION } from './appInfo';
import { getTodayDate } from '../shared/date';
import { makeProfile } from '../test/fixtures';

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
// Tableau de bord simulé : affiche sa date et permet d'en changer
vi.mock('../features/journal/Dashboard', () => ({
  Dashboard: ({ activeDate, onActiveDateChange }: { activeDate?: string; onActiveDateChange?: (d: string) => void }) => (
    <div>
      <p>Journal du {activeDate}</p>
      <button type="button" onClick={() => onActiveDateChange?.('2020-01-01')}>
        Aller au 1er janvier 2020
      </button>
    </div>
  ),
}));
vi.mock('../features/stats/WeeklyTrends', () => ({ WeeklyTrends: () => <p>Tendances simulées</p> }));

beforeEach(() => {
  // Visite déjà vue et version déjà lue : ni visite ni « Quoi de neuf ? »
  prefsValue.current = {
    preferences: { ...DEFAULT_PREFERENCES, tourCompletedAt: '2026-11-01T08:00:00Z', lastSeenVersion: APP_VERSION },
    status: 'ready',
    savePreferences: vi.fn(),
    markTourCompleted: vi.fn().mockResolvedValue(undefined),
    markVersionSeen: vi.fn().mockResolvedValue(undefined),
  };
});

describe('App : le logo ramène au tableau de bord du jour', () => {
  it('depuis une autre vue', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getAllByRole('button', { name: /Tendances/ })[0]);
    expect(await screen.findByText('Tendances simulées')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'CalTrack, retour au tableau de bord' }));
    expect(await screen.findByText(`Journal du ${getTodayDate()}`)).toBeInTheDocument();
  });

  it('depuis le tableau de bord à une autre date : revient à aujourd’hui', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole('button', { name: 'Aller au 1er janvier 2020' }));
    expect(screen.getByText('Journal du 2020-01-01')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'CalTrack, retour au tableau de bord' }));
    expect(screen.getByText(`Journal du ${getTodayDate()}`)).toBeInTheDocument();
  });
});
