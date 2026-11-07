import { describe, expect, it } from 'vitest';
import {
  calculateAge,
  calculateBMR,
  calculateCompleteTargets,
  calculateDailySummary,
  calculateGoalProgress,
  calculateMacros,
  calculateOptimalDeficitOrSurplus,
  calculateTargetCalories,
  calculateTDEE,
  getActivityLevelLabel,
  getGoalTypeLabel,
  UserProfile,
} from './calculations';

// Profil de référence
const baseProfile: UserProfile = {
  sexe: 'M',
  date_naissance: '1995-01-01',
  taille_cm: 175,
  poids_kg: 70,
};

describe('calculateAge', () => {
  it("compte l'anniversaire seulement s'il est passé", () => {
    expect(calculateAge('2000-06-15', new Date(2025, 5, 14))).toBe(24);
    expect(calculateAge('2000-06-15', new Date(2025, 5, 15))).toBe(25);
    expect(calculateAge('2000-06-15', new Date(2025, 11, 31))).toBe(25);
  });

  it('gère un anniversaire le 1er janvier sans décalage de fuseau', () => {
    expect(calculateAge('2000-01-01', new Date(2025, 0, 1))).toBe(25);
    expect(calculateAge('2000-01-01', new Date(2024, 11, 31))).toBe(24);
  });
});

describe('calculateBMR', () => {
  // On fige l'âge à 30 ans via une date de naissance relative à aujourd'hui
  const thirtyYearsAgo = (() => {
    const d = new Date();
    return `${d.getFullYear() - 30}-01-01`;
  })();
  const profile30 = { ...baseProfile, date_naissance: thirtyYearsAgo };

  it('Mifflin-St Jeor pour un homme', () => {
    // 10*70 + 6.25*175 - 5*30 + 5
    expect(calculateBMR(profile30)).toBeCloseTo(1648.75);
  });

  it('Mifflin-St Jeor pour une femme', () => {
    expect(calculateBMR({ ...profile30, sexe: 'F' })).toBeCloseTo(1482.75);
  });

  it('Katch-McArdle si la masse grasse est connue', () => {
    // masse maigre = 80 * 0.8 = 64 kg → 370 + 21.6 * 64
    expect(calculateBMR({ ...profile30, poids_kg: 80, body_fat_pct: 20 }, 'katch')).toBeCloseTo(1752.4);
  });

  it('revient à Mifflin si Katch est demandé sans masse grasse', () => {
    expect(calculateBMR({ ...profile30, body_fat_pct: null }, 'katch')).toBeCloseTo(1648.75);
    expect(calculateBMR(profile30, 'katch')).toBeCloseTo(1648.75);
  });
});

describe('calculateTDEE', () => {
  it("multiplie le métabolisme de base par le niveau d'activité", () => {
    expect(calculateTDEE(1600, 1.55)).toBeCloseTo(2480);
  });
});

describe('calculateTargetCalories', () => {
  it('maintien : arrondi de la dépense', () => {
    expect(calculateTargetCalories(2000.4, 'maintain', 20)).toBe(2000);
  });

  it('perte : applique le déficit (signe ignoré)', () => {
    expect(calculateTargetCalories(2000, 'loss', 20)).toBe(1600);
    expect(calculateTargetCalories(2000, 'loss', -20)).toBe(1600);
  });

  it('prise : applique le surplus', () => {
    expect(calculateTargetCalories(2000, 'gain', 10)).toBe(2200);
  });
});

describe('calculateMacros', () => {
  it('répartit protéines, lipides puis glucides', () => {
    expect(calculateMacros(2000, 70, 2.0, 0.8)).toEqual({
      calories_kcal: 2000,
      protein_g: 140, // 2 g/kg
      fat_g: 56, // max(0.8 * 70, 25% de 2000 / 9)
      carbs_g: 234, // (2000 - 140*4 - 56*9) / 4
      fiber_g: 25,
    });
  });

  it('respecte une valeur de protéines inférieure à 1.6 g/kg (régression)', () => {
    expect(calculateMacros(2000, 70, 1.2, 0.8).protein_g).toBe(84);
  });

  it('utilise 25 % des calories comme minimum de lipides', () => {
    // 25 % de 3000 / 9 = 83.3 g > 0.5 * 50 = 25 g
    expect(calculateMacros(3000, 50, 2, 0.5).fat_g).toBe(83.3);
  });

  it('ne renvoie jamais de glucides négatifs', () => {
    expect(calculateMacros(1000, 100, 3, 1).carbs_g).toBe(0);
  });
});

describe('calculateCompleteTargets', () => {
  it('enchaîne BMR → TDEE → calories → macros', () => {
    const targets = calculateCompleteTargets(baseProfile, {
      type: 'loss',
      activity_level: 1.2,
      method: 'mifflin',
      deficit_or_surplus_pct: 10,
      protein_g_per_kg: 2,
      fat_g_per_kg_min: 0.8,
    });
    const expectedCalories = calculateTargetCalories(
      calculateTDEE(calculateBMR(baseProfile), 1.2),
      'loss',
      10
    );
    expect(targets.calories_kcal).toBe(expectedCalories);
    expect(targets.protein_g).toBe(140);
  });
});

describe('calculateDailySummary', () => {
  const target = { calories_kcal: 2000, protein_g: 140, fat_g: 60, carbs_g: 220, fiber_g: 25 };

  it('additionne les entrées et calcule les écarts', () => {
    const summary = calculateDailySummary(
      [
        { kcal: 500, protein_g: 30, fat_g: 10, carbs_g: 60, fiber_g: 5 },
        { kcal: 300.4, protein_g: 20.25, fat_g: 5, carbs_g: 30 },
      ],
      target,
      '2025-01-10'
    );

    expect(summary.date).toBe('2025-01-10');
    expect(summary.consumed).toEqual({
      calories_kcal: 800,
      protein_g: 50.3,
      fat_g: 15,
      carbs_g: 90,
      fiber_g: 5,
    });
    expect(summary.delta.calories_kcal).toBe(-1199.6);
    expect(summary.delta.fiber_g).toBe(-20);
    expect(summary.status).toBe('under');
  });

  it('statut "ok" à ±5 % de la cible', () => {
    const entries = [{ kcal: 2090, protein_g: 0, fat_g: 0, carbs_g: 0 }];
    expect(calculateDailySummary(entries, target, 'd').status).toBe('ok');
  });

  it('statut "over" au-delà de +5 %', () => {
    const entries = [{ kcal: 2200, protein_g: 0, fat_g: 0, carbs_g: 0 }];
    expect(calculateDailySummary(entries, target, 'd').status).toBe('over');
  });

  it('ne produit pas de NaN avec une cible à 0 kcal', () => {
    const zeroTarget = { ...target, calories_kcal: 0 };
    expect(calculateDailySummary([], zeroTarget, 'd').status).toBe('ok');
    const summary = calculateDailySummary(
      [{ kcal: 100, protein_g: 0, fat_g: 0, carbs_g: 0 }],
      zeroTarget,
      'd'
    );
    expect(summary.status).toBe('over');
    expect(Number.isNaN(summary.delta.calories_kcal)).toBe(false);
  });
});

describe('calculateGoalProgress', () => {
  const now = new Date(2025, 0, 15); // 2 semaines après le début

  it('calcule le temps écoulé, le rythme et la date de fin', () => {
    const progress = calculateGoalProgress(80, 76, 8, '2025-01-01', 'loss', 82, now);

    expect(progress.weeks_elapsed).toBe(2);
    expect(progress.weeks_remaining).toBe(6);
    expect(progress.progress_pct).toBe(25);
    expect(progress.weight_change).toBe(-4); // reste à perdre
    expect(progress.weekly_rate_target).toBe(-0.75); // (76 - 82) / 8
    expect(progress.estimated_end_date).toBe('2025-02-26');
  });

  it("tient compte de l'évolution réelle du poids (régression)", () => {
    // Perdu 2 kg en 2 semaines pour 1.5 kg attendus : dans les clous
    expect(calculateGoalProgress(80, 76, 8, '2025-01-01', 'loss', 82, now).on_track).toBe(true);
    // Pris du poids au lieu d'en perdre : hors trajectoire
    expect(calculateGoalProgress(84, 76, 8, '2025-01-01', 'loss', 82, now).on_track).toBe(false);
  });

  it('mesure l’évolution réelle depuis le poids de départ', () => {
    // Départ 82 kg, cible 76 kg (6 kg à perdre), actuel 79 kg : 3 kg perdus = 50 %
    const progress = calculateGoalProgress(79, 76, 8, '2025-01-01', 'loss', 82, now);
    expect(progress.start_weight).toBe(82);
    expect(progress.actual_weight_change).toBe(-3);
    expect(progress.weight_progress_pct).toBe(50);
    expect(progress.goal_reached).toBe(false);
  });

  it('borne la progression du poids entre 0 et 100 %', () => {
    // Poids en hausse pendant une perte : 0 %
    expect(calculateGoalProgress(84, 76, 8, '2025-01-01', 'loss', 82, now).weight_progress_pct).toBe(0);
    // Cible dépassée : 100 %
    expect(calculateGoalProgress(74, 76, 8, '2025-01-01', 'loss', 82, now).weight_progress_pct).toBe(100);
    // Prise de masse : 70 → 75 kg, actuel 72 kg = 40 %
    expect(calculateGoalProgress(72, 75, 10, '2025-01-01', 'gain', 70, now).weight_progress_pct).toBe(40);
  });

  it('considère une avance sur le rythme prévu comme « dans les temps » (régression)', () => {
    // 3 kg perdus en 2 semaines pour 1,5 kg attendus
    expect(calculateGoalProgress(79, 76, 8, '2025-01-01', 'loss', 82, now).on_track).toBe(true);
    // Prise de masse en avance : 70 → 72 kg en 2 semaines pour 0,5 kg/sem attendu
    expect(calculateGoalProgress(72, 75, 10, '2025-01-01', 'gain', 70, now).on_track).toBe(true);
    // Prise de masse en retard : aucune évolution
    expect(calculateGoalProgress(70, 75, 5, '2025-01-01', 'gain', 70, now).on_track).toBe(false);
  });

  it('considère un objectif atteint comme « dans les temps » (régression)', () => {
    const progress = calculateGoalProgress(75, 76, 8, '2025-01-01', 'loss', 82, now);
    expect(progress.goal_reached).toBe(true);
    expect(progress.on_track).toBe(true);
  });

  it('utilise le poids actuel comme poids de départ par défaut', () => {
    expect(calculateGoalProgress(80, 76, 8, '2025-01-01', 'loss', undefined, now).weekly_rate_target).toBe(-0.5);
  });

  it('ne divise pas par zéro avec une durée nulle', () => {
    const progress = calculateGoalProgress(80, 76, 0, '2025-01-01', 'loss', undefined, now);
    expect(Number.isFinite(progress.weekly_rate_target)).toBe(true);
    expect(Number.isFinite(progress.progress_pct)).toBe(true);
  });
});

describe('calculateOptimalDeficitOrSurplus', () => {
  it('convertit un rythme de perte en pourcentage de déficit', () => {
    // 0.5 kg/sem * 7700 kcal / 7 = 550 kcal/j → 22 % de 2500
    expect(calculateOptimalDeficitOrSurplus(80, 76, 8, 2500, 'loss')).toBe(22);
  });

  it('plafonne à 25 % (perte) et 20 % (prise)', () => {
    expect(calculateOptimalDeficitOrSurplus(80, 70, 4, 2000, 'loss')).toBe(25);
    expect(calculateOptimalDeficitOrSurplus(70, 80, 4, 2000, 'gain')).toBe(20);
  });

  it('impose un minimum de 5 %', () => {
    expect(calculateOptimalDeficitOrSurplus(80, 80.5, 20, 3000, 'gain')).toBe(5);
  });

  it('gère une durée ou une dépense invalide', () => {
    expect(calculateOptimalDeficitOrSurplus(80, 76, 0, 2500, 'loss')).toBe(5);
    expect(calculateOptimalDeficitOrSurplus(80, 76, 8, 0, 'loss')).toBe(5);
  });
});

describe('libellés', () => {
  it("niveau d'activité", () => {
    expect(getActivityLevelLabel(1.2)).toMatch(/Sédentaire/);
    expect(getActivityLevelLabel(1.55)).toMatch(/Modérément/);
    expect(getActivityLevelLabel(1.9)).toMatch(/Extrêmement/);
  });

  it("type d'objectif", () => {
    expect(getGoalTypeLabel('loss')).toBe('Perte de poids');
    expect(getGoalTypeLabel('maintain')).toBe('Maintien');
    expect(getGoalTypeLabel('gain')).toBe('Prise de masse');
  });
});
