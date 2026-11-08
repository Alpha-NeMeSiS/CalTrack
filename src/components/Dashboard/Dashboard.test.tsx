import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Dashboard } from './Dashboard';
import { supabaseMock, hasOperation, getOperationArgs } from '../../test/supabaseMock';
import { makeDailyTarget, makeEntry, makeGoal, makeProfile } from '../../test/fixtures';
import { ensureDailyTargetForDate, fetchUserGoals } from '../../services/goals';
import type { Entry, Goal } from '../../lib/supabase';

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
  fetchUserGoals: vi.fn(),
  ensureDailyTargetForDate: vi.fn(),
}));

const mockedFetchUserGoals = vi.mocked(fetchUserGoals);
const mockedEnsureDailyTarget = vi.mocked(ensureDailyTargetForDate);

function setEntries(entries: Entry[]) {
  supabaseMock.setHandler((call) =>
    call.table === 'entries' && hasOperation(call, 'select')
      ? { data: entries, error: null }
      : { data: null, error: null }
  );
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

beforeEach(() => {
  supabaseMock.reset();
  mockedFetchUserGoals.mockReset();
  mockedEnsureDailyTarget.mockReset();
});

describe('Dashboard', () => {
  it("affiche le suivi d'une journée couverte par un objectif de maintien (régression)", async () => {
    const goal = makeGoal({ type: 'maintain', end_date: null });
    mockedFetchUserGoals.mockResolvedValue([goal]);
    mockedEnsureDailyTarget.mockResolvedValue(makeDailyTarget({ date: '2025-03-15' }));
    setEntries([makeEntry({ date: '2025-03-15' })]);

    render(<Dashboard activeDate="2025-03-15" />);

    expect(await screen.findByText('Journal du jour')).toBeInTheDocument();
    expect(screen.getByText('Poulet rôti')).toBeInTheDocument();
    expect(screen.getByText('150g · 248 kcal')).toBeInTheDocument();
    expect(screen.queryByText('Aucun objectif défini pour cette date')).not.toBeInTheDocument();

    // La cible est résolue avec le profil et l'objectif en vigueur à cette date
    expect(mockedEnsureDailyTarget).toHaveBeenCalledWith('user-1', '2025-03-15', profile, goal);
  });

  it('place les calories et le journal avant la progression de l’objectif', async () => {
    const goal = makeGoal({ type: 'loss', target_weight_kg: 74, start_weight_kg: 82, duration_weeks: 12, start_date: '2025-01-01' });
    mockedFetchUserGoals.mockResolvedValue([goal]);
    mockedEnsureDailyTarget.mockResolvedValue(makeDailyTarget());
    setEntries([makeEntry()]);

    render(<Dashboard activeDate="2025-01-10" />);

    const journal = await screen.findByText('Journal du jour');
    const calories = screen.getByText('Protéines');
    const goalCard = screen.getByText("Progression de l'objectif");
    const follows = (a: Element, b: Element) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    expect(follows(calories, journal)).toBe(true);
    expect(follows(journal, goalCard)).toBe(true);
  });

  it('propose un bouton « Ajouter » flottant (mobile) qui ouvre la fenêtre d’ajout', async () => {
    mockedFetchUserGoals.mockResolvedValue([makeGoal()]);
    mockedEnsureDailyTarget.mockResolvedValue(makeDailyTarget());
    setEntries([]);

    render(<Dashboard activeDate="2025-01-10" />);
    await screen.findByText('Journal du jour');

    await userEvent.setup().click(screen.getByRole('button', { name: 'Ajouter un aliment' }));

    expect(screen.getByRole('dialog', { name: 'Ajouter un aliment' })).toBeInTheDocument();
    // Le bouton flottant disparaît tant que la fenêtre est ouverte
    expect(screen.queryByRole('button', { name: 'Ajouter un aliment' })).not.toBeInTheDocument();
  });

  it("utilise l'objectif en vigueur pour un jour passé, pas l'objectif actif (régression)", async () => {
    // Objectif A jusqu'au 1er mars, puis objectif B (actif) depuis le 1er mars
    const oldGoal = makeGoal({ id: 'goal-old', is_active: false, start_date: '2025-01-01', created_at: '2025-01-01T12:00:00Z' });
    const newGoal = makeGoal({ id: 'goal-new', is_active: true, start_date: '2025-03-01', created_at: '2025-03-01T12:00:00Z' });
    mockedFetchUserGoals.mockResolvedValue([newGoal, oldGoal]);
    mockedEnsureDailyTarget.mockResolvedValue(makeDailyTarget({ date: '2025-02-10', goal_id: 'goal-old' }));
    setEntries([]);

    render(<Dashboard activeDate="2025-02-10" />);

    expect(await screen.findByText('Journal du jour')).toBeInTheDocument();
    expect(mockedEnsureDailyTarget).toHaveBeenCalledWith('user-1', '2025-02-10', profile, oldGoal);
  });

  it("invite à définir un objectif quand aucun ne s'applique, en gardant le choix de la date (régression)", async () => {
    mockedFetchUserGoals.mockResolvedValue([]);
    mockedEnsureDailyTarget.mockResolvedValue(null);
    setEntries([]);
    const onActiveDateChange = vi.fn();

    render(<Dashboard activeDate="2025-03-15" onActiveDateChange={onActiveDateChange} />);

    expect(await screen.findByText('Aucun objectif défini pour cette date')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Aller aux paramètres' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ajouter' })).not.toBeInTheDocument();

    // Le sélecteur de date reste disponible : on peut revenir à une autre journée
    const dateInput = screen.getByLabelText('Date affichée');
    fireEvent.change(dateInput, { target: { value: '2025-03-14' } });
    expect(onActiveDateChange).toHaveBeenCalledWith('2025-03-14');
    await waitFor(() =>
      expect(mockedEnsureDailyTarget).toHaveBeenCalledWith('user-1', '2025-03-14', profile, null)
    );
  });

  it("signale un objectif terminé et permet d'en définir un nouveau (onglet Objectif)", async () => {
    const endedGoal = makeGoal({ type: 'loss', start_date: '2025-01-01', end_date: '2025-03-26', deficit_or_surplus_pct: 20 });
    mockedFetchUserGoals.mockResolvedValue([endedGoal]);
    mockedEnsureDailyTarget.mockResolvedValue(makeDailyTarget({ date: '2025-04-10', calories_kcal: 2400 }));
    setEntries([]);
    const listener = vi.fn();
    window.addEventListener('navigate-to-settings', listener);

    render(<Dashboard activeDate="2025-04-10" />);

    const banner = await screen.findByText(/Objectif terminé le 26 mars 2025/);
    expect(banner.closest('[role="status"]')).toHaveTextContent('suivies en maintien (2400 kcal)');
    // Le suivi reste possible (plus de blocage « Aucun objectif »)
    expect(screen.getByText('Journal du jour')).toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole('button', { name: 'Définir un nouvel objectif' }));
    expect((listener.mock.calls[0][0] as CustomEvent).detail).toEqual({ tab: 'goal' });
    window.removeEventListener('navigate-to-settings', listener);
  });

  it("« Aller aux paramètres » ouvre l'onglet Objectif", async () => {
    mockedFetchUserGoals.mockResolvedValue([]);
    mockedEnsureDailyTarget.mockResolvedValue(null);
    setEntries([]);
    const listener = vi.fn();
    window.addEventListener('navigate-to-settings', listener);

    render(<Dashboard activeDate="2025-03-15" />);
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Aller aux paramètres' }));

    expect((listener.mock.calls[0][0] as CustomEvent).detail).toEqual({ tab: 'goal' });
    window.removeEventListener('navigate-to-settings', listener);
  });

  it('ignore un champ date vidé', async () => {
    mockedFetchUserGoals.mockResolvedValue([makeGoal()]);
    mockedEnsureDailyTarget.mockResolvedValue(makeDailyTarget());
    setEntries([]);
    const onActiveDateChange = vi.fn();

    render(<Dashboard activeDate="2025-01-10" onActiveDateChange={onActiveDateChange} />);
    await screen.findByText('Journal du jour');

    fireEvent.change(screen.getByLabelText('Date affichée'), { target: { value: '' } });

    expect(onActiveDateChange).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Date affichée')).toHaveValue('2025-01-10');
  });

  it("n'affiche pas les données d'une date précédente arrivées en retard (régression)", async () => {
    const slowGoals = deferred<Goal[]>();
    const goalA = makeGoal({ id: 'goal-a' });
    mockedFetchUserGoals.mockReturnValueOnce(slowGoals.promise).mockResolvedValue([goalA]);
    mockedEnsureDailyTarget.mockImplementation(async (_userId, date) =>
      makeDailyTarget({ date, calories_kcal: date === '2025-01-09' ? 1111 : 2222 })
    );
    setEntries([]);

    const { rerender } = render(<Dashboard activeDate="2025-01-09" />);
    // L'utilisateur change de date avant la fin du premier chargement
    rerender(<Dashboard activeDate="2025-01-10" />);
    expect(await screen.findByText('/ 2222')).toBeInTheDocument();

    // La réponse du 9 janvier arrive après coup : elle doit être ignorée
    await act(async () => {
      slowGoals.resolve([goalA]);
    });
    expect(screen.getByText('/ 2222')).toBeInTheDocument();
    expect(screen.queryByText('/ 1111')).not.toBeInTheDocument();
  });

  it('affiche une erreur avec un bouton Réessayer si le chargement échoue', async () => {
    mockedFetchUserGoals.mockRejectedValueOnce(new Error('réseau'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    setEntries([]);

    render(<Dashboard activeDate="2025-03-15" />);

    expect(await screen.findByText('Impossible de charger les données de cette journée.')).toBeInTheDocument();
    expect(screen.getByLabelText('Date affichée')).toBeInTheDocument();

    mockedFetchUserGoals.mockResolvedValue([makeGoal()]);
    mockedEnsureDailyTarget.mockResolvedValue(makeDailyTarget());
    await userEvent.setup().click(screen.getByRole('button', { name: 'Réessayer' }));

    expect(await screen.findByText('Journal du jour')).toBeInTheDocument();
  });

  describe('suppression', () => {
    beforeEach(() => {
      mockedFetchUserGoals.mockResolvedValue([makeGoal()]);
      mockedEnsureDailyTarget.mockResolvedValue(makeDailyTarget());
      setEntries([makeEntry({ id: 'entry-42' })]);
    });

    it('demande une confirmation et ne supprime rien si on annule', async () => {
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
      render(<Dashboard activeDate="2025-01-10" />);

      await userEvent.setup().click(await screen.findByRole('button', { name: 'Supprimer Poulet rôti' }));

      expect(confirmSpy).toHaveBeenCalledWith('Supprimer « Poulet rôti » du journal ?');
      expect(supabaseMock.callsFor('entries', 'delete')).toHaveLength(0);
    });

    it("supprime l'entrée après confirmation, sans écran de chargement complet (régression)", async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      render(<Dashboard activeDate="2025-01-10" />);
      await screen.findByText('Journal du jour');

      // Le rechargement après suppression reste en attente pendant les vérifications
      const pendingReload = deferred<Goal[]>();
      mockedFetchUserGoals.mockReturnValueOnce(pendingReload.promise);

      await userEvent.setup().click(screen.getByRole('button', { name: 'Supprimer Poulet rôti' }));

      await waitFor(() => expect(supabaseMock.callsFor('entries', 'delete')).toHaveLength(1));
      const [deleteCall] = supabaseMock.callsFor('entries', 'delete');
      expect(getOperationArgs(deleteCall, 'eq')).toEqual(['id', 'entry-42']);

      // Pendant le rechargement en arrière-plan, la page reste affichée
      await waitFor(() => expect(mockedFetchUserGoals).toHaveBeenCalledTimes(2));
      expect(screen.getByText('Journal du jour')).toBeInTheDocument();
      expect(screen.queryByText('Chargement...')).not.toBeInTheDocument();

      await act(async () => {
        pendingReload.resolve([makeGoal()]);
      });
      expect(screen.getByText('Journal du jour')).toBeInTheDocument();
    });

    it('affiche une erreur si la suppression échoue', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      vi.spyOn(console, 'error').mockImplementation(() => {});
      supabaseMock.setHandler((call) => {
        if (hasOperation(call, 'delete')) return { data: null, error: new Error('refusé') };
        if (call.table === 'entries') return { data: [makeEntry({ id: 'entry-42' })], error: null };
        return { data: null, error: null };
      });
      render(<Dashboard activeDate="2025-01-10" />);

      await userEvent.setup().click(await screen.findByRole('button', { name: 'Supprimer Poulet rôti' }));

      expect(await screen.findByRole('alert')).toHaveTextContent('La suppression a échoué');
    });
  });
});
