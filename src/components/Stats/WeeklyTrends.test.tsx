import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WeeklyTrends } from './WeeklyTrends';
import { supabaseMock } from '../../test/supabaseMock';
import { makeDailyTarget, makeEntry } from '../../test/fixtures';
import { addDaysToDateString, getTodayDate, parseLocalDate } from '../../utils/date';

const authValue = { user: { id: 'user-1' } };

vi.mock('../../contexts/useAuth', () => ({
  useAuth: () => authValue,
}));

vi.mock('../../lib/supabase', async () => {
  const { fakeSupabase } = await import('../../test/supabaseMock');
  return { supabase: fakeSupabase };
});

const today = getTodayDate();
const daysAgo = (n: number) => addDaysToDateString(today, -n);
const shortDate = (date: string) =>
  parseLocalDate(date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

/** Ligne de l'historique correspondant à une date */
function historyRow(date: string) {
  const labels = screen.getAllByText(shortDate(date));
  const label = labels[labels.length - 1];
  return label.closest('div.rounded-md') as HTMLElement;
}

beforeEach(() => {
  supabaseMock.reset();
  // Objectif sur les 3 derniers jours ; saisies : aujourd'hui (partielles) et avant-hier
  const targets = [0, 1, 2].map((n) => makeDailyTarget({ date: daysAgo(n), calories_kcal: 2150 }));
  const entries = [
    makeEntry({ id: 'today', date: today, kcal: 900 }),
    makeEntry({ id: 'before-yesterday', date: daysAgo(2), kcal: 1200 }),
  ];
  const weights = [
    { id: 'w1', date: daysAgo(20), weight_kg: 81.5 },
    { id: 'w2', date: daysAgo(0), weight_kg: 79.9 },
  ];
  supabaseMock.setHandler((call) => {
    if (call.table === 'daily_targets') return { data: targets, error: null };
    if (call.table === 'entries') return { data: entries, error: null };
    if (call.table === 'weight_logs') return { data: weights, error: null };
    return { data: null, error: null }; // goals : pas d'objectif actif
  });
});

describe('WeeklyTrends', () => {
  it("affiche la journée en cours comme « En cours », pas comme un échec (régression)", async () => {
    render(<WeeklyTrends />);
    await screen.findByText('Historique détaillé (30 jours)');

    expect(within(historyRow(today)).getByText('En cours')).toBeInTheDocument();
  });

  it('affiche une journée passée sans saisie comme « Non renseigné » (régression)', async () => {
    render(<WeeklyTrends />);
    await screen.findByText('Historique détaillé (30 jours)');

    const row = historyRow(daysAgo(1));
    expect(within(row).getByText(/Non renseigné/)).toBeInTheDocument();
    expect(within(row).getByText(/objectif 2150 kcal/)).toBeInTheDocument();
  });

  it('garde « En dessous » pour une journée passée renseignée sous l’objectif', async () => {
    render(<WeeklyTrends />);
    await screen.findByText('Historique détaillé (30 jours)');

    expect(within(historyRow(daysAgo(2))).getByText('En dessous')).toBeInTheDocument();
  });

  it('distingue les journées sans objectif', async () => {
    render(<WeeklyTrends />);
    await screen.findByText('Historique détaillé (30 jours)');

    expect(within(historyRow(daysAgo(5))).getByText('Pas d’objectif')).toBeInTheDocument();
  });

  it('présente « En cours » et « Non renseigné » dans la légende du graphique', async () => {
    render(<WeeklyTrends />);
    const chart = (await screen.findByText('Graphique des calories')).parentElement!;

    expect(within(chart).getByText('En cours')).toBeInTheDocument();
    expect(within(chart).getByText('Non renseigné')).toBeInTheDocument();
  });

  it('affiche la courbe de poids des 90 derniers jours', async () => {
    render(<WeeklyTrends />);

    expect(await screen.findByText('Évolution du poids (90 jours)')).toBeInTheDocument();
    expect(screen.getByTestId('weight-change')).toHaveTextContent('-1,6 kg');
  });

  it('affiche une erreur avec « Réessayer » si le chargement échoue', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    supabaseMock.setHandler(() => ({ data: null, error: new Error('réseau') }));
    render(<WeeklyTrends />);

    expect(await screen.findByText("Impossible de charger l'historique.")).toBeInTheDocument();

    supabaseMock.setHandler(() => ({ data: [], error: null }));
    await userEvent.setup().click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(await screen.findByText('Graphique des calories')).toBeInTheDocument();
  });

  it('affiche les indicateurs des 7 derniers jours', async () => {
    render(<WeeklyTrends />);
    await screen.findByText('Historique détaillé (30 jours)');

    // Avant-hier seul est un jour complet renseigné (1200 kcal)
    expect(screen.getByRole('heading', { name: 'Vos 7 derniers jours' })).toBeInTheDocument();
    const tile = screen.getByText('Calories moyennes').parentElement as HTMLElement;
    expect(tile.textContent?.replace(/[\u202f\u00a0]/g, ' ')).toContain('1 200 kcal/j');
    expect(screen.getByText('Série en cours').parentElement).toHaveTextContent('1 jour');
  });

  it('résume l’eau des 7 derniers jours', async () => {
    supabaseMock.setHandler((call) => {
      if (call.table === 'water_logs') {
        return {
          data: [
            { id: 'e1', user_id: 'user-1', date: daysAgo(1), amount_ml: 2500, created_at: `${daysAgo(1)}T10:00:00Z` },
            { id: 'e2', user_id: 'user-1', date: daysAgo(2), amount_ml: 1700, created_at: `${daysAgo(2)}T10:00:00Z` },
          ],
          error: null,
        };
      }
      return { data: call.table === 'goals' ? null : [], error: null };
    });
    render(<WeeklyTrends />);
    expect(await screen.findByText('Eau moyenne')).toBeInTheDocument();
    // (2 500 + 1 700) / 2 = 2 100 ml ; objectif de 2 L (poids inconnu dans ce test) atteint 1 jour
    expect(screen.getByText('2,1 L/j')).toBeInTheDocument();
    expect(screen.getByText('1/7 jours à l’objectif')).toBeInTheDocument();
  });
});

