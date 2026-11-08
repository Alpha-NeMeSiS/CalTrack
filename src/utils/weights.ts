// Calculs sur le journal de pesées (fonctions pures, testables).
import { addDaysToDateString } from './date';

export interface WeightPoint {
  date: string; // YYYY-MM-DD
  weight_kg: number;
}

/** Pesées triées par date croissante, valeurs numériques garanties. */
export function sortWeights<T extends WeightPoint>(points: readonly T[]): T[] {
  return [...points]
    .filter((p) => Number.isFinite(Number(p.weight_kg)) && Number(p.weight_kg) > 0)
    .map((p) => ({ ...p, weight_kg: Number(p.weight_kg) }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Dernière pesée (la plus récente), ou null. */
export function getLatestWeight<T extends WeightPoint>(points: readonly T[]): T | null {
  const sorted = sortWeights(points);
  return sorted.length > 0 ? sorted[sorted.length - 1] : null;
}

/**
 * Moyenne glissante sur `windowDays` jours (pesées des N derniers jours
 * calendaires, jour courant inclus). Lisse les variations d'eau quotidiennes.
 */
export function movingAverage(points: readonly WeightPoint[], windowDays = 7): WeightPoint[] {
  const sorted = sortWeights(points);
  return sorted.map((point) => {
    const from = addDaysToDateString(point.date, -(windowDays - 1));
    const inWindow = sorted.filter((p) => p.date >= from && p.date <= point.date);
    const avg = inWindow.reduce((sum, p) => sum + p.weight_kg, 0) / inWindow.length;
    return { date: point.date, weight_kg: Math.round(avg * 10) / 10 };
  });
}

/**
 * Évolution du poids sur une période : différence entre la dernière pesée et
 * la première pesée de la période. null si moins de 2 pesées.
 */
export function weightChangeSince(points: readonly WeightPoint[], fromDate: string): number | null {
  const inPeriod = sortWeights(points).filter((p) => p.date >= fromDate);
  if (inPeriod.length < 2) return null;
  return Math.round((inPeriod[inPeriod.length - 1].weight_kg - inPeriod[0].weight_kg) * 10) / 10;
}
