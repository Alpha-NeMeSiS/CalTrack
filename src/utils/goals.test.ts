import { describe, expect, it } from 'vitest';
import { calculateCompleteTargets, UserProfile } from './calculations';
import {
  buildDailyTargetPayload,
  buildGoalInsertPayload,
  chooseBmrMethod,
  computeGoalEndDate,
  computeTargetsForGoal,
  DEFAULT_FAT_G_PER_KG_MIN,
  DEFAULT_PROTEIN_G_PER_KG,
  findGoalForDate,
  getGoalStartDate,
  GoalLike,
  isDateWithinGoal,
} from './goals';

const profile: UserProfile = {
  sexe: 'F',
  date_naissance: '1990-04-20',
  taille_cm: 165,
  poids_kg: 60,
};

const maintainGoal: GoalLike = {
  id: 'goal-1',
  type: 'maintain',
  activity_level: 1.375,
  method: 'mifflin',
  deficit_or_surplus_pct: 0,
  protein_g_per_kg: 2,
  fat_g_per_kg_min: 0.8,
  start_date: '2025-01-01',
  end_date: null,
  created_at: '2025-01-01T12:00:00Z',
};

describe('chooseBmrMethod', () => {
  it('Katch si la masse grasse est renseignée, sinon Mifflin', () => {
    expect(chooseBmrMethod({ body_fat_pct: 18 })).toBe('katch');
    expect(chooseBmrMethod({ body_fat_pct: null })).toBe('mifflin');
    expect(chooseBmrMethod({ body_fat_pct: 0 })).toBe('mifflin');
    expect(chooseBmrMethod({})).toBe('mifflin');
  });
});

describe('computeGoalEndDate', () => {
  it('ajoute la durée en semaines', () => {
    expect(computeGoalEndDate('2025-01-01', 4)).toBe('2025-01-29');
  });

  it("renvoie null sans durée", () => {
    expect(computeGoalEndDate('2025-01-01', null)).toBeNull();
    expect(computeGoalEndDate('2025-01-01', undefined)).toBeNull();
    expect(computeGoalEndDate('2025-01-01', 0)).toBeNull();
  });
});

describe('buildGoalInsertPayload', () => {
  it("renseigne toujours start_date, même sans durée (régression)", () => {
    const payload = buildGoalInsertPayload(
      'user-1',
      profile,
      { type: 'maintain', activity_level: 1.55, deficit_or_surplus_pct: 0 },
      '2025-02-10'
    );

    expect(payload).toEqual({
      user_id: 'user-1',
      type: 'maintain',
      activity_level: 1.55,
      method: 'mifflin',
      deficit_or_surplus_pct: 0,
      protein_g_per_kg: DEFAULT_PROTEIN_G_PER_KG,
      fat_g_per_kg_min: DEFAULT_FAT_G_PER_KG_MIN,
      is_active: true,
      target_weight_kg: null,
      start_weight_kg: 60, // poids du profil au moment de la création
      duration_weeks: null,
      start_date: '2025-02-10',
      end_date: null,
    });
  });

  it("enregistre le poids de départ (null s'il est invalide)", () => {
    const input = { type: 'loss' as const, activity_level: 1.2, deficit_or_surplus_pct: 15 };
    expect(buildGoalInsertPayload('u', { ...profile, poids_kg: 82.4 }, input, '2025-02-10').start_weight_kg).toBe(82.4);
    expect(buildGoalInsertPayload('u', { ...profile, poids_kg: 0 }, input, '2025-02-10').start_weight_kg).toBeNull();
    expect(buildGoalInsertPayload('u', { ...profile, poids_kg: Number.NaN }, input, '2025-02-10').start_weight_kg).toBeNull();
  });

  it('calcule la date de fin et la méthode Katch', () => {
    const payload = buildGoalInsertPayload(
      'user-1',
      { body_fat_pct: 25, poids_kg: 60 },
      { type: 'loss', activity_level: 1.2, deficit_or_surplus_pct: 15, target_weight_kg: 55, duration_weeks: 10 },
      '2025-02-10'
    );

    expect(payload.method).toBe('katch');
    expect(payload.target_weight_kg).toBe(55);
    expect(payload.duration_weeks).toBe(10);
    expect(payload.end_date).toBe('2025-04-21');
  });

  it("n'enregistre ni poids cible ni déficit pour un maintien (valeurs restées du formulaire)", () => {
    const payload = buildGoalInsertPayload(
      'user-1',
      profile,
      { type: 'maintain', activity_level: 1.2, deficit_or_surplus_pct: 15, target_weight_kg: 55, duration_weeks: 8 },
      '2025-02-10'
    );
    expect(payload.target_weight_kg).toBeNull();
    expect(payload.deficit_or_surplus_pct).toBe(0);
    expect(payload.duration_weeks).toBe(8); // la durée reste possible pour un maintien
  });

  it('ignore un poids cible ou une durée à 0', () => {
    const payload = buildGoalInsertPayload(
      'user-1',
      profile,
      { type: 'gain', activity_level: 1.2, deficit_or_surplus_pct: 10, target_weight_kg: 0, duration_weeks: 0 },
      '2025-02-10'
    );
    expect(payload.target_weight_kg).toBeNull();
    expect(payload.duration_weeks).toBeNull();
    expect(payload.end_date).toBeNull();
  });
});

describe('getGoalStartDate', () => {
  it('préfère start_date', () => {
    expect(getGoalStartDate({ start_date: '2025-03-01', created_at: '2025-01-01T12:00:00Z' })).toBe('2025-03-01');
  });

  it('se rabat sur la date de création pour les anciens objectifs', () => {
    // Timestamp construit en heure locale : le test ne dépend pas du fuseau
    const createdAt = new Date(2025, 0, 5, 23, 30).toISOString();
    expect(getGoalStartDate({ start_date: null, created_at: createdAt })).toBe('2025-01-05');
  });

  it('renvoie null sans aucune date', () => {
    expect(getGoalStartDate({ start_date: null, created_at: null })).toBeNull();
  });
});

describe('isDateWithinGoal', () => {
  it("un objectif sans date de fin couvre tous les jours suivants (régression)", () => {
    expect(isDateWithinGoal(maintainGoal, '2025-01-02')).toBe(true);
    expect(isDateWithinGoal(maintainGoal, '2030-12-31')).toBe(true);
  });

  it('un ancien objectif de maintien sans start_date reste couvert', () => {
    const legacy = { ...maintainGoal, start_date: null, created_at: '2025-01-01T12:00:00Z' };
    expect(isDateWithinGoal(legacy, '2025-06-01')).toBe(true);
    expect(isDateWithinGoal(legacy, '2024-12-31')).toBe(false);
  });

  it('respecte les bornes de début et de fin (incluses)', () => {
    const goal = { ...maintainGoal, start_date: '2025-01-01', end_date: '2025-01-31' };
    expect(isDateWithinGoal(goal, '2024-12-31')).toBe(false);
    expect(isDateWithinGoal(goal, '2025-01-01')).toBe(true);
    expect(isDateWithinGoal(goal, '2025-01-31')).toBe(true);
    expect(isDateWithinGoal(goal, '2025-02-01')).toBe(false);
  });

  it("renvoie false sans objectif", () => {
    expect(isDateWithinGoal(null, '2025-01-10')).toBe(false);
    expect(isDateWithinGoal(undefined, '2025-01-10')).toBe(false);
  });
});

describe('computeTargetsForGoal / buildDailyTargetPayload', () => {
  it("recalcule les cibles à partir des paramètres de l'objectif", () => {
    const expected = calculateCompleteTargets(profile, {
      type: 'maintain',
      activity_level: 1.375,
      method: 'mifflin',
      deficit_or_surplus_pct: 0,
      protein_g_per_kg: 2,
      fat_g_per_kg_min: 0.8,
    });
    expect(computeTargetsForGoal(profile, maintainGoal)).toEqual(expected);
  });

  it('construit la ligne daily_targets liée à l’objectif', () => {
    const payload = buildDailyTargetPayload('user-1', '2025-01-10', profile, maintainGoal);
    const targets = computeTargetsForGoal(profile, maintainGoal);

    expect(payload).toEqual({
      user_id: 'user-1',
      date: '2025-01-10',
      calories_kcal: targets.calories_kcal,
      protein_g: targets.protein_g,
      fat_g: targets.fat_g,
      carbs_g: targets.carbs_g,
      fiber_g: 25,
      goal_id: 'goal-1',
    });
  });

  it('prend en compte le poids actuel du profil', () => {
    const heavier = { ...profile, poids_kg: 70 };
    expect(buildDailyTargetPayload('u', 'd', heavier, maintainGoal).calories_kcal).toBeGreaterThan(
      buildDailyTargetPayload('u', 'd', profile, maintainGoal).calories_kcal
    );
  });
});

describe('findGoalForDate', () => {
  const goalA = { ...maintainGoal, id: 'A', start_date: '2025-01-01', end_date: null, created_at: '2025-01-01T12:00:00Z' };
  const goalB = { ...maintainGoal, id: 'B', start_date: '2025-03-01', end_date: null, created_at: '2025-03-01T12:00:00Z' };

  it("retourne l'objectif qui était en vigueur à la date (y compris un ancien objectif)", () => {
    expect(findGoalForDate([goalB, goalA], '2025-02-10')?.id).toBe('A');
    expect(findGoalForDate([goalA, goalB], '2025-03-01')?.id).toBe('B');
    expect(findGoalForDate([goalB, goalA], '2025-06-01')?.id).toBe('B');
  });

  it('retourne null avant le premier objectif ou sans objectif', () => {
    expect(findGoalForDate([goalA, goalB], '2024-12-31')).toBeNull();
    expect(findGoalForDate([], '2025-02-10')).toBeNull();
  });

  it("retourne null si l'objectif le plus récent est terminé", () => {
    const ended = { ...goalB, end_date: '2025-03-31' };
    expect(findGoalForDate([ended, goalA], '2025-04-15')).toBeNull();
    expect(findGoalForDate([ended, goalA], '2025-03-15')?.id).toBe('B');
  });

  it('départage deux objectifs du même jour par la date de création', () => {
    const morning = { ...goalB, id: 'matin', created_at: '2025-03-01T08:00:00Z' };
    const evening = { ...goalB, id: 'soir', created_at: '2025-03-01T20:00:00Z' };
    expect(findGoalForDate([morning, evening], '2025-03-02')?.id).toBe('soir');
  });

  it('gère les anciens objectifs sans start_date (date de création)', () => {
    const legacy = { ...goalA, start_date: null, created_at: new Date(2025, 0, 5, 12).toISOString() };
    expect(findGoalForDate([legacy], '2025-01-04')).toBeNull();
    expect(findGoalForDate([legacy], '2025-01-05')?.id).toBe('A');
  });
});
