// Indicateurs de suivi (fonctions pures, testables) :
// - moyennes et régularité sur les 7 derniers jours complets ;
// - série de jours renseignés ;
// - dépense énergétique réelle estimée à partir des apports et du poids.
import { KCAL_PER_KG_BODY_WEIGHT } from './calculations';
import { addDaysToDateString, parseLocalDate } from './date';
import type { DayStatus } from './dayStatus';
import { sortWeights, WeightPoint } from './weights';

/** Données d'une journée du journal */
export interface DayIntake {
  date: string; // YYYY-MM-DD
  entryCount: number;
  consumedKcal: number;
  consumedProteinG: number;
  /** Objectif du jour (null si aucun objectif ce jour-là) */
  targetKcal: number | null;
  targetProteinG: number | null;
  status: DayStatus | null;
}

export interface WeekInsights {
  /** Nombre de jours analysés (jours complets, aujourd'hui exclu) */
  periodDays: number;
  /** Jours avec au moins une saisie */
  loggedDays: number;
  /** Jours renseignés dans la plage de l'objectif */
  onTargetDays: number;
  avgCalories: number | null;
  avgTargetCalories: number | null;
  avgProteinG: number | null;
  avgTargetProteinG: number | null;
}

const average = (values: number[]): number | null =>
  values.length > 0 ? values.reduce((sum, v) => sum + v, 0) / values.length : null;

/**
 * Moyennes des `periodDays` derniers jours COMPLETS (hier et avant) : la journée
 * en cours, pas terminée, fausserait les moyennes. Seuls les jours renseignés
 * comptent (un jour oublié n'est pas un jour à 0 kcal).
 */
export function computeWeekInsights(days: readonly DayIntake[], today: string, periodDays = 7): WeekInsights {
  const from = addDaysToDateString(today, -periodDays);
  const logged = days.filter((d) => d.date >= from && d.date < today && d.entryCount > 0);
  const withTarget = logged.filter((d) => d.targetKcal !== null);

  return {
    periodDays,
    loggedDays: logged.length,
    onTargetDays: logged.filter((d) => d.status === 'ok').length,
    avgCalories: average(logged.map((d) => d.consumedKcal)),
    avgTargetCalories: average(withTarget.map((d) => d.targetKcal as number)),
    avgProteinG: average(logged.map((d) => d.consumedProteinG)),
    avgTargetProteinG: average(
      withTarget.filter((d) => d.targetProteinG !== null).map((d) => d.targetProteinG as number)
    ),
  };
}

/**
 * Nombre de jours consécutifs renseignés jusqu'à aujourd'hui. Si aujourd'hui
 * n'a encore aucune saisie, la série court jusqu'à hier (la journée n'est pas finie).
 */
export function computeLoggingStreak(days: readonly DayIntake[], today: string): number {
  const loggedDates = new Set(days.filter((d) => d.entryCount > 0).map((d) => d.date));
  let date = loggedDates.has(today) ? today : addDaysToDateString(today, -1);
  let streak = 0;
  while (loggedDates.has(date)) {
    streak += 1;
    date = addDaysToDateString(date, -1);
  }
  return streak;
}

// --- Dépense énergétique estimée -------------------------------------------

/** Fenêtre d'analyse (jours complets) */
export const EXPENDITURE_WINDOW_DAYS = 28;
/** Minimum de jours renseignés dans la fenêtre */
export const EXPENDITURE_MIN_LOGGED_DAYS = 14;
/** Minimum de pesées, réparties sur au moins EXPENDITURE_MIN_WEIGHT_SPAN_DAYS jours */
export const EXPENDITURE_MIN_WEIGH_INS = 3;
export const EXPENDITURE_MIN_WEIGHT_SPAN_DAYS = 14;
/** En dehors de cette plage, l'estimation est jugée non fiable (journal incomplet…) */
const PLAUSIBLE_EXPENDITURE_KCAL = { min: 1000, max: 5000 };

export type ExpenditureEstimate =
  | {
      status: 'ok';
      /** Dépense estimée (kcal/j), arrondie à 10 kcal */
      expenditureKcal: number;
      /** Apport moyen des jours renseignés (kcal/j) */
      avgIntakeKcal: number;
      /** Évolution du poids (tendance linéaire), en kg par semaine */
      weeklyWeightChangeKg: number;
      loggedDays: number;
      weighIns: number;
    }
  | {
      status: 'insufficient_data' | 'unreliable';
      loggedDays: number;
      weighIns: number;
      weightSpanDays: number;
    };

const daysBetween = (from: string, to: string) =>
  Math.round((parseLocalDate(to).getTime() - parseLocalDate(from).getTime()) / 86_400_000);

/** Pente (kg/jour) de la droite des moindres carrés passant par les pesées. */
function weightSlopePerDay(points: readonly WeightPoint[]): number {
  const origin = points[0].date;
  const xs = points.map((p) => daysBetween(origin, p.date));
  const ys = points.map((p) => p.weight_kg);
  const meanX = xs.reduce((a, b) => a + b, 0) / xs.length;
  const meanY = ys.reduce((a, b) => a + b, 0) / ys.length;
  let num = 0;
  let den = 0;
  xs.forEach((x, i) => {
    num += (x - meanX) * (ys[i] - meanY);
    den += (x - meanX) ** 2;
  });
  return den === 0 ? 0 : num / den;
}

/**
 * Dépense réelle ≈ apport moyen − variation d'énergie stockée.
 * Ex. : 2 000 kcal/j mangées et −0,5 kg/semaine → 2 000 + 0,5 × 7 700 / 7 ≈ 2 550 kcal/j.
 * La tendance du poids (régression linéaire) atténue les variations d'eau.
 * Fiable seulement si le journal est complet : un jour à moitié saisi sous-estime l'apport.
 */
export function estimateExpenditure(
  days: readonly DayIntake[],
  weights: readonly WeightPoint[],
  today: string,
  windowDays = EXPENDITURE_WINDOW_DAYS
): ExpenditureEstimate {
  const from = addDaysToDateString(today, -windowDays);
  const logged = days.filter((d) => d.date >= from && d.date < today && d.entryCount > 0);
  // La pesée du jour compte (le matin, avant les repas)
  const windowWeights = sortWeights(weights).filter((w) => w.date >= from && w.date <= today);
  const weightSpanDays =
    windowWeights.length > 1 ? daysBetween(windowWeights[0].date, windowWeights[windowWeights.length - 1].date) : 0;

  const base = { loggedDays: logged.length, weighIns: windowWeights.length, weightSpanDays };

  if (
    logged.length < EXPENDITURE_MIN_LOGGED_DAYS ||
    windowWeights.length < EXPENDITURE_MIN_WEIGH_INS ||
    weightSpanDays < EXPENDITURE_MIN_WEIGHT_SPAN_DAYS
  ) {
    return { status: 'insufficient_data', ...base };
  }

  const avgIntakeKcal = logged.reduce((sum, d) => sum + d.consumedKcal, 0) / logged.length;
  const slopeKgPerDay = weightSlopePerDay(windowWeights);
  const expenditure = avgIntakeKcal - slopeKgPerDay * KCAL_PER_KG_BODY_WEIGHT;

  if (expenditure < PLAUSIBLE_EXPENDITURE_KCAL.min || expenditure > PLAUSIBLE_EXPENDITURE_KCAL.max) {
    return { status: 'unreliable', ...base };
  }

  return {
    status: 'ok',
    expenditureKcal: Math.round(expenditure / 10) * 10,
    avgIntakeKcal: Math.round(avgIntakeKcal),
    weeklyWeightChangeKg: Math.round(slopeKgPerDay * 7 * 100) / 100,
    loggedDays: logged.length,
    weighIns: windowWeights.length,
  };
}
