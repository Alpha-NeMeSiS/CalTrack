import { describe, expect, it } from 'vitest';
import { calculateCompleteTargets, UserProfile } from './calculations';
import {
  buildDailyTargetPayload,
  buildGoalHistory,
  buildGoalInsertPayload,
  chooseBmrMethod,
  computeGoalEndDate,
  computeTargetsForGoal,
  DEFAULT_FAT_G_PER_KG_MIN,
  DEFAULT_PROTEIN_G_PER_KG,
  findGoalForDate,
  getEffectiveGoal,
  getGoalStartDate,
  hasGoalStarted,
  isGoalEndedOn,
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

  it('Katch aussi avec les mesures détaillées (masse musculaire, eau)', () => {
    expect(chooseBmrMethod({ poids_kg: 80, muscle_mass_kg: 58.5, bone_mass_kg: 3.1 })).toBe('katch');
    expect(chooseBmrMethod({ poids_kg: 80, body_water_pct: 55 })).toBe('katch');
    // La graisse viscérale seule ne permet pas d'estimer la masse maigre
    expect(chooseBmrMethod({ poids_kg: 80, visceral_fat_rating: 9 })).toBe('mifflin');
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

  it('enregistre le taux de protéines choisi (2 g/kg par défaut)', () => {
    const input = { type: 'loss' as const, activity_level: 1.2, deficit_or_surplus_pct: 15 };
    expect(buildGoalInsertPayload('u', profile, input, '2025-02-10').protein_g_per_kg).toBe(2);
    expect(buildGoalInsertPayload('u', profile, { ...input, protein_g_per_kg: 1.8 }, '2025-02-10').protein_g_per_kg).toBe(1.8);
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

  it('utilise les mesures du profil actuel, même ajoutées après la création de l’objectif', () => {
    // Objectif créé sans masse grasse connue (method « mifflin »)
    const withLeanMass = { ...profile, muscle_mass_kg: 52, bone_mass_kg: 2.8 };
    const expected = calculateCompleteTargets(withLeanMass, {
      type: 'maintain',
      activity_level: 1.375,
      method: 'katch',
      deficit_or_surplus_pct: 0,
      protein_g_per_kg: 2,
      fat_g_per_kg_min: 0.8,
    });
    expect(maintainGoal.method).toBe('mifflin');
    expect(computeTargetsForGoal(withLeanMass, maintainGoal)).toEqual(expected);
    expect(computeTargetsForGoal(withLeanMass, maintainGoal).calories_kcal).not.toBe(
      computeTargetsForGoal(profile, maintainGoal).calories_kcal
    );
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

  it("garde un objectif terminé en vigueur (suivi en maintien) au lieu de bloquer (régression)", () => {
    const ended = { ...goalB, end_date: '2025-03-31' };
    expect(findGoalForDate([ended, goalA], '2025-04-15')?.id).toBe('B');
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

describe('fin d’objectif : bascule en maintien', () => {
  const lossGoal: GoalLike = {
    ...maintainGoal,
    id: 'loss',
    type: 'loss',
    deficit_or_surplus_pct: 20,
    start_date: '2025-01-01',
    end_date: '2025-03-26',
  };

  it('détecte un objectif terminé (après sa date de fin, pas le jour même)', () => {
    expect(isGoalEndedOn(lossGoal, '2025-03-26')).toBe(false);
    expect(isGoalEndedOn(lossGoal, '2025-03-27')).toBe(true);
    expect(isGoalEndedOn(maintainGoal, '2030-01-01')).toBe(false);
  });

  it('applique le maintien après la date de fin', () => {
    expect(getEffectiveGoal(lossGoal, '2025-03-26')).toBe(lossGoal);
    expect(getEffectiveGoal(lossGoal, '2025-04-02')).toMatchObject({
      id: 'loss',
      type: 'maintain',
      deficit_or_surplus_pct: 0,
      activity_level: lossGoal.activity_level,
    });
  });

  it('calcule la cible des jours suivants en maintien, rattachée au même objectif', () => {
    const during = buildDailyTargetPayload('u', '2025-03-20', profile, lossGoal);
    const after = buildDailyTargetPayload('u', '2025-04-02', profile, lossGoal);
    const maintenance = buildDailyTargetPayload('u', '2025-04-02', profile, { ...lossGoal, type: 'maintain', deficit_or_surplus_pct: 0 });

    expect(after.calories_kcal).toBe(maintenance.calories_kcal);
    expect(after.calories_kcal).toBeGreaterThan(during.calories_kcal);
    expect(after.goal_id).toBe('loss');
  });

  it('hasGoalStarted ne regarde que la date de début', () => {
    expect(hasGoalStarted(lossGoal, '2024-12-31')).toBe(false);
    expect(hasGoalStarted(lossGoal, '2025-06-01')).toBe(true);
    expect(hasGoalStarted(null, '2025-06-01')).toBe(false);
  });
});

describe('buildGoalHistory', () => {
  const goal = (id: string, start: string, end: string | null, isActive = false) => ({
    id,
    start_date: start,
    end_date: end,
    created_at: `${start}T08:00:00Z`,
    is_active: isActive,
  });

  it("liste les objectifs passés du plus récent au plus ancien, sans l'objectif actif", () => {
    const history = buildGoalHistory([
      goal('a', '2025-01-01', '2025-03-01'),
      goal('c', '2025-06-01', null, true),
      goal('b', '2025-03-10', '2025-06-30'),
    ]);

    expect(history.map((item) => item.goal.id)).toEqual(['b', 'a']);
    // Terminé à sa date prévue
    expect(history[1]).toMatchObject({ start: '2025-01-01', end: '2025-03-01', replaced: false });
    // Remplacé avant sa fin prévue : s'arrête la veille du suivant
    expect(history[0]).toMatchObject({ start: '2025-03-10', end: '2025-05-31', replaced: true });
  });

  it('gère un objectif sans fin remplacé, et un remplacement le jour même', () => {
    const history = buildGoalHistory([
      goal('a', '2025-01-01', null),
      goal('b', '2025-02-01', null),
      goal('c', '2025-02-01', null, true),
    ]);

    expect(history.find((item) => item.goal.id === 'a')).toMatchObject({ end: '2025-01-31', replaced: true });
    expect(history.find((item) => item.goal.id === 'b')).toMatchObject({ start: '2025-02-01', end: '2025-02-01', replaced: true });
  });

  it("renvoie une liste vide s'il n'y a que l'objectif actif", () => {
    expect(buildGoalHistory([goal('a', '2025-01-01', null, true)])).toEqual([]);
  });
});

