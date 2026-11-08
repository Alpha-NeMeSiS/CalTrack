import { describe, expect, it } from 'vitest';
import { getGoalWarnings, validateGoalInput, validateProfileInput } from './validation';

const today = new Date(2025, 5, 15);
const validProfile = { date_naissance: '1990-04-20', taille_cm: 175, poids_kg: 70, body_fat_pct: null };

describe('validateProfileInput', () => {
  it('accepte un profil valide (masse grasse optionnelle)', () => {
    expect(validateProfileInput(validProfile, today)).toEqual([]);
    expect(validateProfileInput({ ...validProfile, body_fat_pct: undefined }, today)).toEqual([]);
    expect(validateProfileInput({ ...validProfile, body_fat_pct: 18 }, today)).toEqual([]);
  });

  it('mesures détaillées facultatives : acceptées si plausibles', () => {
    expect(
      validateProfileInput(
        { ...validProfile, body_water_pct: 55.4, visceral_fat_rating: 8, muscle_mass_kg: 54.2, bone_mass_kg: 2.9 },
        today
      )
    ).toEqual([]);
    expect(validateProfileInput({ ...validProfile, body_water_pct: null, muscle_mass_kg: undefined }, today)).toEqual([]);
  });

  it('mesures détaillées : bornes et cohérence avec le poids', () => {
    expect(validateProfileInput({ ...validProfile, body_water_pct: 95 }, today)).toEqual([
      'Le taux d’eau doit être compris entre 30 et 80 %.',
    ]);
    expect(validateProfileInput({ ...validProfile, visceral_fat_rating: 8.5 }, today)).toEqual([
      'L’indice de graisse viscérale doit être un nombre entier entre 1 et 59.',
    ]);
    expect(validateProfileInput({ ...validProfile, muscle_mass_kg: 5 }, today)).toEqual([
      'La masse musculaire doit être comprise entre 10 et 150 kg.',
    ]);
    expect(validateProfileInput({ ...validProfile, bone_mass_kg: 12 }, today)).toEqual([
      'La masse osseuse doit être comprise entre 0,5 et 10 kg.',
    ]);
    // 68 + 3 kg pour un poids de 70 kg
    expect(validateProfileInput({ ...validProfile, muscle_mass_kg: 68, bone_mass_kg: 3 }, today)).toEqual([
      'La masse musculaire et la masse osseuse dépassent votre poids (70 kg) : vérifiez les valeurs.',
    ]);
    expect(validateProfileInput({ ...validProfile, muscle_mass_kg: 72 }, today)).toEqual([
      'La masse musculaire dépasse votre poids (70 kg) : vérifiez les valeurs.',
    ]);
  });

  it('exige une date de naissance valide, passée et réaliste', () => {
    expect(validateProfileInput({ ...validProfile, date_naissance: '' }, today)).toEqual([
      'La date de naissance est requise.',
    ]);
    expect(validateProfileInput({ ...validProfile, date_naissance: '2025-06-16' }, today)).toEqual([
      'La date de naissance ne peut pas être dans le futur.',
    ]);
    expect(validateProfileInput({ ...validProfile, date_naissance: '2020-01-01' }, today)).toEqual([
      "L'âge doit être compris entre 10 et 120 ans.",
    ]);
  });

  it('refuse une taille ou un poids vides, nuls ou hors limites (contraintes de la base)', () => {
    expect(validateProfileInput({ ...validProfile, taille_cm: 0 }, today)).toEqual([
      'La taille doit être comprise entre 100 et 250 cm.',
    ]);
    expect(validateProfileInput({ ...validProfile, poids_kg: Number.NaN }, today)).toEqual([
      'Le poids doit être compris entre 30 et 300 kg.',
    ]);
    expect(validateProfileInput({ ...validProfile, poids_kg: 301 }, today)).toHaveLength(1);
  });

  it('vérifie la masse grasse seulement si elle est renseignée', () => {
    expect(validateProfileInput({ ...validProfile, body_fat_pct: 80 }, today)).toEqual([
      'Le taux de masse grasse doit être compris entre 3 et 60 %.',
    ]);
  });

  it('cumule les erreurs', () => {
    expect(validateProfileInput({ date_naissance: '', taille_cm: 0, poids_kg: 0 }, today)).toHaveLength(3);
  });
});

describe('validateGoalInput', () => {
  const base = { activity_level: 1.55, deficit_or_surplus_pct: 15 };

  it('accepte des objectifs valides', () => {
    expect(validateGoalInput({ ...base, type: 'maintain' }, 70)).toEqual([]);
    expect(validateGoalInput({ ...base, type: 'loss', target_weight_kg: 65, duration_weeks: 10 }, 70)).toEqual([]);
    expect(validateGoalInput({ ...base, type: 'gain', target_weight_kg: 75 }, 70)).toEqual([]);
  });

  it("n'exige pas de déficit pour un maintien", () => {
    expect(validateGoalInput({ ...base, type: 'maintain', deficit_or_surplus_pct: 0 }, 70)).toEqual([]);
  });

  it('borne le déficit / surplus', () => {
    expect(validateGoalInput({ ...base, type: 'loss', deficit_or_surplus_pct: 0 }, 70)).toEqual([
      'Le déficit calorique doit être compris entre 5 et 30 %.',
    ]);
    expect(validateGoalInput({ ...base, type: 'gain', deficit_or_surplus_pct: 60 }, 70)).toEqual([
      'Le surplus calorique doit être compris entre 5 et 30 %.',
    ]);
  });

  it('exige une durée entière (colonne integer en base)', () => {
    const message = 'La durée doit être un nombre entier de semaines entre 1 et 260.';
    expect(validateGoalInput({ ...base, type: 'maintain', duration_weeks: 2.5 }, 70)).toEqual([message]);
    expect(validateGoalInput({ ...base, type: 'loss', duration_weeks: 300 }, 70)).toEqual([message]);
  });

  it('vérifie la cohérence du poids cible avec le type d’objectif', () => {
    expect(validateGoalInput({ ...base, type: 'loss', target_weight_kg: 75 }, 70)).toEqual([
      'Pour une perte de poids, le poids cible doit être inférieur au poids actuel.',
    ]);
    expect(validateGoalInput({ ...base, type: 'gain', target_weight_kg: 65 }, 70)).toEqual([
      'Pour une prise de masse, le poids cible doit être supérieur au poids actuel.',
    ]);
    expect(validateGoalInput({ ...base, type: 'loss', target_weight_kg: 10 }, 70)).toEqual([
      'Le poids cible doit être compris entre 30 et 300 kg.',
    ]);
  });

  it("refuse un niveau d'activité invalide", () => {
    expect(validateGoalInput({ ...base, type: 'maintain', activity_level: 3 }, 70)).toEqual([
      "Le niveau d'activité est invalide.",
    ]);
  });
});

describe('validateGoalInput — protéines', () => {
  it('borne le taux de protéines entre 1,2 et 2,5 g/kg', () => {
    const base = { type: 'maintain' as const, activity_level: 1.55, deficit_or_surplus_pct: 0 };
    expect(validateGoalInput({ ...base, protein_g_per_kg: 2 }, 70)).toEqual([]);
    expect(validateGoalInput({ ...base, protein_g_per_kg: 4 }, 70)).toEqual([
      'Les protéines doivent être comprises entre 1.2 et 2.5 g/kg.',
    ]);
  });
});

describe('getGoalWarnings', () => {
  const base = { activity_level: 1.55, deficit_or_surplus_pct: 20 };

  it('avertit (sans bloquer) quand le rythme est trop rapide et propose une durée', () => {
    const warnings = getGoalWarnings({ ...base, type: 'loss', target_weight_kg: 70, duration_weeks: 4 }, 80);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].message).toMatch(/^Rythme trop rapide : perdre 2.5 kg par semaine/);
    expect(warnings[0].suggestedDurationWeeks).toBe(13);
    // L'objectif reste valide : ce n'est qu'un avertissement
    expect(validateGoalInput({ ...base, type: 'loss', target_weight_kg: 70, duration_weeks: 4 }, 80)).toEqual([]);
  });

  it("n'avertit pas pour un rythme raisonnable, un maintien ou un objectif incomplet", () => {
    expect(getGoalWarnings({ ...base, type: 'loss', target_weight_kg: 76, duration_weeks: 10 }, 80)).toEqual([]);
    expect(getGoalWarnings({ ...base, type: 'maintain' }, 80)).toEqual([]);
    expect(getGoalWarnings({ ...base, type: 'loss', target_weight_kg: 70 }, 80)).toEqual([]);
  });
});
