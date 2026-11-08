// Composition corporelle saisie avec les pesées (fonctions pures) : valeurs à
// enregistrer, masse maigre / masse grasse de chaque pesée et bilan.
import type { BodyComposition, WeightLog } from '../lib/supabase';
import { estimateLeanMass, LeanMassSource } from './calculations';
import { sortWeights } from './weights';

export const COMPOSITION_FIELDS = [
  'body_fat_pct',
  'muscle_mass_kg',
  'bone_mass_kg',
  'body_water_pct',
  'visceral_fat_rating',
] as const satisfies readonly (keyof BodyComposition)[];

/** Mesures renseignées uniquement (une valeur vide ne remplace pas une mesure déjà enregistrée). */
export function pickComposition(input: BodyComposition): BodyComposition {
  const picked: BodyComposition = {};
  for (const field of COMPOSITION_FIELDS) {
    const value = input[field];
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) picked[field] = value;
  }
  return picked;
}

export const hasComposition = (input: BodyComposition) => Object.keys(pickComposition(input)).length > 0;

export interface CompositionPoint {
  date: string;
  weightKg: number;
  leanKg: number;
  fatKg: number;
  source: LeanMassSource;
}

const round1 = (value: number) => Math.round(value * 10) / 10;

/** Masse maigre et masse grasse des pesées dont la composition permet de les calculer. */
export function compositionPoints(logs: readonly WeightLog[]): CompositionPoint[] {
  return sortWeights(logs).flatMap((log) => {
    const weightKg = Number(log.weight_kg);
    const lean = estimateLeanMass({
      poids_kg: weightKg,
      body_fat_pct: log.body_fat_pct != null ? Number(log.body_fat_pct) : null,
      muscle_mass_kg: log.muscle_mass_kg != null ? Number(log.muscle_mass_kg) : null,
      bone_mass_kg: log.bone_mass_kg != null ? Number(log.bone_mass_kg) : null,
      body_water_pct: log.body_water_pct != null ? Number(log.body_water_pct) : null,
    });
    if (!lean) return [];
    return [{ date: log.date, weightKg, leanKg: lean.kg, fatKg: round1(weightKg - lean.kg), source: lean.source }];
  });
}

/** Évolution entre la première et la dernière mesure de composition. */
export function compositionChange(points: readonly CompositionPoint[]) {
  if (points.length < 2) return null;
  const first = points[0];
  const last = points[points.length - 1];
  return { since: first.date, fatKg: round1(last.fatKg - first.fatKg), leanKg: round1(last.leanKg - first.leanKg) };
}
