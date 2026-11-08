// Logique métier "pure" des objectifs (aucun appel réseau) : facilement testable.
// Les accès Supabase correspondants sont dans src/services/goals.ts.
import { calculateCompleteTargets, MacroTargets, UserProfile } from './calculations';
import { addDaysToDateString, timestampToLocalDateString } from './date';

export const DEFAULT_PROTEIN_G_PER_KG = 2.0;
export const DEFAULT_FAT_G_PER_KG_MIN = 0.8;
export const DEFAULT_FIBER_G = 25;

export type GoalType = 'loss' | 'maintain' | 'gain';
export type BmrMethod = 'mifflin' | 'katch';

/** Champs d'un objectif nécessaires aux calculs (sous-ensemble de la table `goals`). */
export interface GoalLike {
  id: string;
  type: GoalType;
  activity_level: number;
  method: BmrMethod;
  deficit_or_surplus_pct: number;
  protein_g_per_kg: number;
  fat_g_per_kg_min: number;
  start_date?: string | null;
  end_date?: string | null;
  created_at?: string | null;
}

/** Données saisies par l'utilisateur pour créer un objectif. */
export interface GoalInput {
  type: GoalType;
  activity_level: number;
  deficit_or_surplus_pct: number;
  target_weight_kg?: number | null;
  duration_weeks?: number | null;
  /** Protéines en g par kg de poids de référence (2 g/kg par défaut) */
  protein_g_per_kg?: number | null;
}

export interface GoalInsertPayload {
  user_id: string;
  type: GoalType;
  activity_level: number;
  method: BmrMethod;
  deficit_or_surplus_pct: number;
  protein_g_per_kg: number;
  fat_g_per_kg_min: number;
  is_active: boolean;
  target_weight_kg: number | null;
  /** Poids au moment de la création, pour mesurer l'évolution réelle */
  start_weight_kg: number | null;
  duration_weeks: number | null;
  start_date: string;
  end_date: string | null;
}

export interface DailyTargetPayload {
  user_id: string;
  date: string;
  calories_kcal: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
  fiber_g: number;
  goal_id: string;
}

/** Katch-McArdle si le taux de masse grasse est connu, sinon Mifflin-St Jeor. */
export function chooseBmrMethod(profile: Pick<UserProfile, 'body_fat_pct'>): BmrMethod {
  return profile.body_fat_pct != null && profile.body_fat_pct > 0 ? 'katch' : 'mifflin';
}

/** Date de fin = début + N semaines (en jours calendaires locaux). */
export function computeGoalEndDate(startDate: string, durationWeeks?: number | null): string | null {
  if (!durationWeeks || durationWeeks <= 0) {
    return null;
  }
  return addDaysToDateString(startDate, Math.round(durationWeeks * 7));
}

/**
 * Construit la ligne à insérer dans `goals`.
 * `start_date` est désormais TOUJOURS renseignée (même sans durée) afin que
 * l'objectif couvre tous les jours suivants.
 */
export function buildGoalInsertPayload(
  userId: string,
  profile: Pick<UserProfile, 'body_fat_pct' | 'poids_kg'>,
  input: GoalInput,
  today: string
): GoalInsertPayload {
  const isMaintain = input.type === 'maintain';
  const durationWeeks = input.duration_weeks && input.duration_weeks > 0 ? Math.round(input.duration_weeks) : null;
  // Un objectif de maintien n'a ni poids cible ni déficit/surplus : on ignore les
  // valeurs restées dans le formulaire après un changement de type d'objectif.
  const targetWeight =
    !isMaintain && input.target_weight_kg && input.target_weight_kg > 0 ? input.target_weight_kg : null;

  return {
    user_id: userId,
    type: input.type,
    activity_level: input.activity_level,
    method: chooseBmrMethod(profile),
    deficit_or_surplus_pct: isMaintain ? 0 : input.deficit_or_surplus_pct,
    protein_g_per_kg:
      input.protein_g_per_kg && input.protein_g_per_kg > 0 ? input.protein_g_per_kg : DEFAULT_PROTEIN_G_PER_KG,
    fat_g_per_kg_min: DEFAULT_FAT_G_PER_KG_MIN,
    is_active: true,
    target_weight_kg: targetWeight,
    start_weight_kg: Number.isFinite(profile.poids_kg) && profile.poids_kg > 0 ? profile.poids_kg : null,
    duration_weeks: durationWeeks,
    start_date: today,
    end_date: computeGoalEndDate(today, durationWeeks),
  };
}

/**
 * Date de début effective d'un objectif.
 * Les anciens objectifs sans durée n'avaient pas de `start_date` : on se rabat
 * alors sur la date (locale) de création.
 */
export function getGoalStartDate(goal: Pick<GoalLike, 'start_date' | 'created_at'>): string | null {
  if (goal.start_date) {
    return goal.start_date;
  }
  if (goal.created_at) {
    return timestampToLocalDateString(goal.created_at);
  }
  return null;
}

/**
 * Indique si un objectif s'applique à une date donnée.
 * Un objectif sans date de fin (ex : maintien) couvre tous les jours à partir
 * de son début.
 */
export function isDateWithinGoal(
  goal: Pick<GoalLike, 'start_date' | 'end_date' | 'created_at'> | null | undefined,
  date: string
): boolean {
  if (!goal) {
    return false;
  }

  const start = getGoalStartDate(goal);
  if (!start || date < start) {
    return false;
  }

  return !goal.end_date || date <= goal.end_date;
}

/** L'objectif a démarré à cette date (ou avant). */
export function hasGoalStarted(
  goal: Pick<GoalLike, 'start_date' | 'created_at'> | null | undefined,
  date: string
): boolean {
  const start = goal ? getGoalStartDate(goal) : null;
  return Boolean(start && start <= date);
}

/** L'objectif est terminé à cette date (sa date de fin est passée). */
export function isGoalEndedOn(goal: Pick<GoalLike, 'end_date'> | null | undefined, date: string): boolean {
  return Boolean(goal?.end_date && date > goal.end_date);
}

/**
 * Paramètres réellement appliqués à une date : après la date de fin d'un
 * objectif de perte ou de prise, on passe en MAINTIEN (même niveau d'activité,
 * déficit nul) au lieu de bloquer le suivi.
 */
export function getEffectiveGoal<T extends GoalLike>(goal: T, date: string): T {
  if (goal.type !== 'maintain' && isGoalEndedOn(goal, date)) {
    return { ...goal, type: 'maintain', deficit_or_surplus_pct: 0 };
  }
  return goal;
}

/**
 * Retourne l'objectif EN VIGUEUR à une date : le plus récent ayant démarré ce
 * jour-là ou avant.
 *
 * - Fonctionne aussi pour les jours passés : après un changement d'objectif,
 *   la veille reste couverte par l'ancien objectif.
 * - Un objectif terminé reste « en vigueur » : ses journées sont suivies en
 *   maintien (voir getEffectiveGoal). Auparavant, après la date de fin, plus
 *   aucune saisie n'était possible avant d'avoir créé un nouvel objectif.
 */
export function findGoalForDate<T extends Pick<GoalLike, 'start_date' | 'end_date' | 'created_at'>>(
  goals: readonly T[],
  date: string
): T | null {
  let best: { goal: T; start: string; createdAt: string } | null = null;

  for (const goal of goals) {
    const start = getGoalStartDate(goal);
    if (!start || start > date) continue;

    const createdAt = goal.created_at ?? '';
    // Le plus récent gagne : date de début la plus tardive, puis création la plus récente
    if (!best || start > best.start || (start === best.start && createdAt > best.createdAt)) {
      best = { goal, start, createdAt };
    }
  }

  return best ? best.goal : null;
}

/** Calcule calories et macros d'un objectif à partir du profil courant. */
export function computeTargetsForGoal(profile: UserProfile, goal: GoalLike): MacroTargets {
  return calculateCompleteTargets(profile, {
    type: goal.type,
    activity_level: goal.activity_level,
    method: goal.method,
    deficit_or_surplus_pct: goal.deficit_or_surplus_pct,
    protein_g_per_kg: goal.protein_g_per_kg,
    fat_g_per_kg_min: goal.fat_g_per_kg_min,
  });
}

/**
 * Construit la ligne `daily_targets` d'une date pour un objectif donné
 * (en maintien si la date est postérieure à la fin de l'objectif).
 */
export function buildDailyTargetPayload(
  userId: string,
  date: string,
  profile: UserProfile,
  goal: GoalLike
): DailyTargetPayload {
  const targets = computeTargetsForGoal(profile, getEffectiveGoal(goal, date));
  return {
    user_id: userId,
    date,
    calories_kcal: targets.calories_kcal,
    protein_g: targets.protein_g,
    fat_g: targets.fat_g,
    carbs_g: targets.carbs_g,
    fiber_g: targets.fiber_g ?? DEFAULT_FIBER_G,
    goal_id: goal.id,
  };
}
