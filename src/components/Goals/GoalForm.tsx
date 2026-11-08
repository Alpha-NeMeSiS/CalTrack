// Formulaire d'objectif (type, activité, poids cible, durée, protéines) avec
// aperçu des calories et macros avant validation.
// Enregistrer crée un nouvel objectif qui démarre aujourd'hui (l'ancien est
// désactivé) et met à jour la cible du jour.
import { useState } from 'react';
import { Save } from 'lucide-react';
import type { Goal } from '../../lib/supabase';
import { useAuth } from '../../contexts/useAuth';
import { calculateBMR, calculateTDEE, calculateOptimalDeficitOrSurplus } from '../../utils/calculations';
import { getTodayDate } from '../../utils/date';
import { activateNewGoal } from '../../services/goals';
import { validateGoalInput } from '../../utils/validation';
import { chooseBmrMethod, DEFAULT_PROTEIN_G_PER_KG } from '../../utils/goals';
import { GoalTargetsPreview } from './GoalTargetsPreview';

const PROTEIN_OPTIONS = [
  { value: 1.6, label: '1,6 g/kg — modéré' },
  { value: 1.8, label: '1,8 g/kg' },
  { value: 2.0, label: '2,0 g/kg — recommandé (défaut)' },
  { value: 2.2, label: '2,2 g/kg — sportif / sèche' },
];

interface GoalFormProps {
  /** Objectif actif (pré-remplit le formulaire), ou null */
  activeGoal: Goal | null;
  /** Appelé après l'enregistrement d'un nouvel objectif */
  onSaved: () => void | Promise<void>;
}

/** Valeurs du formulaire à partir de l'objectif actif */
function initialGoalData(goal: Goal | null) {
  return {
    goal_type: (goal?.type ?? 'maintain') as 'loss' | 'maintain' | 'gain',
    activity_level: goal ? Number(goal.activity_level) : 1.55,
    // Un objectif de maintien est enregistré avec 0 % : proposer 15 % par défaut
    // si l'utilisateur repasse en perte ou en prise
    deficit_or_surplus_pct: Number(goal?.deficit_or_surplus_pct) || 15,
    target_weight_kg: (goal?.target_weight_kg ? Number(goal.target_weight_kg) : undefined) as number | undefined,
    duration_weeks: (goal?.duration_weeks ? Number(goal.duration_weeks) : undefined) as number | undefined,
    protein_g_per_kg: Number(goal?.protein_g_per_kg) || DEFAULT_PROTEIN_G_PER_KG,
  };
}

export function GoalForm({ activeGoal, onSaved }: GoalFormProps) {
  const { user, profile } = useAuth();
  const [goalData, setGoalData] = useState(() => initialGoalData(activeGoal));
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const handleSaveGoal = async () => {
    if (!user || !profile) return;

    setError('');
    setSuccess('');

    const input = {
      type: goalData.goal_type,
      activity_level: goalData.activity_level,
      deficit_or_surplus_pct: goalData.deficit_or_surplus_pct,
      target_weight_kg: goalData.target_weight_kg,
      duration_weeks: goalData.duration_weeks,
      protein_g_per_kg: goalData.protein_g_per_kg,
    };

    const validationErrors = validateGoalInput(input, profile.poids_kg);
    if (validationErrors.length > 0) {
      setError(validationErrors.join(' '));
      return;
    }

    setLoading(true);
    try {
      // Crée le nouvel objectif, désactive l'ancien et met à jour (upsert) la cible du jour
      await activateNewGoal(user.id, profile, input, getTodayDate());
      setSuccess('Objectif enregistré : il s\'applique dès aujourd\'hui.');
      await onSaved();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "L'objectif n'a pas pu être enregistré.");
    } finally {
      setLoading(false);
    }
  };

  return (
      <div className="space-y-6">
        <div>
          <label htmlFor="activity_level" className="block text-sm font-medium text-gray-700 mb-2">Niveau d'activité</label>
          <select
            id="activity_level"
            value={goalData.activity_level}
            onChange={(e) => setGoalData({ ...goalData, activity_level: Number(e.target.value) })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value={1.2}>Sédentaire (peu ou pas d'exercice)</option>
            <option value={1.375}>Légèrement actif (1-3 jours/semaine)</option>
            <option value={1.55}>Modérément actif (3-5 jours/semaine)</option>
            <option value={1.725}>Très actif (6-7 jours/semaine)</option>
            <option value={1.9}>Extrêmement actif (2x par jour)</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Type d'objectif</label>
          <div className="grid grid-cols-3 gap-4">
            <button
              type="button"
              aria-pressed={goalData.goal_type === 'loss'}
              onClick={() => setGoalData({ ...goalData, goal_type: 'loss' })}
              className={`py-3 px-4 border-2 rounded-md font-medium transition-colors ${
                goalData.goal_type === 'loss'
                  ? 'border-blue-600 bg-blue-50 text-blue-700'
                  : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
              }`}
            >
              Perte
            </button>
            <button
              type="button"
              aria-pressed={goalData.goal_type === 'maintain'}
              onClick={() => setGoalData({ ...goalData, goal_type: 'maintain' })}
              className={`py-3 px-4 border-2 rounded-md font-medium transition-colors ${
                goalData.goal_type === 'maintain'
                  ? 'border-blue-600 bg-blue-50 text-blue-700'
                  : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
              }`}
            >
              Maintien
            </button>
            <button
              type="button"
              aria-pressed={goalData.goal_type === 'gain'}
              onClick={() => setGoalData({ ...goalData, goal_type: 'gain' })}
              className={`py-3 px-4 border-2 rounded-md font-medium transition-colors ${
                goalData.goal_type === 'gain'
                  ? 'border-blue-600 bg-blue-50 text-blue-700'
                  : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
              }`}
            >
              Prise
            </button>
          </div>
        </div>

        {goalData.goal_type === 'maintain' && (
          <div className="bg-blue-50 p-4 rounded-md border border-blue-200">
            <label htmlFor="duration_maintain" className="block text-xs font-medium text-blue-900 mb-1">
              Durée du maintien en semaines (optionnel)
            </label>
            <input
              type="number"
              id="duration_maintain"
              value={goalData.duration_weeks || ''}
              onChange={(e) =>
                setGoalData({ ...goalData, duration_weeks: e.target.value ? Number(e.target.value) : undefined })
              }
              min="1"
              max="260"
              step="1"
              placeholder="Ex: 12"
              className="w-full px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-blue-600">
              Laissez vide pour un objectif de maintien sans limite de temps
            </p>
          </div>
        )}

        {goalData.goal_type !== 'maintain' && (
          <>
            <div className="bg-blue-50 p-4 rounded-md border border-blue-200">
              <h3 className="text-sm text-blue-900 mb-2">Objectif de poids et durée (optionnel)</h3>
              <p className="text-xs text-blue-700 mb-3">
                Définissez un poids cible et une durée pour un calcul automatique du déficit/surplus optimal
              </p>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="target_weight" className="block text-xs font-medium text-blue-900 mb-1">
                    Poids cible (kg)
                  </label>
                  <input
                    type="number"
                    id="target_weight"
                    value={goalData.target_weight_kg || ''}
                    onChange={(e) => {
                      const value = e.target.value ? Number(e.target.value) : undefined;
                      setGoalData({ ...goalData, target_weight_kg: value });

                      if (value && goalData.duration_weeks && profile) {
                        const bmr = calculateBMR(profile, chooseBmrMethod(profile));
                        const tdee = calculateTDEE(bmr, goalData.activity_level);
                        const optimal = calculateOptimalDeficitOrSurplus(
                          profile.poids_kg,
                          value,
                          goalData.duration_weeks,
                          tdee,
                          goalData.goal_type as 'loss' | 'gain'
                        );
                        setGoalData((prev) => ({ ...prev, deficit_or_surplus_pct: optimal }));
                      }
                    }}
                    min="30"
                    max="300"
                    step="0.1"
                    placeholder="Ex: 70"
                    className="w-full px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label htmlFor="duration" className="block text-xs font-medium text-blue-900 mb-1">
                    Durée (semaines)
                  </label>
                  <input
                    type="number"
                    id="duration"
                    value={goalData.duration_weeks || ''}
                    onChange={(e) => {
                      const value = e.target.value ? Number(e.target.value) : undefined;
                      setGoalData({ ...goalData, duration_weeks: value });

                      if (value && goalData.target_weight_kg && profile) {
                        const bmr = calculateBMR(profile, chooseBmrMethod(profile));
                        const tdee = calculateTDEE(bmr, goalData.activity_level);
                        const optimal = calculateOptimalDeficitOrSurplus(
                          profile.poids_kg,
                          goalData.target_weight_kg,
                          value,
                          tdee,
                          goalData.goal_type as 'loss' | 'gain'
                        );
                        setGoalData((prev) => ({ ...prev, deficit_or_surplus_pct: optimal }));
                      }
                    }}
                    min="1"
                    max="260"
                    placeholder="Ex: 20"
                    className="w-full px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {goalData.target_weight_kg && goalData.duration_weeks && profile && (
                <div className="mt-3 text-xs text-blue-700">
                  Changement : {Math.abs(goalData.target_weight_kg - profile.poids_kg).toFixed(1)} kg sur {goalData.duration_weeks} semaines
                  ({(Math.abs(goalData.target_weight_kg - profile.poids_kg) / goalData.duration_weeks).toFixed(2)} kg/sem)
                </div>
              )}
            </div>

            <div>
              <label htmlFor="deficit" className="block text-sm font-medium text-gray-700 mb-1">
                {goalData.goal_type === 'loss' ? 'Déficit calorique (%)' : 'Surplus calorique (%)'}
              </label>
              <input
                type="number"
                id="deficit"
                value={goalData.deficit_or_surplus_pct}
                onChange={(e) => setGoalData({ ...goalData, deficit_or_surplus_pct: Number(e.target.value) })}
                min="5"
                max="30"
                step="5"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="mt-1 text-xs text-gray-500">
                {goalData.target_weight_kg && goalData.duration_weeks
                  ? 'Calculé automatiquement'
                  : goalData.goal_type === 'loss'
                  ? 'Recommandé : 10-20%'
                  : 'Recommandé : 5-15%'}
              </p>
            </div>
          </>
        )}

        <div>
          <label htmlFor="protein_g_per_kg" className="block text-sm font-medium text-gray-700 mb-1">
            Protéines
          </label>
          <select
            id="protein_g_per_kg"
            value={goalData.protein_g_per_kg}
            onChange={(e) => setGoalData({ ...goalData, protein_g_per_kg: Number(e.target.value) })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {PROTEIN_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-500">
            Par kg de poids de référence (votre poids, plafonné à un IMC de 25).
          </p>
        </div>

        {profile && (
          <GoalTargetsPreview
            profile={profile}
            goal={{
              type: goalData.goal_type,
              activity_level: goalData.activity_level,
              deficit_or_surplus_pct: goalData.deficit_or_surplus_pct,
              target_weight_kg: goalData.target_weight_kg,
              duration_weeks: goalData.duration_weeks,
              protein_g_per_kg: goalData.protein_g_per_kg,
            }}
            onApplyDuration={(weeks) => {
              const next = { ...goalData, duration_weeks: weeks };
              if (goalData.target_weight_kg && goalData.goal_type !== 'maintain') {
                const tdee = calculateTDEE(calculateBMR(profile, chooseBmrMethod(profile)), goalData.activity_level);
                next.deficit_or_surplus_pct = calculateOptimalDeficitOrSurplus(
                  profile.poids_kg, goalData.target_weight_kg, weeks, tdee, goalData.goal_type
                );
              }
              setGoalData(next);
            }}
          />
        )}

        {activeGoal && (
          <p className="text-xs text-gray-500">
            Enregistrer crée un nouvel objectif qui démarre aujourd'hui : la progression repart de votre poids actuel.
          </p>
        )}

        {success && (
          <p role="status" className="p-3 bg-green-50 border border-green-200 text-green-700 rounded-md text-sm">
            {success}
          </p>
        )}
        {error && (
          <p role="alert" className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={handleSaveGoal}
          disabled={loading}
          className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-md transition-colors"
        >
          <Save className="w-5 h-5" />
          {loading ? 'Enregistrement...' : 'Enregistrer l\'objectif'}
        </button>
      </div>
  );
}
