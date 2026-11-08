import { describe, expect, it } from 'vitest';
import {
  computeLoggingStreak,
  computeWeekInsights,
  DayIntake,
  estimateExpenditure,
  EXPENDITURE_MIN_LOGGED_DAYS,
} from './insights';
import { addDaysToDateString } from './date';

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

describe('computeWeekInsights', () => {
  it('fait la moyenne des 7 derniers jours complets renseignés, aujourd’hui exclu', () => {
    const days = [
      day(0, { consumedKcal: 500, status: 'in_progress' }), // aujourd'hui : ignoré
      day(1, { consumedKcal: 1800, status: 'under' }),
      day(2, { consumedKcal: 2200 }),
      day(3, { entryCount: 0, consumedKcal: 0, status: 'not_logged' }), // oublié : ignoré
      day(5, { consumedKcal: 2000, consumedProteinG: 100 }),
      day(8, { consumedKcal: 4000 }), // hors période
    ];

    const insights = computeWeekInsights(days, TODAY);

    expect(insights).toMatchObject({
      periodDays: 7,
      loggedDays: 3,
      onTargetDays: 2,
      avgCalories: 2000,
      avgTargetCalories: 2100,
    });
    expect(insights.avgProteinG).toBeCloseTo((140 + 140 + 100) / 3);
  });

  it('renvoie des moyennes nulles sans aucune saisie', () => {
    expect(computeWeekInsights([], TODAY)).toMatchObject({ loggedDays: 0, avgCalories: null, avgProteinG: null });
  });

  it('ignore les jours sans objectif pour la moyenne des objectifs', () => {
    const insights = computeWeekInsights(
      [day(1, { targetKcal: null, targetProteinG: null, status: null }), day(2, { targetKcal: 1900 })],
      TODAY
    );
    expect(insights.avgCalories).toBe(2000);
    expect(insights.avgTargetCalories).toBe(1900);
  });
});

describe('computeLoggingStreak', () => {
  it("compte les jours consécutifs renseignés jusqu'à aujourd'hui", () => {
    expect(computeLoggingStreak([day(0), day(1), day(2), day(4)], TODAY)).toBe(3);
  });

  it("part d'hier si aujourd'hui n'a encore aucune saisie", () => {
    expect(computeLoggingStreak([day(0, { entryCount: 0 }), day(1), day(2)], TODAY)).toBe(2);
  });

  it('vaut 0 si hier non plus n’est pas renseigné', () => {
    expect(computeLoggingStreak([day(2), day(3)], TODAY)).toBe(0);
  });
});

describe('estimateExpenditure', () => {
  /** 28 jours renseignés à `kcal` et des pesées hebdomadaires suivant `kgPerWeek` */
  function scenario(kcal: number, kgPerWeek: number) {
    const days = Array.from({ length: 28 }, (_, i) => day(i + 1, { consumedKcal: kcal }));
    const weights = [28, 21, 14, 7, 0].map((n) => ({
      date: daysAgo(n),
      weight_kg: 80 + (kgPerWeek * (28 - n)) / 7,
    }));
    return { days, weights };
  }

  it('déduit la dépense des apports et de la perte de poids', () => {
    // 2 000 kcal/j et −0,5 kg/sem. → 2 000 + 0,5 × 7 700 / 7 = 2 550 kcal/j
    const { days, weights } = scenario(2000, -0.5);

    expect(estimateExpenditure(days, weights, TODAY)).toEqual({
      status: 'ok',
      expenditureKcal: 2550,
      avgIntakeKcal: 2000,
      weeklyWeightChangeKg: -0.5,
      loggedDays: 28,
      weighIns: 5,
    });
  });

  it('égale les apports quand le poids est stable', () => {
    const { days, weights } = scenario(2400, 0);
    expect(estimateExpenditure(days, weights, TODAY)).toMatchObject({ status: 'ok', expenditureKcal: 2400 });
  });

  it('suit la tendance malgré les variations d’eau quotidiennes', () => {
    const { days } = scenario(2000, 0);
    // Poids stable autour de 80 kg avec ±0,6 kg de bruit
    const weights = Array.from({ length: 15 }, (_, i) => ({
      date: daysAgo(28 - i * 2),
      weight_kg: 80 + (i % 2 === 0 ? 0.6 : -0.6),
    }));
    const estimate = estimateExpenditure(days, weights, TODAY);
    expect(estimate.status).toBe('ok');
    if (estimate.status === 'ok') {
      expect(Math.abs(estimate.expenditureKcal - 2000)).toBeLessThanOrEqual(50);
    }
  });

  it('attend assez de jours renseignés et de pesées', () => {
    const { days, weights } = scenario(2000, -0.5);

    expect(estimateExpenditure(days.slice(0, EXPENDITURE_MIN_LOGGED_DAYS - 1), weights, TODAY)).toMatchObject({
      status: 'insufficient_data',
      loggedDays: EXPENDITURE_MIN_LOGGED_DAYS - 1,
    });
    // Deux pesées seulement
    expect(estimateExpenditure(days, weights.slice(-2), TODAY)).toMatchObject({
      status: 'insufficient_data',
      weighIns: 2,
    });
    // Trois pesées sur moins de 14 jours
    expect(
      estimateExpenditure(days, [daysAgo(10), daysAgo(5), daysAgo(0)].map((date) => ({ date, weight_kg: 80 })), TODAY)
    ).toMatchObject({ status: 'insufficient_data', weightSpanDays: 10 });
  });

  it('signale une estimation invraisemblable (journal probablement incomplet)', () => {
    // 800 kcal/j saisies et poids stable : dépense « 800 kcal/j » → non fiable
    const { days, weights } = scenario(800, 0);
    expect(estimateExpenditure(days, weights, TODAY).status).toBe('unreliable');
  });
});
