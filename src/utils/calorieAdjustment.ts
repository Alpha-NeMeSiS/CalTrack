// Ajustement des calories d'après la dépense réelle (fonctions pures).
//
// La cible quotidienne vient d'une formule (métabolisme de base × activité,
// puis déficit ou surplus de l'objectif). La dépense réelle, estimée à partir
// des repas saisis et de l'évolution du poids (estimateExpenditure), peut s'en
// écarter. Si l'écart dépasse 100 kcal/j, on propose de corriger la cible :
// par pas de 300 kcal au plus, jamais sous le plancher de sécurité, et au plus
// une fois par semaine. L'utilisateur accepte ou non (goals.calorie_adjustment_kcal).
import { calculateBMR, calculateTargetCalories, calculateTDEE, getCalorieFloor, UserProfile } from './calculations';
import { chooseBmrMethod, computeTargetsForGoal, GoalLike } from './goals';
import type { ExpenditureEstimate } from './insights';

/** Écart minimal entre la cible et la cible « idéale » pour proposer un ajustement */
export const ADJUSTMENT_THRESHOLD_KCAL = 100;
/** Changement maximal proposé en une fois */
export const ADJUSTMENT_MAX_STEP_KCAL = 300;
/** Ajustement cumulé maximal (contrainte de la base) */
export const ADJUSTMENT_LIMIT_KCAL = 1000;
/** Délai minimal entre deux ajustements */
export const ADJUSTMENT_COOLDOWN_DAYS = 7;
/** En dessous, un changement n'a pas d'intérêt (plancher atteint, limite…) */
const MIN_EFFECTIVE_STEP_KCAL = 50;

/** Clé de stockage local : proposition écartée pour cet objectif (date de l'écart) */
export const dismissKey = (goalId: string) => `caltrack:calorie-adjustment-dismissed:${goalId}`;

export interface CalorieAdjustmentSuggestion {
  /** 'more' : manger plus ; 'less' : manger moins */
  direction: 'more' | 'less';
  currentTargetKcal: number;
  proposedTargetKcal: number;
  deltaKcal: number;
  /** Nouvelle valeur de goals.calorie_adjustment_kcal */
  newAdjustmentKcal: number;
  /** Dépense réelle estimée (kcal/j) */
  expenditureKcal: number;
  /** Évolution observée du poids (kg/semaine) */
  weeklyChangeKg: number;
}

type AdjustableGoal = GoalLike & { calorie_adjustment_at?: string | null };

const clamp = (value: number, limit: number) => Math.max(-limit, Math.min(limit, value));
const round10 = (value: number) => Math.round(value / 10) * 10;

export function suggestCalorieAdjustment({
  profile,
  goal,
  expenditure,
  now = new Date(),
}: {
  profile: UserProfile;
  goal: AdjustableGoal;
  expenditure: ExpenditureEstimate;
  now?: Date;
}): CalorieAdjustmentSuggestion | null {
  if (expenditure.status !== 'ok') return null;

  if (goal.calorie_adjustment_at) {
    const elapsedDays = (now.getTime() - new Date(goal.calorie_adjustment_at).getTime()) / 86_400_000;
    if (elapsedDays < ADJUSTMENT_COOLDOWN_DAYS) return null;
  }

  const pct = goal.type === 'maintain' ? 0 : Number(goal.deficit_or_surplus_pct);
  const bmr = calculateBMR(profile, chooseBmrMethod(profile));
  // Calories de la formule, sans ajustement ni plancher
  const formulaKcal = calculateTargetCalories(calculateTDEE(bmr, Number(goal.activity_level)), goal.type, pct);
  const currentKcal = computeTargetsForGoal(profile, goal).calories_kcal;
  // Même déficit ou surplus, appliqué à la dépense réelle
  const idealKcal = calculateTargetCalories(expenditure.expenditureKcal, goal.type, pct);

  const gap = idealKcal - currentKcal;
  if (Math.abs(gap) < ADJUSTMENT_THRESHOLD_KCAL) return null;

  const floor = getCalorieFloor(profile, bmr);
  const wanted = Math.max(floor, currentKcal + clamp(round10(gap), ADJUSTMENT_MAX_STEP_KCAL));
  const newAdjustmentKcal = clamp(wanted - formulaKcal, ADJUSTMENT_LIMIT_KCAL);
  const proposedKcal = Math.max(floor, formulaKcal + newAdjustmentKcal);
  const deltaKcal = proposedKcal - currentKcal;
  if (Math.abs(deltaKcal) < MIN_EFFECTIVE_STEP_KCAL) return null;

  return {
    direction: deltaKcal > 0 ? 'more' : 'less',
    currentTargetKcal: currentKcal,
    proposedTargetKcal: proposedKcal,
    deltaKcal,
    newAdjustmentKcal,
    expenditureKcal: expenditure.expenditureKcal,
    weeklyChangeKg: expenditure.weeklyWeightChangeKg,
  };
}
