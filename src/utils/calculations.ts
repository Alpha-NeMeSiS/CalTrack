import { parseLocalDate, toLocalDateString } from './date';

export interface UserProfile {
  sexe: 'M' | 'F';
  date_naissance: string;
  taille_cm: number;
  poids_kg: number;
  body_fat_pct?: number | null;
}

export interface GoalParams {
  type: 'loss' | 'maintain' | 'gain';
  activity_level: number;
  method: 'mifflin' | 'katch';
  deficit_or_surplus_pct: number;
  protein_g_per_kg: number;
  fat_g_per_kg_min: number;
  target_weight_kg?: number;
  duration_weeks?: number;
  start_date?: string;
}

export interface MacroTargets {
  calories_kcal: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
  fiber_g?: number;
  /** true si les calories ont été relevées au plancher de sécurité (voir getCalorieFloor) */
  calorie_floor_applied?: boolean;
}

// --- Règles nutritionnelles (V2) -------------------------------------------

/** Plancher calorique absolu couramment recommandé, par sexe (kcal/jour). */
export const MIN_CALORIES_BY_SEX = { F: 1200, M: 1500 } as const;

/** IMC au-delà duquel les protéines/lipides sont calculés sur un poids de référence. */
export const REFERENCE_BMI = 25;

/** Fibres recommandées : 14 g pour 1 000 kcal, bornées. */
export const FIBER_G_PER_1000_KCAL = 14;
export const FIBER_MIN_G = 20;
export const FIBER_MAX_G = 40;

/** Rythme maximal raisonnable, en % du poids par semaine. */
export const MAX_WEEKLY_LOSS_PCT = 1;
export const MAX_WEEKLY_GAIN_PCT = 0.5;

/** Énergie approximative d'un kilo de masse corporelle (kcal). */
export const KCAL_PER_KG_BODY_WEIGHT = 7700;

/**
 * Calories minimales d'un objectif : jamais sous le métabolisme de base, ni
 * sous 1 200 kcal (femme) / 1 500 kcal (homme).
 */
export function getCalorieFloor(profile: Pick<UserProfile, 'sexe'>, bmr: number): number {
  const absoluteMin = MIN_CALORIES_BY_SEX[profile.sexe] ?? MIN_CALORIES_BY_SEX.F;
  return Math.round(Math.max(absoluteMin, Number.isFinite(bmr) ? bmr : 0));
}

/**
 * Poids de référence pour les protéines et lipides minimaux.
 * Au-delà d'un IMC de 25, on utilise le poids correspondant à un IMC de 25 :
 * 2 g/kg sur 120 kg (240 g/jour) n'a pas de sens pour une personne en surpoids.
 */
export function calculateReferenceWeight(profile: Pick<UserProfile, 'poids_kg' | 'taille_cm'>): number {
  const heightM = profile.taille_cm / 100;
  if (!(heightM > 0)) return profile.poids_kg;
  const weightAtReferenceBmi = REFERENCE_BMI * heightM * heightM;
  return Math.min(profile.poids_kg, Math.round(weightAtReferenceBmi * 10) / 10);
}

/** Fibres recommandées pour un apport calorique donné. */
export function calculateFiberTarget(calories: number): number {
  const fiber = Math.round((FIBER_G_PER_1000_KCAL * calories) / 1000);
  return Math.min(FIBER_MAX_G, Math.max(FIBER_MIN_G, Number.isFinite(fiber) ? fiber : FIBER_MIN_G));
}

export interface GoalPaceAssessment {
  /** Changement de poids hebdomadaire demandé (kg, valeur absolue) */
  weekly_change_kg: number;
  /** Même valeur en % du poids actuel */
  weekly_change_pct: number;
  /** Rythme maximal recommandé (kg/semaine) */
  max_weekly_change_kg: number;
  /** Le rythme demandé dépasse le maximum recommandé */
  is_too_fast: boolean;
  /** Durée minimale réaliste pour atteindre la cible (semaines entières) */
  recommended_min_weeks: number;
}

/**
 * Évalue le rythme d'un objectif de poids : au-delà de 1 %/semaine en perte
 * (0,5 % en prise), l'objectif est jugé trop rapide et une durée réaliste est proposée.
 */
export function assessGoalPace(
  currentWeight: number,
  targetWeight: number,
  durationWeeks: number,
  goalType: 'loss' | 'gain'
): GoalPaceAssessment {
  const totalChange = Math.abs(targetWeight - currentWeight);
  const weeks = durationWeeks > 0 ? durationWeeks : 1;
  const weeklyChange = totalChange / weeks;
  const maxPct = goalType === 'loss' ? MAX_WEEKLY_LOSS_PCT : MAX_WEEKLY_GAIN_PCT;
  const maxWeekly = (currentWeight * maxPct) / 100;

  return {
    weekly_change_kg: Math.round(weeklyChange * 100) / 100,
    weekly_change_pct: currentWeight > 0 ? Math.round((weeklyChange / currentWeight) * 1000) / 10 : 0,
    max_weekly_change_kg: Math.round(maxWeekly * 100) / 100,
    is_too_fast: maxWeekly > 0 && weeklyChange > maxWeekly + 1e-9,
    recommended_min_weeks: maxWeekly > 0 ? Math.ceil(totalChange / maxWeekly) : weeks,
  };
}

export function calculateAge(dateNaissance: string, today: Date = new Date()): number {
  // parseLocalDate évite le décalage UTC de new Date('YYYY-MM-DD')
  const birthDate = parseLocalDate(dateNaissance);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }

  return age;
}

export function calculateBMR(profile: UserProfile, method: 'mifflin' | 'katch' = 'mifflin'): number {
  const { sexe, date_naissance, taille_cm, poids_kg, body_fat_pct } = profile;
  const age = calculateAge(date_naissance);

  if (method === 'katch' && body_fat_pct !== undefined && body_fat_pct !== null) {
    const lbm = poids_kg * (1 - body_fat_pct / 100);
    return 370 + 21.6 * lbm;
  }

  if (sexe === 'M') {
    return 10 * poids_kg + 6.25 * taille_cm - 5 * age + 5;
  } else {
    return 10 * poids_kg + 6.25 * taille_cm - 5 * age - 161;
  }
}

export function calculateTDEE(bmr: number, activityLevel: number): number {
  return bmr * activityLevel;
}

export function calculateTargetCalories(tdee: number, goalType: 'loss' | 'maintain' | 'gain', deficitOrSurplusPct: number): number {
  if (goalType === 'maintain') {
    return Math.round(tdee);
  }

  if (goalType === 'loss') {
    const deficit = Math.abs(deficitOrSurplusPct) / 100;
    return Math.round(tdee * (1 - deficit));
  }

  const surplus = Math.abs(deficitOrSurplusPct) / 100;
  return Math.round(tdee * (1 + surplus));
}

/**
 * Répartition des macros.
 * @param referenceWeightKg poids sur lequel sont calculés protéines et lipides
 *   minimaux (voir calculateReferenceWeight).
 */
export function calculateMacros(
  targetCalories: number,
  referenceWeightKg: number,
  protein_g_per_kg: number,
  fat_g_per_kg_min: number
): MacroTargets {
  // Utilise la valeur demandée (auparavant un plancher caché de 1.6 g/kg l'écrasait)
  const protein_g = protein_g_per_kg * referenceWeightKg;

  const minFatFromWeight = fat_g_per_kg_min * referenceWeightKg;
  const minFatFromCalories = (0.25 * targetCalories) / 9;
  const fat_g = Math.max(minFatFromWeight, minFatFromCalories);

  const remainingCalories = targetCalories - (protein_g * 4 + fat_g * 9);
  const carbs_g = Math.max(0, remainingCalories / 4);

  return {
    calories_kcal: Math.round(targetCalories),
    protein_g: Math.round(protein_g * 10) / 10,
    fat_g: Math.round(fat_g * 10) / 10,
    carbs_g: Math.round(carbs_g * 10) / 10,
    fiber_g: calculateFiberTarget(targetCalories),
  };
}

export function calculateCompleteTargets(profile: UserProfile, goal: GoalParams): MacroTargets {
  const bmr = calculateBMR(profile, goal.method);
  const tdee = calculateTDEE(bmr, goal.activity_level);
  const rawCalories = calculateTargetCalories(tdee, goal.type, goal.deficit_or_surplus_pct);

  // Garde-fou : un déficit ne doit pas descendre sous le plancher de sécurité
  const floor = getCalorieFloor(profile, bmr);
  const floorApplied = goal.type === 'loss' && rawCalories < floor;
  const targetCalories = floorApplied ? floor : rawCalories;

  const macros = calculateMacros(
    targetCalories,
    calculateReferenceWeight(profile),
    goal.protein_g_per_kg,
    goal.fat_g_per_kg_min
  );
  return floorApplied ? { ...macros, calorie_floor_applied: true } : macros;
}

export interface DailySummary {
  date: string;
  consumed: {
    calories_kcal: number;
    protein_g: number;
    fat_g: number;
    carbs_g: number;
    fiber_g: number;
  };
  target: {
    calories_kcal: number;
    protein_g: number;
    fat_g: number;
    carbs_g: number;
    fiber_g?: number;
  };
  delta: {
    calories_kcal: number;
    protein_g: number;
    fat_g: number;
    carbs_g: number;
    fiber_g: number;
  };
  status: 'under' | 'ok' | 'over';
}

export function calculateDailySummary(
  entries: Array<{ kcal: number; protein_g: number; fat_g: number; carbs_g: number; fiber_g?: number }>,
  target: { calories_kcal: number; protein_g: number; fat_g: number; carbs_g: number; fiber_g?: number },
  date: string
): DailySummary {
  const consumed = entries.reduce(
    (acc, entry) => ({
      calories_kcal: acc.calories_kcal + entry.kcal,
      protein_g: acc.protein_g + entry.protein_g,
      fat_g: acc.fat_g + entry.fat_g,
      carbs_g: acc.carbs_g + entry.carbs_g,
      fiber_g: acc.fiber_g + (entry.fiber_g || 0),
    }),
    { calories_kcal: 0, protein_g: 0, fat_g: 0, carbs_g: 0, fiber_g: 0 }
  );

  const delta = {
    calories_kcal: Math.round((consumed.calories_kcal - target.calories_kcal) * 10) / 10,
    protein_g: Math.round((consumed.protein_g - target.protein_g) * 10) / 10,
    fat_g: Math.round((consumed.fat_g - target.fat_g) * 10) / 10,
    carbs_g: Math.round((consumed.carbs_g - target.carbs_g) * 10) / 10,
    fiber_g: Math.round((consumed.fiber_g - (target.fiber_g || 0)) * 10) / 10,
  };

  let status: 'under' | 'ok' | 'over' = 'ok';
  if (target.calories_kcal > 0) {
    const caloriesDiffPct = (Math.abs(delta.calories_kcal) / target.calories_kcal) * 100;
    if (caloriesDiffPct > 5) {
      status = delta.calories_kcal < 0 ? 'under' : 'over';
    }
  } else if (consumed.calories_kcal > 0) {
    // Objectif nul (ou invalide) : évite une division par zéro (NaN / Infinity)
    status = 'over';
  }

  return {
    date,
    consumed: {
      calories_kcal: Math.round(consumed.calories_kcal),
      protein_g: Math.round(consumed.protein_g * 10) / 10,
      fat_g: Math.round(consumed.fat_g * 10) / 10,
      carbs_g: Math.round(consumed.carbs_g * 10) / 10,
      fiber_g: Math.round(consumed.fiber_g * 10) / 10,
    },
    target,
    delta,
    status,
  };
}

export function getActivityLevelLabel(level: number): string {
  if (level <= 1.2) return 'Sédentaire (peu ou pas d\'exercice)';
  if (level <= 1.375) return 'Légèrement actif (1-3 jours/semaine)';
  if (level <= 1.55) return 'Modérément actif (3-5 jours/semaine)';
  if (level <= 1.725) return 'Très actif (6-7 jours/semaine)';
  return 'Extrêmement actif (2x par jour)';
}

export function getGoalTypeLabel(type: 'loss' | 'maintain' | 'gain'): string {
  switch (type) {
    case 'loss':
      return 'Perte de poids';
    case 'maintain':
      return 'Maintien';
    case 'gain':
      return 'Prise de masse';
  }
}

export interface GoalProgress {
  current_weight: number;
  target_weight: number;
  /** Poids de départ utilisé pour le calcul (poids actuel si inconnu) */
  start_weight: number;
  /** Évolution réelle depuis le départ (négative = perte), arrondie à 0,1 kg */
  actual_weight_change: number;
  /** Part du chemin parcouru vers le poids cible, de 0 à 100 % */
  weight_progress_pct: number;
  /** Le poids cible est atteint (ou dépassé dans le bon sens) */
  goal_reached: boolean;
  /** Changement de poids restant pour atteindre la cible */
  weight_change: number;
  weight_change_pct: number;
  weeks_elapsed: number;
  weeks_remaining: number;
  weeks_total: number;
  progress_pct: number;
  weekly_rate_target: number;
  weekly_rate_actual?: number;
  on_track: boolean;
  estimated_end_date: string;
}

/**
 * Calcule la progression d'un objectif de poids.
 *
 * @param startWeight Poids au début de l'objectif (colonne goals.start_weight_kg).
 *   S'il est inconnu (anciens objectifs), on utilise le poids actuel : aucune
 *   évolution n'est alors mesurée.
 * @param today Date de référence (injectable pour les tests).
 */
export function calculateGoalProgress(
  currentWeight: number,
  targetWeight: number,
  durationWeeks: number,
  startDate: string,
  goalType: 'loss' | 'gain',
  startWeight: number = currentWeight,
  today: Date = new Date()
): GoalProgress {
  const start = parseLocalDate(startDate);
  // Protège contre une durée nulle/négative (division par zéro)
  const safeDuration = durationWeeks > 0 ? durationWeeks : 1;

  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const weeksElapsed = Math.max(0, Math.floor((today.getTime() - start.getTime()) / msPerWeek));
  const weeksRemaining = Math.max(0, safeDuration - weeksElapsed);

  // Changement restant pour atteindre l'objectif
  const remainingWeightChange = targetWeight - currentWeight;
  // Rythme cible calculé sur l'objectif global (depuis le poids de départ)
  const weeklyRateTarget = (targetWeight - startWeight) / safeDuration;

  const progressPct = Math.min(100, (weeksElapsed / safeDuration) * 100);

  const expectedWeightChange = weeklyRateTarget * weeksElapsed;
  // Bug corrigé : auparavant `currentWeight - currentWeight` (toujours 0)
  const actualWeightChange = currentWeight - startWeight;

  const goalReached = goalType === 'loss'
    ? currentWeight <= targetWeight
    : currentWeight >= targetWeight;

  // Part du changement total déjà réalisée (0 à 100 %)
  const totalWeightChange = targetWeight - startWeight;
  const weightProgressPct = totalWeightChange === 0
    ? (goalReached ? 100 : 0)
    : Math.min(100, Math.max(0, (actualWeightChange / totalWeightChange) * 100));

  // « Dans les temps » : au moins aussi avancé que prévu, avec une tolérance d'une
  // semaine de rythme. Être en avance compte comme dans les temps (auparavant,
  // l'écart était mesuré dans les deux sens), et un objectif atteint aussi.
  const tolerance = Math.abs(weeklyRateTarget);
  const onTrack = goalReached || (goalType === 'loss'
    ? actualWeightChange <= expectedWeightChange + tolerance
    : actualWeightChange >= expectedWeightChange - tolerance);

  const estimatedEndDate = new Date(start);
  estimatedEndDate.setDate(estimatedEndDate.getDate() + safeDuration * 7);

  return {
    current_weight: currentWeight,
    target_weight: targetWeight,
    start_weight: startWeight,
    actual_weight_change: Math.round(actualWeightChange * 10) / 10,
    weight_progress_pct: Math.round(weightProgressPct * 10) / 10,
    goal_reached: goalReached,
    weight_change: remainingWeightChange,
    weight_change_pct: currentWeight > 0 ? (remainingWeightChange / currentWeight) * 100 : 0,
    weeks_elapsed: weeksElapsed,
    weeks_remaining: weeksRemaining,
    weeks_total: safeDuration,
    progress_pct: Math.round(progressPct * 10) / 10,
    weekly_rate_target: Math.round(weeklyRateTarget * 100) / 100,
    on_track: onTrack,
    estimated_end_date: toLocalDateString(estimatedEndDate),
  };
}

export function calculateOptimalDeficitOrSurplus(
  currentWeight: number,
  targetWeight: number,
  durationWeeks: number,
  tdee: number,
  _goalType: 'loss' | 'gain'
): number {
  if (durationWeeks <= 0 || tdee <= 0) {
    return 5;
  }

  const totalWeightChange = Math.abs(targetWeight - currentWeight);
  const weeklyWeightChange = totalWeightChange / durationWeeks;

  const weeklyCalorieChange = weeklyWeightChange * KCAL_PER_KG_BODY_WEIGHT;
  const dailyCalorieChange = weeklyCalorieChange / 7;

  const deficitOrSurplusPct = (dailyCalorieChange / tdee) * 100;

  const minPct = 5;
  const maxPct = _goalType === 'loss' ? 25 : 20;

  return Math.max(minPct, Math.min(maxPct, Math.round(deficitOrSurplusPct)));
}
