// Formulaire d'onboarding
// Rassemble les informations personnelles et l'objectif initial de l'utilisateur,
// crée le profil, l'objectif et les cibles quotidiennes en base de données
import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  calculateCompleteTargets,
  calculateBMR,
  calculateTDEE,
  calculateOptimalDeficitOrSurplus,
  UserProfile,
  GoalParams,
} from '../../utils/calculations';

interface FormData {
  sexe: 'M' | 'F';
  date_naissance: string;
  taille_cm: number;
  poids_kg: number;
  body_fat_pct?: number;
  activity_level: number;
  goal_type: 'loss' | 'maintain' | 'gain';
  deficit_or_surplus_pct: number;
  target_weight_kg?: number;
  duration_weeks?: number;
}

interface Profile {
  id: string;
  email: string;
  sexe: 'M' | 'F';
  date_naissance: string;
  taille_cm: number;
  poids_kg: number;
  body_fat_pct?: number | null;
  created_at: string;
  updated_at: string;
}

interface Goal {
  id: string;
  user_id: string;
  type: 'loss' | 'maintain' | 'gain';
  activity_level: number;
  method: 'mifflin' | 'katch';
  deficit_or_surplus_pct: number;
  protein_g_per_kg: number;
  fat_g_per_kg_min: number;
  is_active: boolean;
  target_weight_kg?: number | null;
  duration_weeks?: number | null;
  start_date?: string | null;
  end_date?: string | null;
  created_at: string;
}

export function OnboardingForm() {
  const { user, refreshProfile } = useAuth();
  const getErrorMessage = (err: unknown, fallback: string): string =>
    err instanceof Error ? err.message : fallback;
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState<FormData>({
    sexe: 'M',
    date_naissance: '',
    taille_cm: 170,
    poids_kg: 70,
    body_fat_pct: undefined,
    activity_level: 1.55,
    goal_type: 'maintain',
    deficit_or_surplus_pct: 15,
    target_weight_kg: undefined,
    duration_weeks: undefined,
  });

  const updateFormData = (field: keyof FormData, value: FormData[keyof FormData]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Soumet le formulaire d'onboarding : crée le profil, l'objectif et les cibles journalières
  const handleSubmit = async () => {
    if (!user) return;

    setLoading(true);
    setError('');

    try {
      // Création du profil utilisateur
      const { error: profileError } = await supabase.from('profiles').insert({
        id: user.id,
        email: user.email!,
        sexe: formData.sexe,
        date_naissance: formData.date_naissance,
        taille_cm: formData.taille_cm,
        poids_kg: formData.poids_kg,
        body_fat_pct: formData.body_fat_pct || null,
      } as Profile);

      if (profileError) throw profileError;

      // Préparer dates et insertion de l'objectif
      const today = new Date().toISOString().split('T')[0];
      const endDate = formData.duration_weeks
        ? new Date(new Date().getTime() + formData.duration_weeks * 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        : null;

      const { data: goalData, error: goalError } = await supabase
        .from('goals')
        .insert({
          user_id: user.id,
          type: formData.goal_type,
          activity_level: formData.activity_level,
          method: formData.body_fat_pct ? 'katch' : 'mifflin',
          deficit_or_surplus_pct: formData.deficit_or_surplus_pct,
          protein_g_per_kg: 2.0,
          fat_g_per_kg_min: 0.8,
          is_active: true,
          target_weight_kg: formData.target_weight_kg || null,
          duration_weeks: formData.duration_weeks || null,
          start_date: formData.duration_weeks ? today : null,
          end_date: endDate,
        } as Goal)
        .select()
        .single();

      if (goalError) throw goalError;

      // Calcul des cibles caloriques et des macros à partir des fonctions utilitaires
      const targets = calculateCompleteTargets(
        {
          sexe: formData.sexe,
          date_naissance: formData.date_naissance,
          taille_cm: formData.taille_cm,
          poids_kg: formData.poids_kg,
          body_fat_pct: formData.body_fat_pct,
        } as UserProfile,
        {
          type: formData.goal_type,
          activity_level: formData.activity_level,
          method: formData.body_fat_pct ? 'katch' : 'mifflin',
          deficit_or_surplus_pct: formData.deficit_or_surplus_pct,
          protein_g_per_kg: 2.0,
          fat_g_per_kg_min: 0.8,
        } as GoalParams
      );

      // Insertion des targets journalières initiales
      const { error: targetError } = await supabase.from('daily_targets').insert({
        user_id: user.id,
        date: today,
        calories_kcal: targets.calories_kcal,
        protein_g: targets.protein_g,
        fat_g: targets.fat_g,
        carbs_g: targets.carbs_g,
        fiber_g: 25,
        goal_id: goalData.id,
      });

      if (targetError) throw targetError;

      // Rafraîchir le profil global côté application
      await refreshProfile();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Une erreur est survenue'));
      setLoading(false);
    }
  };

  if (step === 1) {
    return (
      <div className="w-full max-w-2xl mx-auto p-8 bg-white rounded-lg shadow-md">
        <h2 className="text-2xl text-gray-900 mb-6">Informations personnelles</h2>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Sexe</label>
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => updateFormData('sexe', 'M')}
                className={`flex-1 py-3 px-4 border-2 rounded-md font-medium transition-colors ${
                  formData.sexe === 'M'
                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                    : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                }`}
              >
                Homme
              </button>
              <button
                type="button"
                onClick={() => updateFormData('sexe', 'F')}
                className={`flex-1 py-3 px-4 border-2 rounded-md font-medium transition-colors ${
                  formData.sexe === 'F'
                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                    : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                }`}
              >
                Femme
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="date_naissance" className="block text-sm font-medium text-gray-700 mb-1">
              Date de naissance
            </label>
            <input
              type="date"
              id="date_naissance"
              value={formData.date_naissance}
              onChange={(e) => updateFormData('date_naissance', e.target.value)}
              max={new Date().toISOString().split('T')[0]}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="taille_cm" className="block text-sm font-medium text-gray-700 mb-1">
                Taille (cm)
              </label>
              <input
                type="number"
                id="taille_cm"
                value={formData.taille_cm}
                onChange={(e) => updateFormData('taille_cm', Number(e.target.value))}
                min="100"
                max="250"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="poids_kg" className="block text-sm font-medium text-gray-700 mb-1">
                Poids (kg)
              </label>
              <input
                type="number"
                id="poids_kg"
                value={formData.poids_kg}
                onChange={(e) => updateFormData('poids_kg', Number(e.target.value))}
                min="30"
                max="300"
                step="0.1"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label htmlFor="body_fat_pct" className="block text-sm font-medium text-gray-700 mb-1">
              Pourcentage de masse grasse (optionnel)
            </label>
            <input
              type="number"
              id="body_fat_pct"
              value={formData.body_fat_pct || ''}
              onChange={(e) => updateFormData('body_fat_pct', e.target.value ? Number(e.target.value) : undefined)}
              min="5"
              max="50"
              step="0.1"
              placeholder="Si connu"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-gray-500">
              Si fourni, la formule Katch-McArdle sera utilisée pour plus de précision
            </p>
          </div>

          <button
            onClick={() => setStep(2)}
            disabled={!formData.date_naissance}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-md transition-colors"
          >
            Suivant
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto p-8 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl text-gray-900 mb-6">Votre objectif</h2>

      {error && (
        <div className="mb-6 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
          {error}
        </div>
      )}

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Niveau d'activité</label>
          <select
            value={formData.activity_level}
            onChange={(e) => updateFormData('activity_level', Number(e.target.value))}
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
          <label className="block text-sm font-medium text-gray-700 mb-2">Objectif</label>
          <div className="grid grid-cols-3 gap-4">
            <button
              type="button"
              onClick={() => updateFormData('goal_type', 'loss')}
              className={`py-3 px-4 border-2 rounded-md font-medium transition-colors ${
                formData.goal_type === 'loss'
                  ? 'border-blue-600 bg-blue-50 text-blue-700'
                  : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
              }`}
            >
              Perte de poids
            </button>
            <button
              type="button"
              onClick={() => updateFormData('goal_type', 'maintain')}
              className={`py-3 px-4 border-2 rounded-md font-medium transition-colors ${
                formData.goal_type === 'maintain'
                  ? 'border-blue-600 bg-blue-50 text-blue-700'
                  : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
              }`}
            >
              Maintien
            </button>
            <button
              type="button"
              onClick={() => updateFormData('goal_type', 'gain')}
              className={`py-3 px-4 border-2 rounded-md font-medium transition-colors ${
                formData.goal_type === 'gain'
                  ? 'border-blue-600 bg-blue-50 text-blue-700'
                  : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
              }`}
            >
              Prise de masse
            </button>
          </div>
        </div>

        {formData.goal_type === 'maintain' ? (
          <div className="bg-blue-50 p-4 rounded-md border border-blue-200">
            <h3 className="text-sm font-semibold text-blue-900 mb-2">Durée de maintien (optionnel)</h3>
            <p className="text-xs text-blue-700 mb-3">
              Définissez une durée pour votre période de maintien. Cela vous permettra de suivre votre progression.
            </p>

            <div>
              <label htmlFor="duration_weeks_maintain" className="block text-xs font-medium text-blue-900 mb-1">
                Durée (semaines)
              </label>
              <input
                type="number"
                id="duration_weeks_maintain"
                value={formData.duration_weeks || ''}
                onChange={(e) => updateFormData('duration_weeks', e.target.value ? Number(e.target.value) : undefined)}
                min="1"
                max="260"
                placeholder="Ex: 12"
                className="w-full px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="mt-1 text-xs text-blue-600">
                Laissez vide pour un objectif de maintien sans limite de temps
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="bg-blue-50 p-4 rounded-md border border-blue-200">
              <h3 className="text-sm font-semibold text-blue-900 mb-2">Définir une période et un objectif de poids</h3>
              <p className="text-xs text-blue-700 mb-3">
                Vous pouvez définir un poids cible et une durée. Le déficit/surplus calorique sera calculé automatiquement.
              </p>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="target_weight_kg" className="block text-xs font-medium text-blue-900 mb-1">
                    Poids cible (kg)
                  </label>
                  <input
                    type="number"
                    id="target_weight_kg"
                    value={formData.target_weight_kg || ''}
                    onChange={(e) => {
                      const value = e.target.value ? Number(e.target.value) : undefined;
                      updateFormData('target_weight_kg', value);

                      if (value && formData.duration_weeks) {
                        const profile = {
                          sexe: formData.sexe,
                          date_naissance: formData.date_naissance,
                          taille_cm: formData.taille_cm,
                          poids_kg: formData.poids_kg,
                          body_fat_pct: formData.body_fat_pct,
                        };
                        const bmr = calculateBMR(profile, formData.body_fat_pct ? 'katch' : 'mifflin');
                        const tdee = calculateTDEE(bmr, formData.activity_level);
                        const optimal = calculateOptimalDeficitOrSurplus(
                          formData.poids_kg,
                          value,
                          formData.duration_weeks,
                          tdee,
                          formData.goal_type as 'loss' | 'gain'
                        );
                        updateFormData('deficit_or_surplus_pct', optimal);
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
                  <label htmlFor="duration_weeks" className="block text-xs font-medium text-blue-900 mb-1">
                    Durée (semaines)
                  </label>
                  <input
                    type="number"
                    id="duration_weeks"
                    value={formData.duration_weeks || ''}
                    onChange={(e) => {
                      const value = e.target.value ? Number(e.target.value) : undefined;
                      updateFormData('duration_weeks', value);

                      if (value && formData.target_weight_kg) {
                        const profile = {
                          sexe: formData.sexe,
                          date_naissance: formData.date_naissance,
                          taille_cm: formData.taille_cm,
                          poids_kg: formData.poids_kg,
                          body_fat_pct: formData.body_fat_pct,
                        };
                        const bmr = calculateBMR(profile, formData.body_fat_pct ? 'katch' : 'mifflin');
                        const tdee = calculateTDEE(bmr, formData.activity_level);
                        const optimal = calculateOptimalDeficitOrSurplus(
                          formData.poids_kg,
                          formData.target_weight_kg,
                          value,
                          tdee,
                          formData.goal_type as 'loss' | 'gain'
                        );
                        updateFormData('deficit_or_surplus_pct', optimal);
                      }
                    }}
                    min="1"
                    max="260"
                    placeholder="Ex: 20"
                    className="w-full px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {formData.target_weight_kg && formData.duration_weeks && (
                <div className="mt-3 text-xs text-blue-700">
                  Changement de poids : {Math.abs(formData.target_weight_kg - formData.poids_kg).toFixed(1)} kg sur {formData.duration_weeks} semaines
                  ({(Math.abs(formData.target_weight_kg - formData.poids_kg) / formData.duration_weeks).toFixed(2)} kg/semaine)
                </div>
              )}
            </div>

            <div>
              <label htmlFor="deficit_or_surplus_pct" className="block text-sm font-medium text-gray-700 mb-1">
                {formData.goal_type === 'loss' ? 'Déficit calorique (%)' : 'Surplus calorique (%)'}
              </label>
              <input
                type="number"
                id="deficit_or_surplus_pct"
                value={formData.deficit_or_surplus_pct}
                onChange={(e) => updateFormData('deficit_or_surplus_pct', Number(e.target.value))}
                min="5"
                max="30"
                step="5"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="mt-1 text-xs text-gray-500">
                {formData.target_weight_kg && formData.duration_weeks
                  ? 'Calculé automatiquement selon votre objectif'
                  : formData.goal_type === 'loss'
                  ? 'Recommandé : 10-20% pour une perte durable'
                  : 'Recommandé : 5-15% pour une prise de masse contrôlée'}
              </p>
            </div>
          </>
        )}


        <div className="flex gap-4">
          <button
            onClick={() => setStep(1)}
            className="flex-1 py-3 px-4 border border-gray-300 text-gray-700 font-medium rounded-md hover:bg-gray-50 transition-colors"
          >
            Retour
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-md transition-colors"
          >
            {loading ? 'Création...' : 'Commencer'}
          </button>
        </div>
      </div>
    </div>
  );
}
