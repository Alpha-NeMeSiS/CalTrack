// Validation des saisies du profil et de l'objectif (fonctions pures, testables).
//
// But : afficher un message clair AVANT l'envoi à Supabase, au lieu d'une erreur
// Postgres incompréhensible (contraintes CHECK de la base, colonne entière…).
import { assessGoalPace, calculateAge } from './calculations';
import { isDateOnlyString, parseLocalDate } from './date';
import type { GoalType } from './goals';

export const PROFILE_LIMITS = {
  taille_cm: { min: 100, max: 250 },
  poids_kg: { min: 30, max: 300 },
  body_fat_pct: { min: 3, max: 60 },
  age: { min: 10, max: 120 },
} as const;

export const GOAL_LIMITS = {
  activity_level: { min: 1.2, max: 1.9 },
  deficit_or_surplus_pct: { min: 5, max: 30 },
  target_weight_kg: { min: 30, max: 300 },
  duration_weeks: { min: 1, max: 260 },
  protein_g_per_kg: { min: 1.2, max: 2.5 },
} as const;

export interface ProfileInput {
  date_naissance: string;
  taille_cm: number;
  poids_kg: number;
  body_fat_pct?: number | null;
}

export interface GoalFormInput {
  type: GoalType;
  activity_level: number;
  deficit_or_surplus_pct: number;
  target_weight_kg?: number | null;
  duration_weeks?: number | null;
  protein_g_per_kg?: number | null;
}

const isInRange = (value: number, { min, max }: { min: number; max: number }) =>
  Number.isFinite(value) && value >= min && value <= max;

/** Une valeur optionnelle est « renseignée » si elle n'est ni vide ni nulle. */
const isProvided = (value: number | null | undefined): value is number =>
  value !== null && value !== undefined && !(typeof value === 'number' && value === 0);

/** Retourne la liste des erreurs du profil (vide si tout est valide). */
export function validateProfileInput(profile: ProfileInput, today: Date = new Date()): string[] {
  const errors: string[] = [];

  if (!profile.date_naissance || !isDateOnlyString(profile.date_naissance)) {
    errors.push('La date de naissance est requise.');
  } else {
    const birthDate = parseLocalDate(profile.date_naissance);
    if (Number.isNaN(birthDate.getTime())) {
      errors.push('La date de naissance est invalide.');
    } else if (birthDate > today) {
      errors.push('La date de naissance ne peut pas être dans le futur.');
    } else {
      const age = calculateAge(profile.date_naissance, today);
      if (!isInRange(age, PROFILE_LIMITS.age)) {
        errors.push(
          `L'âge doit être compris entre ${PROFILE_LIMITS.age.min} et ${PROFILE_LIMITS.age.max} ans.`
        );
      }
    }
  }

  if (!isInRange(profile.taille_cm, PROFILE_LIMITS.taille_cm)) {
    errors.push(
      `La taille doit être comprise entre ${PROFILE_LIMITS.taille_cm.min} et ${PROFILE_LIMITS.taille_cm.max} cm.`
    );
  }

  if (!isInRange(profile.poids_kg, PROFILE_LIMITS.poids_kg)) {
    errors.push(
      `Le poids doit être compris entre ${PROFILE_LIMITS.poids_kg.min} et ${PROFILE_LIMITS.poids_kg.max} kg.`
    );
  }

  if (isProvided(profile.body_fat_pct) && !isInRange(profile.body_fat_pct, PROFILE_LIMITS.body_fat_pct)) {
    errors.push(
      `Le taux de masse grasse doit être compris entre ${PROFILE_LIMITS.body_fat_pct.min} et ${PROFILE_LIMITS.body_fat_pct.max} %.`
    );
  }

  return errors;
}

/** Retourne la liste des erreurs de l'objectif (vide si tout est valide). */
export function validateGoalInput(goal: GoalFormInput, currentWeightKg: number): string[] {
  const errors: string[] = [];

  if (!isInRange(goal.activity_level, GOAL_LIMITS.activity_level)) {
    errors.push("Le niveau d'activité est invalide.");
  }

  if (isProvided(goal.protein_g_per_kg) && !isInRange(goal.protein_g_per_kg, GOAL_LIMITS.protein_g_per_kg)) {
    errors.push(
      `Les protéines doivent être comprises entre ${GOAL_LIMITS.protein_g_per_kg.min} et ${GOAL_LIMITS.protein_g_per_kg.max} g/kg.`
    );
  }

  if (isProvided(goal.duration_weeks)) {
    if (!Number.isInteger(goal.duration_weeks) || !isInRange(goal.duration_weeks, GOAL_LIMITS.duration_weeks)) {
      errors.push(
        `La durée doit être un nombre entier de semaines entre ${GOAL_LIMITS.duration_weeks.min} et ${GOAL_LIMITS.duration_weeks.max}.`
      );
    }
  }

  // Le déficit/surplus et le poids cible ne concernent que la perte ou la prise
  if (goal.type === 'maintain') {
    return errors;
  }

  if (!isInRange(goal.deficit_or_surplus_pct, GOAL_LIMITS.deficit_or_surplus_pct)) {
    const label = goal.type === 'loss' ? 'Le déficit' : 'Le surplus';
    errors.push(
      `${label} calorique doit être compris entre ${GOAL_LIMITS.deficit_or_surplus_pct.min} et ${GOAL_LIMITS.deficit_or_surplus_pct.max} %.`
    );
  }

  if (isProvided(goal.target_weight_kg)) {
    if (!isInRange(goal.target_weight_kg, GOAL_LIMITS.target_weight_kg)) {
      errors.push(
        `Le poids cible doit être compris entre ${GOAL_LIMITS.target_weight_kg.min} et ${GOAL_LIMITS.target_weight_kg.max} kg.`
      );
    } else if (goal.type === 'loss' && goal.target_weight_kg >= currentWeightKg) {
      errors.push('Pour une perte de poids, le poids cible doit être inférieur au poids actuel.');
    } else if (goal.type === 'gain' && goal.target_weight_kg <= currentWeightKg) {
      errors.push('Pour une prise de masse, le poids cible doit être supérieur au poids actuel.');
    }
  }

  return errors;
}

export interface GoalWarning {
  message: string;
  /** Durée réaliste proposée (semaines), si le rythme est trop rapide */
  suggestedDurationWeeks?: number;
}

/**
 * Avertissements NON bloquants sur un objectif valide : rythme trop rapide pour
 * le poids cible et la durée choisis (au-delà de 1 %/sem en perte, 0,5 % en prise).
 */
export function getGoalWarnings(goal: GoalFormInput, currentWeightKg: number): GoalWarning[] {
  if (goal.type === 'maintain' || !isProvided(goal.target_weight_kg) || !isProvided(goal.duration_weeks)) {
    return [];
  }
  if (validateGoalInput(goal, currentWeightKg).length > 0) {
    return [];
  }

  const pace = assessGoalPace(currentWeightKg, goal.target_weight_kg, goal.duration_weeks, goal.type);
  if (!pace.is_too_fast) {
    return [];
  }

  const verb = goal.type === 'loss' ? 'perdre' : 'prendre';
  return [
    {
      message:
        `Rythme trop rapide : ${verb} ${pace.weekly_change_kg} kg par semaine (${pace.weekly_change_pct} % du poids). ` +
        `Le maximum recommandé est d'environ ${pace.max_weekly_change_kg} kg par semaine, soit au moins ` +
        `${pace.recommended_min_weeks} semaines pour cet objectif.`,
      suggestedDurationWeeks: Math.min(GOAL_LIMITS.duration_weeks.max, pace.recommended_min_weeks),
    },
  ];
}
