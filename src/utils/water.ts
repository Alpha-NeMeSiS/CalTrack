// Suivi de l'eau : objectif (automatique d'après le poids ou manuel), total
// et progression du jour, résumé sur 7 jours, litres à la française.
import type { WaterLog } from '../lib/supabase';
import { addDaysToDateString } from './date';
import { formatDecimal } from './format';

export const WATER_LIMITS = {
  /** Prise d'eau : de 1 à 3 000 ml */
  amountMax: 3000,
  /** Objectif manuel : de 0,5 à 6 L */
  goalMin: 500,
  goalMax: 6000,
  /** Objectif automatique : 30 ml par kg, entre 1,5 et 4 L, 2 L sans poids */
  autoMin: 1500,
  autoMax: 4000,
  mlPerKg: 30,
  fallback: 2000,
} as const;

/** Prises rapides de la carte « Eau » (verre, bouteille) */
export const QUICK_WATER_AMOUNTS = [250, 500] as const;

export function autoWaterGoal(weightKg?: number | null): number {
  if (!weightKg || !Number.isFinite(weightKg) || weightKg <= 0) return WATER_LIMITS.fallback;
  const goal = Math.round((weightKg * WATER_LIMITS.mlPerKg) / 100) * 100;
  return Math.min(WATER_LIMITS.autoMax, Math.max(WATER_LIMITS.autoMin, goal));
}

/** Objectif du jour : manuel s'il est renseigné, sinon automatique */
export function waterGoal(goalMl: number | null, weightKg?: number | null): number {
  return goalMl ?? autoWaterGoal(weightKg);
}

export function waterTotal(logs: readonly Pick<WaterLog, 'amount_ml'>[]): number {
  return logs.reduce((sum, log) => sum + log.amount_ml, 0);
}

export function waterProgress(totalMl: number, goalMl: number) {
  const ratio = goalMl > 0 ? totalMl / goalMl : 0;
  const percent = Math.round(ratio * 100);
  return {
    percent,
    barPercent: Math.min(100, percent),
    remainingMl: Math.max(0, goalMl - totalMl),
    reached: totalMl >= goalMl,
  };
}

/** Prise la plus récente (celle que « Annuler le dernier » retire) */
export function lastWaterLog(logs: readonly WaterLog[]): WaterLog | undefined {
  return logs.reduce<WaterLog | undefined>((last, log) => (!last || log.created_at > last.created_at ? log : last), undefined);
}

/**
 * Résumé des 7 jours avant `today` (aujourd'hui exclu, comme les autres
 * chiffres de Tendances) : moyenne des jours notés, arrondie aux 50 ml, et
 * nombre de jours atteignant l'objectif actuel.
 */
export function weeklyWaterSummary(logs: readonly WaterLog[], goalMl: number, today: string, periodDays = 7) {
  const from = addDaysToDateString(today, -periodDays);
  const totals = new Map<string, number>();
  for (const log of logs) {
    if (log.date >= from && log.date < today) totals.set(log.date, (totals.get(log.date) ?? 0) + log.amount_ml);
  }
  const days = [...totals.values()];
  const average = days.length > 0 ? Math.round(days.reduce((a, b) => a + b, 0) / days.length / 50) * 50 : null;
  return {
    averageMl: average,
    loggedDays: days.length,
    daysAtGoal: days.filter((total) => total >= goalMl).length,
  };
}

/** 500 → « 0,5 L » ; 1 250 → « 1,25 L » ; 2 400 → « 2,4 L » */
export function formatLiters(ml: number): string {
  return `${formatDecimal(ml / 1000, 2)} L`;
}

/** « 2,5 » ou « 2.5 » (litres) → 2 500 ml ; NaN si la saisie n'est pas un nombre */
export function parseLiters(text: string): number {
  const value = text.trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(value)) return Number.NaN;
  return Math.round(Number(value) * 1000);
}

export function validateWaterAmount(ml: number): string | null {
  return Number.isInteger(ml) && ml >= 1 && ml <= WATER_LIMITS.amountMax ? null : 'Indiquez une quantité entre 1 et 3 000 ml.';
}

export function validateWaterGoal(goalMl: number | null): string | null {
  if (goalMl === null) return null;
  return Number.isFinite(goalMl) && goalMl >= WATER_LIMITS.goalMin && goalMl <= WATER_LIMITS.goalMax
    ? null
    : 'L’objectif d’eau doit être compris entre 0,5 et 6 L.';
}
