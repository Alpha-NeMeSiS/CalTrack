import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Dashboard } from './Dashboard';
import { supabaseMock, hasOperation, getOperationArgs } from '../../test/supabaseMock';
import { makeDailyTarget, makeEntry, makeGoal, makeProfile } from '../../test/fixtures';
import { ensureDailyTargetForDate, fetchActiveGoal } from '../../services/goals';
import type { Entry } from '../../lib/supabase';

const profile = makeProfile();
// Objets stables entre les rendus, comme le state du vrai AuthProvider
// (un nouvel objet à chaque rendu relancerait le chargement en boucle)
const authValue = { user: { id: 'user-1' }, profile };

vi.mock('../../contexts/useAuth', () => ({
  useAuth: () => authValue,
}));

vi.mock('../../lib/supabase', async () => {
  const { fakeSupabase } = await import('../../test/supabaseMock');
  return { supabase: fakeSupabase };
});

vi.mock('../../services/goals', () => ({
  fetchActiveGoal: vi.fn(),
  ensureDailyTargetForDate: vi.fn(),
}));

const mockedFetchActiveGoal = vi.mocked(fetchActiveGoal);
const mockedEnsureDailyTarget = vi.mocked(ensureDailyTargetForDate);

function setEntries(entries: Entry[]) {
  supabaseMock.setHandler((call) =>
    call.table === 'entries' && hasOperation(call, 'select')
      ? { data: entries, error: null }
      : { data: null, error: null }
  );
}

beforeEach(() => {
  supabaseMock.reset();
  mockedFetchActiveGoal.mockReset();
  mockedEnsureDailyTarget.mockReset();
});

describe('Dashboard', () => {
  it("affiche le suivi d'une journée couverte par un objectif de maintien (régression)", async () => {
    const goal = makeGoal({ type: 'maintain', end_date: null });
    mockedFetchActiveGoal.mockResolvedValue(goal);
    mockedEnsureDailyTarget.mockResolvedValue(makeDailyTarget({ date: '2025-03-15' }));
    setEntries([makeEntry({ date: '2025-03-15' })]);

    render(<Dashboard activeDate="2025-03-15" />);

    expect(await screen.findByText('Journal du jour')).toBeInTheDocument();
    expect(screen.getByText('Poulet rôti')).toBeInTheDocument();
    expect(screen.getByText('150g · 248 kcal')).toBeInTheDocument();
    expect(screen.queryByText('Aucun objectif défini pour cette date')).not.toBeInTheDocument();

    // La cible est résolue avec le profil et l'objectif actif
    expect(mockedEnsureDailyTarget).toHaveBeenCalledWith('user-1', '2025-03-15', profile, goal);
  });

  it("invite à définir un objectif quand aucun ne s'applique", async () => {
    mockedFetchActiveGoal.mockResolvedValue(null);
    mockedEnsureDailyTarget.mockResolvedValue(null);
    setEntries([]);

    render(<Dashboard activeDate="2025-03-15" />);

    expect(await screen.findByText('Aucun objectif défini pour cette date')).toBeInTheDocument();
    expect(screen.getByText('Aller aux paramètres')).toBeInTheDocument();
  });

  it('affiche une erreur avec un bouton Réessayer si le chargement échoue', async () => {
    mockedFetchActiveGoal.mockRejectedValueOnce(new Error('réseau'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    setEntries([]);

    render(<Dashboard activeDate="2025-03-15" />);

    expect(await screen.findByText('Impossible de charger les données de cette journée.')).toBeInTheDocument();

    mockedFetchActiveGoal.mockResolvedValue(makeGoal());
    mockedEnsureDailyTarget.mockResolvedValue(makeDailyTarget());
    await userEvent.setup().click(screen.getByRole('button', { name: 'Réessayer' }));

    expect(await screen.findByText('Journal du jour')).toBeInTheDocument();
  });

  describe('suppression', () => {
    beforeEach(() => {
      mockedFetchActiveGoal.mockResolvedValue(makeGoal());
      mockedEnsureDailyTarget.mockResolvedValue(makeDailyTarget());
      setEntries([makeEntry({ id: 'entry-42' })]);
    });

    it('demande une confirmation et ne supprime rien si on annule', async () => {
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
      render(<Dashboard activeDate="2025-01-10" />);

      await userEvent.setup().click(await screen.findByRole('button', { name: 'Supprimer' }));

      expect(confirmSpy).toHaveBeenCalledWith('Supprimer « Poulet rôti » du journal ?');
      expect(supabaseMock.callsFor('entries', 'delete')).toHaveLength(0);
    });

    it("supprime l'entrée après confirmation", async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      render(<Dashboard activeDate="2025-01-10" />);

      await userEvent.setup().click(await screen.findByRole('button', { name: 'Supprimer' }));

      await waitFor(() => expect(supabaseMock.callsFor('entries', 'delete')).toHaveLength(1));
      const [deleteCall] = supabaseMock.callsFor('entries', 'delete');
      expect(getOperationArgs(deleteCall, 'eq')).toEqual(['id', 'entry-42']);
    });

    it("affiche une erreur si la suppression échoue", async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      vi.spyOn(console, 'error').mockImplementation(() => {});
      supabaseMock.setHandler((call) => {
        if (hasOperation(call, 'delete')) return { data: null, error: new Error('refusé') };
        if (call.table === 'entries') return { data: [makeEntry({ id: 'entry-42' })], error: null };
        return { data: null, error: null };
      });
      render(<Dashboard activeDate="2025-01-10" />);

      await userEvent.setup().click(await screen.findByRole('button', { name: 'Supprimer' }));

      expect(await screen.findByRole('alert')).toHaveTextContent('La suppression a échoué');
    });
  });
});
