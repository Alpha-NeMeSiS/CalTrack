import { describe, expect, it } from 'vitest';
import type { ExpenditureEstimate } from './insights';
import { suggestCalorieAdjustment } from './calorieAdjustment';
import { computeTargetsForGoal, GoalLike } from './goals';
import type { UserProfile } from './calculations';

const profile: UserProfile = { sexe: 'M', date_naissance: '1995-01-01', taille_cm: 178, poids_kg: 80 };

const lossGoal: GoalLike & { calorie_adjustment_at?: string | null } = {
  id: 'goal-1',
  type: 'loss',
  activity_level: 1.55,
  method: 'mifflin',
  deficit_or_surplus_pct: 20,
  protein_g_per_kg: 2,
  fat_g_per_kg_min: 0.8,
};

const ok = (expenditureKcal: number, weeklyWeightChangeKg = -0.5): ExpenditureEstimate => ({
  status: 'ok',
  expenditureKcal,
  avgIntakeKcal: 2000,
  weeklyWeightChangeKg,
  loggedDays: 20,
  weighIns: 8,
});

const now = new Date('2026-11-08T10:00:00Z');
const current = (goal = lossGoal) => computeTargetsForGoal(profile, goal).calories_kcal;
// Dépense de la formule (métabolisme de base × activité) : la cible actuelle en découle
const formulaExpenditure = Math.round(current() / 0.8);

describe('suggestCalorieAdjustment', () => {
  it('rien sans estimation fiable de la dépense', () => {
    expect(
      suggestCalorieAdjustment({ profile, goal: lossGoal, expenditure: { status: 'insufficient_data', loggedDays: 5, weighIns: 1, weightSpanDays: 0 }, now })
    ).toBeNull();
  });

  it('rien si la cible correspond déjà à la dépense réelle (écart < 100 kcal)', () => {
    expect(suggestCalorieAdjustment({ profile, goal: lossGoal, expenditure: ok(formulaExpenditure + 50), now })).toBeNull();
  });

  it('dépense réelle plus élevée : propose de manger plus, par pas de 300 kcal au plus', () => {
    // Idéal = (formule + 1 000) × 0,8 : +800 kcal, limité à +300
    const suggestion = suggestCalorieAdjustment({ profile, goal: lossGoal, expenditure: ok(formulaExpenditure + 1000, -1.1), now });

    expect(suggestion).toMatchObject({
      direction: 'more',
      deltaKcal: 300,
      currentTargetKcal: current(),
      proposedTargetKcal: current() + 300,
      newAdjustmentKcal: 300,
      expenditureKcal: formulaExpenditure + 1000,
      weeklyChangeKg: -1.1,
    });
  });

  it('dépense réelle plus basse : propose de réduire (arrondi à 10 kcal)', () => {
    // Idéal = (formule − 200) × 0,8 ≈ −160 kcal
    const suggestion = suggestCalorieAdjustment({ profile, goal: lossGoal, expenditure: ok(formulaExpenditure - 200, -0.1), now });

    expect(suggestion?.direction).toBe('less');
    expect(suggestion?.deltaKcal).toBe(-160);
    expect(suggestion?.newAdjustmentKcal).toBe(-160);
  });

  it('ne propose jamais moins que le plancher de sécurité', () => {
    const suggestion = suggestCalorieAdjustment({ profile, goal: lossGoal, expenditure: ok(1500, 0.2), now });
    // Plancher homme : 1 500 kcal, ou le métabolisme de base s'il est plus haut
    expect(suggestion?.proposedTargetKcal).toBeGreaterThanOrEqual(1500);
    expect(suggestion?.proposedTargetKcal).toBe(current() - 300);
  });

  it('cumule avec l’ajustement déjà accepté', () => {
    const adjusted = { ...lossGoal, calorie_adjustment_kcal: 200, calorie_adjustment_at: '2026-10-20T10:00:00Z' };
    const suggestion = suggestCalorieAdjustment({ profile, goal: adjusted, expenditure: ok(formulaExpenditure + 500), now });
    // Idéal = formule × 0,8 + 400 ; cible actuelle = formule × 0,8 + 200 → +200
    expect(suggestion?.deltaKcal).toBe(200);
    expect(suggestion?.newAdjustmentKcal).toBe(400);
  });

  it('une proposition au plus par semaine après un ajustement', () => {
    const recent = { ...lossGoal, calorie_adjustment_kcal: 100, calorie_adjustment_at: '2026-11-04T10:00:00Z' };
    expect(suggestSafe(recent)).toBeNull();
    expect(suggestSafe({ ...recent, calorie_adjustment_at: '2026-10-31T09:00:00Z' })).not.toBeNull();
  });

  it('maintien : la cible suit la dépense réelle', () => {
    const maintain = { ...lossGoal, type: 'maintain' as const, deficit_or_surplus_pct: 0 };
    const suggestion = suggestCalorieAdjustment({ profile, goal: maintain, expenditure: ok(current(maintain) + 250, -0.3), now });
    expect(suggestion?.deltaKcal).toBe(250);
  });
});

function suggestSafe(goal: typeof lossGoal) {
  return suggestCalorieAdjustment({ profile, goal, expenditure: ok(formulaExpenditure + 1000), now });
}
