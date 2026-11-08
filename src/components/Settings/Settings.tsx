// Page des paramètres utilisateur
// Contient les onglets Profil et Objectif, ainsi que la logique de sauvegarde
import { useState, useEffect, useCallback } from 'react';
import { User, Target, Save } from 'lucide-react';
import { supabase, Goal } from '../../lib/supabase';
import { useAuth } from '../../contexts/useAuth';
import { calculateBMR, calculateTDEE, calculateOptimalDeficitOrSurplus } from '../../utils/calculations';
import { getTodayDate } from '../../utils/date';
import { activateNewGoal, fetchActiveGoal, upsertDailyTargetForGoal } from '../../services/goals';
import { PROFILE_LIMITS, validateGoalInput, validateProfileInput } from '../../utils/validation';
import { DEFAULT_PROTEIN_G_PER_KG } from '../../utils/goals';
import { GoalTargetsPreview } from '../Goals/GoalTargetsPreview';

const PROTEIN_OPTIONS = [
  { value: 1.6, label: '1,6 g/kg — modéré' },
  { value: 1.8, label: '1,8 g/kg' },
  { value: 2.0, label: '2,0 g/kg — recommandé (défaut)' },
  { value: 2.2, label: '2,2 g/kg — sportif / sèche' },
];

export function Settings() {
  // Récupère l'utilisateur, le profil et la fonction pour rafraîchir le profil
  const { user, profile, refreshProfile } = useAuth();
  const getErrorMessage = (err: unknown, fallback: string): string =>
    err instanceof Error ? err.message : fallback;

  // États d'interface
  const [activeTab, setActiveTab] = useState<'profile' | 'goal'>('profile');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  // Données locales du profil (formulaire)
  const [profileData, setProfileData] = useState({
    sexe: profile?.sexe || 'M',
    date_naissance: profile?.date_naissance || '',
    taille_cm: profile?.taille_cm || 170,
    poids_kg: profile?.poids_kg || 70,
    body_fat_pct: profile?.body_fat_pct || undefined,
  });

  // Objectif actif et données du formulaire d'objectif
  const [activeGoal, setActiveGoal] = useState<Goal | null>(null);
  const [goalData, setGoalData] = useState({
    goal_type: 'maintain' as 'loss' | 'maintain' | 'gain',
    activity_level: 1.55,
    deficit_or_surplus_pct: 15,
    target_weight_kg: undefined as number | undefined,
    duration_weeks: undefined as number | undefined,
    protein_g_per_kg: DEFAULT_PROTEIN_G_PER_KG,
  });

  // Quand le profil change (chargé), on initialise les champs du formulaire
  useEffect(() => {
    if (profile) {
      setProfileData({
        sexe: profile.sexe,
        date_naissance: profile.date_naissance,
        taille_cm: profile.taille_cm,
        poids_kg: profile.poids_kg,
        body_fat_pct: profile.body_fat_pct ?? undefined,
      });
    }
  }, [profile]);

  // Charger l'objectif actif à l'initialisation / changement d'utilisateur
  // Charge l'objectif actif depuis la table 'goals'
  const loadActiveGoal = useCallback(async () => {
    if (!user) return;

    try {
      const data = await fetchActiveGoal(user.id);

      if (data) {
        setActiveGoal(data);
        setGoalData({
          goal_type: data.type,
          activity_level: data.activity_level,
          // Un objectif de maintien est enregistré avec 0 % : proposer 15 % par défaut
          // si l'utilisateur repasse en perte ou en prise
          deficit_or_surplus_pct: data.deficit_or_surplus_pct || 15,
          target_weight_kg: data.target_weight_kg || undefined,
          duration_weeks: data.duration_weeks || undefined,
          protein_g_per_kg: Number(data.protein_g_per_kg) || DEFAULT_PROTEIN_G_PER_KG,
        });
      }
    } catch (err) {
      console.error('Error loading goal:', err);
    }
  }, [user]);

  useEffect(() => {
    loadActiveGoal();
  }, [loadActiveGoal]);

  // Sauvegarde du profil en base
  const handleSaveProfile = async () => {
    if (!user) return;

    setError('');
    setSuccess('');

    const validationErrors = validateProfileInput(profileData);
    if (validationErrors.length > 0) {
      setError(validationErrors.join(' '));
      return;
    }

    setLoading(true);

    try {
      const updatedProfile = {
        sexe: profileData.sexe,
        date_naissance: profileData.date_naissance,
        taille_cm: profileData.taille_cm,
        poids_kg: profileData.poids_kg,
        body_fat_pct: profileData.body_fat_pct || null,
      };

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          ...updatedProfile,
          // Timestamp complet : toISOString() (UTC) est correct ici
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (updateError) throw updateError;

      // Le poids / l'âge / la taille changent les besoins : recalculer la cible du jour
      if (activeGoal) {
        await upsertDailyTargetForGoal(user.id, getTodayDate(), updatedProfile, activeGoal);
      }

      // Rafraîchir le profil global après modification
      await refreshProfile();
      setSuccess('Profil mis à jour avec succès');
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Erreur lors de la mise à jour'));
    } finally {
      setLoading(false);
    }
  };

  // Sauvegarde ou création d'un nouvel objectif
  const handleSaveGoal = async () => {
    if (!user || !profile) return;

    setError('');
    setSuccess('');

    const validationErrors = validateGoalInput(
      {
        type: goalData.goal_type,
        activity_level: goalData.activity_level,
        deficit_or_surplus_pct: goalData.deficit_or_surplus_pct,
        target_weight_kg: goalData.target_weight_kg,
        duration_weeks: goalData.duration_weeks,
        protein_g_per_kg: goalData.protein_g_per_kg,
      },
      profile.poids_kg
    );
    if (validationErrors.length > 0) {
      setError(validationErrors.join(' '));
      return;
    }

    setLoading(true);

    try {
      // Crée le nouvel objectif, désactive l'ancien et met à jour (upsert) la cible du jour.
      // Auparavant, la cible du jour existante était conservée (erreur 23505 ignorée)
      // et le nouvel objectif ne s'appliquait pas avant le lendemain.
      await activateNewGoal(
        user.id,
        profile,
        {
          type: goalData.goal_type,
          activity_level: goalData.activity_level,
          deficit_or_surplus_pct: goalData.deficit_or_surplus_pct,
          target_weight_kg: goalData.target_weight_kg,
          duration_weeks: goalData.duration_weeks,
          protein_g_per_kg: goalData.protein_g_per_kg,
        },
        getTodayDate()
      );

      await loadActiveGoal();
      setSuccess('Objectif mis à jour avec succès');
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Erreur lors de la mise à jour'));
    } finally {
      setLoading(false);
    }
  };

  // Rendu JSX de la page des paramètres
  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl text-gray-900 mb-6">Paramètres</h1>

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="border-b border-gray-200">
          <div className="flex">
            <button
              type="button"
              onClick={() => { setActiveTab('profile'); setError(''); setSuccess(''); }}
              className={`flex items-center gap-2 px-6 py-4 font-medium transition-colors ${
                activeTab === 'profile'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <User className="w-5 h-5" />
              Profil
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab('goal'); setError(''); setSuccess(''); }}
              className={`flex items-center gap-2 px-6 py-4 font-medium transition-colors ${
                activeTab === 'goal'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Target className="w-5 h-5" />
              Objectif
            </button>
          </div>
        </div>

        <div className="p-6">
          {success && (
            <div className="mb-6 p-3 bg-green-50 border border-green-200 text-green-700 rounded-md text-sm">
              {success}
            </div>
          )}

          {error && (
            <div className="mb-6 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
              {error}
            </div>
          )}

          {activeTab === 'profile' ? (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Sexe</label>
                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => setProfileData({ ...profileData, sexe: 'M' })}
                    className={`flex-1 py-3 px-4 border-2 rounded-md font-medium transition-colors ${
                      profileData.sexe === 'M'
                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                        : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                    }`}
                  >
                    Homme
                  </button>
                  <button
                    type="button"
                    onClick={() => setProfileData({ ...profileData, sexe: 'F' })}
                    className={`flex-1 py-3 px-4 border-2 rounded-md font-medium transition-colors ${
                      profileData.sexe === 'F'
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
                  value={profileData.date_naissance}
                  onChange={(e) => setProfileData({ ...profileData, date_naissance: e.target.value })}
                  max={getTodayDate()}
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
                    value={profileData.taille_cm}
                    onChange={(e) => setProfileData({ ...profileData, taille_cm: Number(e.target.value) })}
                    min="100"
                    max="250"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label htmlFor="poids_kg" className="block text-sm font-medium text-gray-700 mb-1">
                    Poids actuel (kg)
                  </label>
                  <input
                    type="number"
                    id="poids_kg"
                    value={profileData.poids_kg}
                    onChange={(e) => setProfileData({ ...profileData, poids_kg: Number(e.target.value) })}
                    min="30"
                    max="300"
                    step="0.1"
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
                  value={profileData.body_fat_pct || ''}
                  onChange={(e) => setProfileData({ ...profileData, body_fat_pct: e.target.value ? Number(e.target.value) : undefined })}
                  min={PROFILE_LIMITS.body_fat_pct.min}
                  max={PROFILE_LIMITS.body_fat_pct.max}
                  step="0.1"
                  placeholder="Si connu"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <button
                onClick={handleSaveProfile}
                disabled={loading}
                className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-md transition-colors"
              >
                <Save className="w-5 h-5" />
                {loading ? 'Enregistrement...' : 'Enregistrer le profil'}
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Niveau d'activité</label>
                <select
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
                              const bmr = calculateBMR(profile, profile.body_fat_pct ? 'katch' : 'mifflin');
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
                              const bmr = calculateBMR(profile, profile.body_fat_pct ? 'katch' : 'mifflin');
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
                      const tdee = calculateTDEE(calculateBMR(profile, profile.body_fat_pct ? 'katch' : 'mifflin'), goalData.activity_level);
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

              <button
                onClick={handleSaveGoal}
                disabled={loading}
                className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-md transition-colors"
              >
                <Save className="w-5 h-5" />
                {loading ? 'Enregistrement...' : 'Enregistrer l\'objectif'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
