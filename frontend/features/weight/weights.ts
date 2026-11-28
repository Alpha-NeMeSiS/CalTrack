// Calculs sur le journal de pesées (fonctions pures, testables).
import { addDaysToDateString } from '../../shared/date';

/** Moment de la pesée : le matin à jeun (référence) ou plus tard dans la journée */
export type WeighInMoment = 'morning' | 'later';

export interface WeightPoint {
  date: string; // YYYY-MM-DD
  weight_kg: number;
  /** Absent ou null (anciennes pesées) : pesée du matin */
  moment?: WeighInMoment | null;
}

/**
 * Une pesée « plus tard » compte dans le suivi seulement s'il n'y a aucune
 * pesée du matin dans les 14 jours qui la précèdent (quelqu'un qui se pèse
 * toujours le soir garde ainsi un suivi).
 */
export const REFERENCE_FALLBACK_DAYS = 14;

/** Moment d'une pesée ; une pesée sans moment compte comme une pesée du matin. */
export function momentOf(point: { moment?: WeighInMoment | null }): WeighInMoment {
  return point.moment === 'later' ? 'later' : 'morning';
}

/** Pesées triées par date croissante, valeurs numériques garanties. */
export function sortWeights<T extends WeightPoint>(points: readonly T[]): T[] {
  return [...points]
    .filter((p) => Number.isFinite(Number(p.weight_kg)) && Number(p.weight_kg) > 0)
    .map((p) => ({ ...p, weight_kg: Number(p.weight_kg) }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Pesées qui servent au suivi (profil, besoins, courbe, dépense réelle),
 * triées par date : celles du matin, et les pesées « plus tard » sans pesée
 * du matin dans les 14 jours qui les précèdent. Le poids varie d'un à deux
 * kilos dans la journée : mélanger les deux fausserait la tendance.
 */
export function referenceWeights<T extends WeightPoint>(points: readonly T[]): T[] {
  const sorted = sortWeights(points);
  const morningDates = sorted.filter((p) => momentOf(p) === 'morning').map((p) => p.date);
  return sorted.filter((point) => {
    if (momentOf(point) === 'morning') return true;
    const from = addDaysToDateString(point.date, -REFERENCE_FALLBACK_DAYS);
    return !morningDates.some((date) => date >= from && date < point.date);
  });
}

/**
 * Moment proposé d'office dans la carte « Ma pesée » : aujourd'hui, selon
 * l'heure (avant midi : matin) ; un jour passé, le moment de la pesée de ce
 * jour s'il y en a une, sinon le matin.
 */
export function suggestMoment({
  isToday,
  hour,
  existing,
}: {
  isToday: boolean;
  hour: number;
  existing?: { moment?: WeighInMoment | null } | null;
}): WeighInMoment {
  if (isToday) return hour < 12 ? 'morning' : 'later';
  return existing ? momentOf(existing) : 'morning';
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
