import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { InsightsPanel } from './InsightsPanel';
import type { DayIntake } from '../../utils/insights';
import { addDaysToDateString } from '../../utils/date';

const TODAY = '2026-11-08';
const daysAgo = (n: number) => addDaysToDateString(TODAY, -n);

function day(n: number, overrides: Partial<DayIntake> = {}): DayIntake {
  return {
    date: daysAgo(n),
    entryCount: 3,
    consumedKcal: 2000,
    consumedProteinG: 140,
    targetKcal: 2100,
    targetProteinG: 150,
    status: 'ok',
    ...overrides,
  };
}

/** Normalise les espaces insécables des nombres formatés en fr-FR */
const text = (element: HTMLElement) => (element.textContent ?? '').replace(/[\u202f\u00a0]/g, ' ');

function tile(label: string) {
  return screen.getByText(label).parentElement as HTMLElement;
}

describe('InsightsPanel', () => {
  it('affiche moyennes, régularité et série des 7 derniers jours', () => {
    const days = [day(0, { entryCount: 1 }), day(1), day(2, { consumedKcal: 1800, status: 'under' }), day(3)];
    render(<InsightsPanel days={days} weights={[]} today={TODAY} />);

    expect(text(tile('Calories moyennes'))).toContain('1 933 kcal/j');
    expect(text(tile('Calories moyennes'))).toContain('Objectif 2 100 kcal · écart −167');
    expect(text(tile('Protéines moyennes'))).toContain('140 g/j');
    expect(text(tile('Régularité'))).toContain('3/7 jours');
    expect(text(tile('Régularité'))).toContain('2 jours à l’objectif');
    expect(text(tile('Série en cours'))).toContain('4 jours');
  });

  it('reste lisible sans aucune saisie', () => {
    render(<InsightsPanel days={[]} weights={[]} today={TODAY} />);

    expect(text(tile('Calories moyennes'))).toContain('—');
    expect(text(tile('Calories moyennes'))).toContain('Aucune journée renseignée');
    expect(text(tile('Série en cours'))).toContain('0 jour');
    expect(text(screen.getByTestId('expenditure'))).toContain('Actuellement : 0 jour renseigné, 0 pesée');
  });

  it('affiche la dépense estimée et la compare à la formule', () => {
    const days = Array.from({ length: 28 }, (_, i) => day(i + 1));
    const weights = [28, 21, 14, 7, 0].map((n) => ({ date: daysAgo(n), weight_kg: 80 - (0.5 * (28 - n)) / 7 }));
    render(<InsightsPanel days={days} weights={weights} today={TODAY} formulaExpenditureKcal={2650} />);

    const box = screen.getByTestId('expenditure');
    expect(text(box)).toContain('≈ 2 550 kcal/j');
    expect(text(box)).toContain('poids −0,50 kg/semaine');
    expect(text(box)).toContain('formule : 2 650 kcal/j');
    expect(within(box).queryByText(/Disponible après/)).not.toBeInTheDocument();
  });

  it('résume l’eau des 7 derniers jours', () => {
    render(<InsightsPanel days={[]} weights={[]} today={TODAY} water={{ averageMl: 2100, daysAtGoal: 4 }} />);
    const tile = screen.getByText('Eau moyenne').closest('div')?.parentElement as HTMLElement;
    expect(within(tile).getByText('2,1 L/j')).toBeInTheDocument();
    expect(within(tile).getByText('4/7 jours à l’objectif')).toBeInTheDocument();
  });

  it('indique qu’aucune prise d’eau n’a été notée', () => {
    render(<InsightsPanel days={[]} weights={[]} today={TODAY} water={{ averageMl: null, daysAtGoal: 0 }} />);
    expect(screen.getByText('Aucune prise notée')).toBeInTheDocument();
  });

  it('n’affiche pas la tuile eau sans données d’eau', () => {
    render(<InsightsPanel days={[]} weights={[]} today={TODAY} />);
    expect(screen.queryByText('Eau moyenne')).not.toBeInTheDocument();
  });
});

