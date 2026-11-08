import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session } from '@supabase/supabase-js';
import { AuthProvider } from './AuthContext';
import { useAuth } from './useAuth';
import { supabaseMock } from '../test/supabaseMock';
import { makeProfile } from '../test/fixtures';

// Faux client Supabase : requêtes via supabaseMock + API auth contrôlée par le test
const auth = vi.hoisted(() => ({
  session: null as Session | null,
  listener: null as null | ((event: string, session: Session | null) => void),
  getSession: (() => Promise.resolve({ data: { session: null } })) as (...args: unknown[]) => Promise<unknown>,
  signOut: (() => Promise.resolve({ error: null })) as (...args: unknown[]) => Promise<unknown>,
  resetPasswordForEmail: (() => Promise.resolve({ error: null })) as (...args: unknown[]) => Promise<unknown>,
  updateUser: (() => Promise.resolve({ error: null })) as (...args: unknown[]) => Promise<unknown>,
}));

vi.mock('../lib/supabase', async () => {
  const { fakeSupabase } = await import('../test/supabaseMock');
  return {
    openedFromPasswordRecoveryLink: false,
    supabase: {
      ...fakeSupabase,
      auth: {
        getSession: (...args: unknown[]) => auth.getSession(...args),
        onAuthStateChange: (callback: (event: string, session: Session | null) => void) => {
          auth.listener = callback;
          return { data: { subscription: { unsubscribe: vi.fn() } } };
        },
        signOut: (...args: unknown[]) => auth.signOut(...args),
        signUp: vi.fn(),
        signInWithPassword: vi.fn(),
        resetPasswordForEmail: (...args: unknown[]) => auth.resetPasswordForEmail(...args),
        updateUser: (...args: unknown[]) => auth.updateUser(...args),
      },
    },
  };
});

function sessionFor(userId: string): Session {
  return { user: { id: userId, email: `${userId}@example.com` } } as unknown as Session;
}

/** Affiche l'état du contexte pour les assertions */
function Probe() {
  const { user, profile, loading, profileError, signOut, passwordRecovery, updatePassword, requestPasswordReset, deleteAccount } =
    useAuth();
  return (
    <div>
      <span data-testid="state">
        {loading ? 'loading' : !user ? 'anonymous' : profileError ? 'error' : profile ? 'ready' : 'onboarding'}
      </span>
      <span data-testid="error">{profileError ?? ''}</span>
      <span data-testid="recovery">{passwordRecovery ? 'recovery' : 'normal'}</span>
      <button type="button" onClick={() => signOut()}>
        Déconnexion
      </button>
      <button type="button" onClick={() => updatePassword('nouveau123')}>
        Changer
      </button>
      <button type="button" onClick={() => requestPasswordReset('eva@example.com')}>
        Oublié
      </button>
      <button
        type="button"
        onClick={async () => {
          const { error } = await deleteAccount();
          document.body.dataset.deleteResult = error ? error.message : 'ok';
        }}
      >
        Supprimer
      </button>
    </div>
  );
}

function emitAuthEvent(event: string, session: Session | null) {
  act(() => {
    auth.listener?.(event, session);
  });
}

const state = () => screen.getByTestId('state').textContent;

beforeEach(() => {
  supabaseMock.reset();
  auth.session = null;
  auth.listener = null;
  auth.getSession = vi.fn(() => Promise.resolve({ data: { session: auth.session } }));
  auth.signOut = vi.fn(() => Promise.resolve({ error: null }));
  auth.resetPasswordForEmail = vi.fn(() => Promise.resolve({ error: null }));
  auth.updateUser = vi.fn(() => Promise.resolve({ error: null }));
  delete document.body.dataset.deleteResult;
});

describe('AuthProvider', () => {
  it('passe à « anonyme » sans session', async () => {
    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(state()).toBe('anonymous'));
  });

  it("reste en chargement jusqu'à l'arrivée du profil après connexion (pas de flash d'onboarding)", async () => {
    let resolveProfile!: (value: { data: unknown; error: null }) => void;
    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(state()).toBe('anonymous'));

    // La requête du profil reste en attente
    const pending = new Promise<{ data: unknown; error: null }>((resolve) => {
      resolveProfile = resolve;
    });
    supabaseMock.setHandler(() => pending as unknown as { data: unknown; error: null });

    emitAuthEvent('SIGNED_IN', sessionFor('user-1'));
    await waitFor(() => expect(state()).toBe('loading'));

    await act(async () => {
      resolveProfile({ data: makeProfile(), error: null });
    });
    await waitFor(() => expect(state()).toBe('ready'));
  });

  it('ne recharge pas le profil lors du rafraîchissement du jeton (même utilisateur)', async () => {
    auth.session = sessionFor('user-1');
    supabaseMock.setHandler(() => ({ data: makeProfile(), error: null }));
    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(state()).toBe('ready'));

    // INITIAL_SESSION + TOKEN_REFRESHED pour le même utilisateur
    emitAuthEvent('INITIAL_SESSION', sessionFor('user-1'));
    emitAuthEvent('TOKEN_REFRESHED', sessionFor('user-1'));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    expect(supabaseMock.callsFor('profiles')).toHaveLength(1);
    expect(state()).toBe('ready');
  });

  it("signale une erreur de chargement du profil au lieu d'envoyer vers l'onboarding", async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    auth.session = sessionFor('user-1');
    supabaseMock.setHandler(() => ({ data: null, error: new Error('réseau') }));

    render(<AuthProvider><Probe /></AuthProvider>);

    await waitFor(() => expect(state()).toBe('error'));
    expect(screen.getByTestId('error')).toHaveTextContent('Impossible de charger votre profil');
  });

  it("distingue « pas encore de profil » (onboarding) d'une erreur", async () => {
    auth.session = sessionFor('user-1');
    supabaseMock.setHandler(() => ({ data: null, error: null }));

    render(<AuthProvider><Probe /></AuthProvider>);

    await waitFor(() => expect(state()).toBe('onboarding'));
  });

  it('vide la session locale même si la déconnexion réseau échoue', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    auth.session = sessionFor('user-1');
    auth.signOut = vi.fn(() => Promise.reject(new Error('hors ligne')));
    supabaseMock.setHandler(() => ({ data: makeProfile(), error: null }));
    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(state()).toBe('ready'));

    await act(async () => {
      screen.getByRole('button', { name: 'Déconnexion' }).click();
    });

    await waitFor(() => expect(state()).toBe('anonymous'));
  });

  it("passe en mode « nouveau mot de passe » à l'arrivée depuis le lien de réinitialisation", async () => {
    auth.session = sessionFor('user-1');
    supabaseMock.setHandler(() => ({ data: makeProfile(), error: null }));
    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(state()).toBe('ready'));
    expect(screen.getByTestId('recovery')).toHaveTextContent('normal');

    emitAuthEvent('PASSWORD_RECOVERY', sessionFor('user-1'));
    expect(screen.getByTestId('recovery')).toHaveTextContent('recovery');

    await act(async () => {
      screen.getByRole('button', { name: 'Changer' }).click();
    });
    expect(auth.updateUser).toHaveBeenCalledWith({ password: 'nouveau123' });
    await waitFor(() => expect(screen.getByTestId('recovery')).toHaveTextContent('normal'));
  });

  it("demande l'email de réinitialisation avec retour vers l'application", async () => {
    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(state()).toBe('anonymous'));

    await act(async () => {
      screen.getByRole('button', { name: 'Oublié' }).click();
    });

    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith('eva@example.com', {
      redirectTo: window.location.origin,
    });
  });

  it('supprime le compte via la fonction SQL puis ferme la session locale', async () => {
    auth.session = sessionFor('user-1');
    supabaseMock.setHandler(() => ({ data: makeProfile(), error: null }));
    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(state()).toBe('ready'));

    await act(async () => {
      screen.getByRole('button', { name: 'Supprimer' }).click();
    });

    await waitFor(() => expect(state()).toBe('anonymous'));
    expect(supabaseMock.callsFor('rpc:delete_my_account')).toHaveLength(1);
    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(document.body.dataset.deleteResult).toBe('ok');
  });

  it("garde la session si la suppression du compte échoue", async () => {
    auth.session = sessionFor('user-1');
    supabaseMock.setHandler((call) =>
      call.table === 'rpc:delete_my_account'
        ? { data: null, error: { message: 'permission denied' } }
        : { data: makeProfile(), error: null }
    );
    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(state()).toBe('ready'));

    await act(async () => {
      screen.getByRole('button', { name: 'Supprimer' }).click();
    });

    await waitFor(() => expect(document.body.dataset.deleteResult).toBe('permission denied'));
    expect(auth.signOut).not.toHaveBeenCalled();
    expect(state()).toBe('ready');
  });
});
