// Formulaire d'onboarding
// Rassemble les informations personnelles et l'objectif initial de l'utilisateur,
// crée le profil, l'objectif et les cibles quotidiennes en base de données
import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/useAuth';
import {
  calculateBMR,
  calculateTDEE,
  calculateOptimalDeficitOrSurplus,
  UserProfile,
} from '../../utils/calculations';
import { getTodayDate } from '../../utils/date';
import { formatNumber } from '../../utils/format';
import { activateNewGoal } from '../../services/goals';
import { chooseBmrMethod } from '../../utils/goals';
import { upsertWeightLog } from '../../services/weights';
import { PROFILE_LIMITS, validateGoalInput, validateProfileInput } from '../../utils/validation';
import { GoalTargetsPreview } from '../Goals/GoalTargetsPreview';

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

export function OnboardingForm() {
  const { user, refreshProfile } = useAuth();
  const getErrorMessage = (err: unknown, fallback: string): string =>
    err instanceof Error ? err.message : fallback;
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [profileErrors, setProfileErrors] = useState<string[]>([]);

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

  // Passage à l'étape 2 : uniquement si le profil est valide
  const handleNextStep = () => {
    const errors = validateProfileInput(formData);
    setProfileErrors(errors);
    if (errors.length === 0) {
      setStep(2);
    }
  };

  // Soumet le formulaire d'onboarding : crée le profil, l'objectif et les cibles journalières
  const handleSubmit = async () => {
    if (!user) return;

    // Validation avant tout envoi : messages clairs plutôt qu'erreurs Postgres
    const validationErrors = [
      ...validateProfileInput(formData),
      ...validateGoalInput(
        {
          type: formData.goal_type,
          activity_level: formData.activity_level,
          deficit_or_surplus_pct: formData.deficit_or_surplus_pct,
          target_weight_kg: formData.target_weight_kg,
          duration_weeks: formData.duration_weeks,
        },
        formData.poids_kg
      ),
    ];
    if (validationErrors.length > 0) {
      setError(validationErrors.join(' '));
      return;
    }

    setLoading(true);
    setError('');

    try {
      const userProfile: UserProfile = {
        sexe: formData.sexe,
        date_naissance: formData.date_naissance,
        taille_cm: formData.taille_cm,
        poids_kg: formData.poids_kg,
        body_fat_pct: formData.body_fat_pct || null,
      };

      // Création du profil utilisateur.
      // upsert (et non insert) : si une tentative précédente a créé le profil mais
      // échoué ensuite, renvoyer le formulaire ne bloque plus sur une clé dupliquée.
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({ id: user.id, email: user.email!, ...userProfile }, { onConflict: 'id' });

      if (profileError) throw profileError;

      // Première pesée du journal (non bloquant : l'inscription doit aboutir même
      // si le journal de pesées est momentanément indisponible)
      try {
        await upsertWeightLog(user.id, getTodayDate(), formData.poids_kg);
      } catch (weightError) {
        console.warn('Première pesée non enregistrée', weightError);
      }

      // Création de l'objectif (désactive un éventuel objectif d'une tentative
      // précédente) et de la cible du jour
      await activateNewGoal(
        user.id,
        userProfile,
        {
          type: formData.goal_type,
          activity_level: formData.activity_level,
          deficit_or_surplus_pct: formData.deficit_or_surplus_pct,
          target_weight_kg: formData.target_weight_kg,
          duration_weeks: formData.duration_weeks,
        },
        getTodayDate()
      );

      // Rafraîchir le profil global côté application (l'app passe alors au tableau de bord)
      await refreshProfile();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Une erreur est survenue'));
    } finally {
      // Auparavant, le bouton restait bloqué sur « Création... » si le
      // rechargement du profil échouait.
      setLoading(false);
    }
  };

  if (step === 1) {
    return (
      <div className="w-full max-w-2xl mx-auto p-8 panel">
        <h2 className="page-title mb-6">Informations personnelles</h2>

        <div className="space-y-6">
          <div>
            <label className="field-label mb-2">Sexe</label>
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => updateFormData('sexe', 'M')}
                className={`flex-1 py-3 px-4 border-2 rounded-md font-medium transition-colors ${
                  formData.sexe === 'M'
                    ? 'border-primary-600 bg-primary-50 text-primary-700'
                    : 'border-line-strong bg-surface text-body hover:border-line-emphasis'
                }`}
              >
                Homme
              </button>
              <button
                type="button"
                onClick={() => updateFormData('sexe', 'F')}
                className={`flex-1 py-3 px-4 border-2 rounded-md font-medium transition-colors ${
                  formData.sexe === 'F'
                    ? 'border-primary-600 bg-primary-50 text-primary-700'
                    : 'border-line-strong bg-surface text-body hover:border-line-emphasis'
                }`}
              >
                Femme
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="date_naissance" className="field-label mb-1">
              Date de naissance
            </label>
            <input
              type="date"
              id="date_naissance"
              value={formData.date_naissance}
              onChange={(e) => updateFormData('date_naissance', e.target.value)}
              max={getTodayDate()}
              required
              className="w-full px-3 py-2 field-input"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="taille_cm" className="field-label mb-1">
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
                className="w-full px-3 py-2 field-input"
              />
            </div>

            <div>
              <label htmlFor="poids_kg" className="field-label mb-1">
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
                className="w-full px-3 py-2 field-input"
              />
            </div>
          </div>

          <div>
            <label htmlFor="body_fat_pct" className="field-label mb-1">
              Pourcentage de masse grasse (optionnel)
            </label>
            <input
              type="number"
              id="body_fat_pct"
              value={formData.body_fat_pct || ''}
              onChange={(e) => updateFormData('body_fat_pct', e.target.value ? Number(e.target.value) : undefined)}
              min={PROFILE_LIMITS.body_fat_pct.min}
              max={PROFILE_LIMITS.body_fat_pct.max}
              step="0.1"
              placeholder="Si connu"
              className="w-full px-3 py-2 field-input"
            />
            <p className="mt-1 text-xs text-subtle">
              Si fourni, la formule Katch-McArdle sera utilisée pour plus de précision
            </p>
          </div>

          {profileErrors.length > 0 && (
            <div role="alert" className="p-3 bg-danger-50 border border-danger-200 text-danger-700 rounded-md text-sm">
              <ul className="list-disc pl-5 space-y-1">
                {profileErrors.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            </div>
          )}

          <button
            type="button"
            onClick={handleNextStep}
            disabled={!formData.date_naissance}
            className="w-full py-3 px-4 btn-primary font-medium rounded-md"
          >
            Suivant
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto p-8 panel">
      <h2 className="page-title mb-6">Votre objectif</h2>

      {error && (
        <div className="mb-6 p-3 bg-danger-50 border border-danger-200 text-danger-700 rounded-md text-sm">
          {error}
        </div>
      )}

      <div className="space-y-6">
        <div>
          <label className="field-label mb-2">Niveau d'activité</label>
          <select
            value={formData.activity_level}
            onChange={(e) => updateFormData('activity_level', Number(e.target.value))}
            className="w-full px-3 py-2 field-input"
          >
            <option value={1.2}>Sédentaire (peu ou pas d'exercice)</option>
            <option value={1.375}>Légèrement actif (1-3 jours/semaine)</option>
            <option value={1.55}>Modérément actif (3-5 jours/semaine)</option>
            <option value={1.725}>Très actif (6-7 jours/semaine)</option>
            <option value={1.9}>Extrêmement actif (2x par jour)</option>
          </select>
        </div>

        <div>
          <label className="field-label mb-2">Objectif</label>
          <div className="grid grid-cols-3 gap-4">
            <button
              type="button"
              onClick={() => updateFormData('goal_type', 'loss')}
              className={`py-3 px-4 border-2 rounded-md font-medium transition-colors ${
                formData.goal_type === 'loss'
                  ? 'border-primary-600 bg-primary-50 text-primary-700'
                  : 'border-line-strong bg-surface text-body hover:border-line-emphasis'
              }`}
            >
              Perte de poids
            </button>
            <button
              type="button"
              onClick={() => updateFormData('goal_type', 'maintain')}
              className={`py-3 px-4 border-2 rounded-md font-medium transition-colors ${
                formData.goal_type === 'maintain'
                  ? 'border-primary-600 bg-primary-50 text-primary-700'
                  : 'border-line-strong bg-surface text-body hover:border-line-emphasis'
              }`}
            >
              Maintien
            </button>
            <button
              type="button"
              onClick={() => updateFormData('goal_type', 'gain')}
              className={`py-3 px-4 border-2 rounded-md font-medium transition-colors ${
                formData.goal_type === 'gain'
                  ? 'border-primary-600 bg-primary-50 text-primary-700'
                  : 'border-line-strong bg-surface text-body hover:border-line-emphasis'
              }`}
            >
              Prise de masse
            </button>
          </div>
        </div>

        {formData.goal_type === 'maintain' ? (
          <div className="bg-primary-50 p-4 rounded-md border border-primary-200">
            <h3 className="text-sm font-semibold text-primary-900 mb-2">Durée de maintien (optionnel)</h3>
            <p className="text-xs text-primary-700 mb-3">
              Définissez une durée pour votre période de maintien. Cela vous permettra de suivre votre progression.
            </p>

            <div>
              <label htmlFor="duration_weeks_maintain" className="block text-xs font-medium text-primary-900 mb-1">
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
                className="w-full px-3 py-2 border border-primary-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-600"
              />
              <p className="mt-1 text-xs text-primary-700">
                Laissez vide pour un objectif de maintien sans limite de temps
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="bg-primary-50 p-4 rounded-md border border-primary-200">
              <h3 className="text-sm font-semibold text-primary-900 mb-2">Définir une période et un objectif de poids</h3>
              <p className="text-xs text-primary-700 mb-3">
                Vous pouvez définir un poids cible et une durée. Le déficit/surplus calorique sera calculé automatiquement.
              </p>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="target_weight_kg" className="block text-xs font-medium text-primary-900 mb-1">
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
                        const bmr = calculateBMR(profile, chooseBmrMethod(profile));
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
                    className="w-full px-3 py-2 border border-primary-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-600"
                  />
                </div>

                <div>
                  <label htmlFor="duration_weeks" className="block text-xs font-medium text-primary-900 mb-1">
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
                        const bmr = calculateBMR(profile, chooseBmrMethod(profile));
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
                    className="w-full px-3 py-2 border border-primary-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-600"
                  />
                </div>
              </div>

              {formData.target_weight_kg && formData.duration_weeks && (
                <div className="mt-3 text-xs text-primary-700">
                  Changement de poids : {formatNumber(Math.abs(formData.target_weight_kg - formData.poids_kg), 1)} kg sur {formData.duration_weeks} semaines
                  ({formatNumber(Math.abs(formData.target_weight_kg - formData.poids_kg) / formData.duration_weeks, 2)} kg/semaine)
                </div>
              )}
            </div>

            <div>
              <label htmlFor="deficit_or_surplus_pct" className="field-label mb-1">
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
                className="w-full px-3 py-2 field-input"
              />
              <p className="mt-1 text-xs text-subtle">
                {formData.target_weight_kg && formData.duration_weeks
                  ? 'Calculé automatiquement selon votre objectif'
                  : formData.goal_type === 'loss'
                  ? 'Recommandé : 10-20% pour une perte durable'
                  : 'Recommandé : 5-15% pour une prise de masse contrôlée'}
              </p>
            </div>
          </>
        )}


        <GoalTargetsPreview
          profile={{
            sexe: formData.sexe,
            date_naissance: formData.date_naissance,
            taille_cm: formData.taille_cm,
            poids_kg: formData.poids_kg,
            body_fat_pct: formData.body_fat_pct,
          }}
          goal={{
            type: formData.goal_type,
            activity_level: formData.activity_level,
            deficit_or_surplus_pct: formData.deficit_or_surplus_pct,
            target_weight_kg: formData.target_weight_kg,
            duration_weeks: formData.duration_weeks,
          }}
          onApplyDuration={(weeks) => {
            updateFormData('duration_weeks', weeks);
            if (formData.target_weight_kg && formData.goal_type !== 'maintain') {
              const profile = {
                sexe: formData.sexe,
                date_naissance: formData.date_naissance,
                taille_cm: formData.taille_cm,
                poids_kg: formData.poids_kg,
                body_fat_pct: formData.body_fat_pct,
              };
              const tdee = calculateTDEE(calculateBMR(profile, chooseBmrMethod(profile)), formData.activity_level);
              updateFormData(
                'deficit_or_surplus_pct',
                calculateOptimalDeficitOrSurplus(formData.poids_kg, formData.target_weight_kg, weeks, tdee, formData.goal_type)
              );
            }
          }}
        />

        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => setStep(1)}
            className="flex-1 py-3 px-4 btn-secondary font-medium rounded-md"
          >
            Retour
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 py-3 px-4 btn-primary font-medium rounded-md"
          >
            {loading ? 'Création...' : 'Commencer'}
          </button>
        </div>
      </div>
    </div>
  );
}
