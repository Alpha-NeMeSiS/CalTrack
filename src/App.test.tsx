import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import App from './App';

// Session simulée : personne n'est connecté (écran de connexion)
vi.mock('./contexts/AuthContext', () => ({ AuthProvider: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock('./contexts/PreferencesContext', () => ({ PreferencesProvider: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock('./contexts/useAuth', () => ({
  useAuth: () => ({
    user: null,
    profile: null,
    loading: false,
    profileError: null,
    passwordRecovery: false,
    authNotice: null,
    clearAuthNotice: vi.fn(),
    refreshProfile: vi.fn(),
    signOut: vi.fn(),
    signIn: vi.fn(),
    signUp: vi.fn(),
    resetPassword: vi.fn(),
  }),
}));
vi.mock('./lib/supabase', async () => {
  const { fakeSupabase } = await import('./test/supabaseMock');
  return { supabase: fakeSupabase };
});

describe('App (écran de connexion)', () => {
  it('affiche le pied de page et ouvre « À propos », puis revient à la connexion', async () => {
    render(<App />);
    expect(screen.getByRole('button', { name: 'Se connecter' })).toBeInTheDocument();
    expect(screen.getByText(/CalTrack v1\.0\.0/)).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Sources' }));
    expect(screen.getByRole('heading', { level: 1, name: 'À propos' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Se connecter' })).not.toBeInTheDocument();
    // Pas de compte : pas d'accès à l'export ni à la suppression
    expect(screen.queryByRole('button', { name: 'Télécharger mes données' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Retour à la connexion' }));
    expect(screen.getByRole('button', { name: 'Se connecter' })).toBeInTheDocument();
  });
});
