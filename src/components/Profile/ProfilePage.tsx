// Page « Mon profil » (menu du compte) : identité (photo, prénom, nom),
// connexion (email, mot de passe), repères calculés (âge, IMC, métabolisme de
// base, dépense estimée), pesée et données corporelles.
// Le poids n'est plus un champ du profil : il vient du journal de pesées
// (une seule source de vérité, comme sur le tableau de bord).
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { KeyRound, Save } from 'lucide-react';
import { supabase, Goal } from '../../lib/supabase';
import { useAuth } from '../../contexts/useAuth';
import { fetchActiveGoal, upsertDailyTargetForGoal } from '../../services/goals';
import { recordWeight } from '../../services/weights';
import { calculateAge, calculateBMR, calculateTDEE } from '../../utils/calculations';
import { getTodayDate } from '../../utils/date';
import { PROFILE_LIMITS, validateProfileInput } from '../../utils/validation';
import { EmailChangeForm } from '../Account/EmailChangeForm';
import { NewPasswordForm } from '../Auth/NewPasswordForm';
import { IdentityCard } from './IdentityCard';
import { WeightQuickLog } from '../Weight/WeightQuickLog';

const formatNumber = (value: number, digits = 0) =>
  value.toLocaleString('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits });

export function ProfilePage() {
  const { user, profile, refreshProfile } = useAuth();
  const [activeGoal, setActiveGoal] = useState<Goal | null>(null);
  const [form, setForm] = useState(() => ({
    sexe: profile?.sexe ?? 'M',
    date_naissance: profile?.date_naissance ?? '',
    taille_cm: profile?.taille_cm ?? 170,
    body_fat_pct: profile?.body_fat_pct ?? undefined,
  }));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadGoal = useCallback(async () => {
    if (!user) return;
    try {
      setActiveGoal(await fetchActiveGoal(user.id));
    } catch (error) {
      // Non bloquant : seule la dépense estimée en dépend
      console.error('Error loading goal:', error);
    }
  }, [user]);

  useEffect(() => {
    loadGoal();
  }, [loadGoal]);

  if (!user || !profile) return null;

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();
    setMessage(null);

    const errors = validateProfileInput({ ...form, poids_kg: profile.poids_kg });
    if (errors.length > 0) {
      setMessage({ type: 'error', text: errors.join(' ') });
      return;
    }

    setSaving(true);
    try {
      const updated = {
        sexe: form.sexe,
        date_naissance: form.date_naissance,
        taille_cm: form.taille_cm,
        body_fat_pct: form.body_fat_pct || null,
      };
      const { error } = await supabase
        .from('profiles')
        .update({ ...updated, updated_at: new Date().toISOString() })
        .eq('id', user.id);
      if (error) throw error;

      // L'âge, la taille et le sexe changent les besoins : recalculer la cible du jour
      if (activeGoal) {
        await upsertDailyTargetForGoal(user.id, getTodayDate(), { ...updated, poids_kg: profile.poids_kg }, activeGoal);
      }

      await refreshProfile();
      setMessage({ type: 'success', text: 'Profil mis à jour.' });
    } catch (error) {
      console.error('Error saving profile:', error);
      setMessage({ type: 'error', text: "Le profil n'a pas pu être enregistré. Réessayez." });
    } finally {
      setSaving(false);
    }
  };

  // Pesée : si c'est la plus récente, le poids du profil et la cible du jour suivent
  const handleSaveWeight = async (weightKg: number, date: string) => {
    const profileUpdated = await recordWeight({
      userId: user.id,
      date,
      weightKg,
      profile,
      goalForToday: activeGoal,
      today: getTodayDate(),
    });
    if (profileUpdated) await refreshProfile();
  };

  // Repères calculés à partir du profil enregistré
  const age = profile.date_naissance ? calculateAge(profile.date_naissance) : null;
  const bmi = profile.poids_kg / (profile.taille_cm / 100) ** 2;
  const bmr = calculateBMR(profile, profile.body_fat_pct ? 'katch' : 'mifflin');
  const expenditure = activeGoal ? calculateTDEE(bmr, Number(activeGoal.activity_level)) : null;
  const indicators = [
    { label: 'Âge', value: age !== null ? `${age} ans` : '—' },
    { label: 'IMC', value: formatNumber(bmi, 1), hint: 'Indicatif : ne tient pas compte de la masse musculaire' },
    { label: 'Métabolisme de base', value: `${formatNumber(bmr)} kcal/j`, hint: 'Énergie dépensée au repos' },
    {
      label: 'Dépense estimée',
      value: expenditure ? `${formatNumber(expenditure)} kcal/j` : '—',
      hint: expenditure ? 'Métabolisme de base × niveau d’activité de votre objectif' : 'Définissez un objectif pour la calculer',
    },
  ];

  const inputClass =
    'w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500';
  const choiceClass = (active: boolean) =>
    `flex-1 py-3 px-4 border-2 rounded-md font-medium transition-colors ${
      active ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
    }`;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="text-2xl text-gray-900">Mon profil</h1>

      <IdentityCard />

      <section aria-label="Connexion" className="space-y-8 rounded-lg bg-white p-4 shadow-md sm:p-6">
        <EmailChangeForm />
        <section aria-labelledby="profile-password-title" className="space-y-3 border-t border-gray-200 pt-6">
          <h2 id="profile-password-title" className="flex items-center gap-2 text-lg font-semibold text-gray-900">
            <KeyRound className="h-5 w-5 text-gray-500" aria-hidden="true" />
            Mot de passe
          </h2>
          <NewPasswordForm submitLabel="Changer le mot de passe" />
        </section>
      </section>

      <section aria-labelledby="indicators-title" className="rounded-lg bg-white p-4 shadow-md sm:p-6">
        <h2 id="indicators-title" className="mb-4 text-lg text-gray-900">
          Vos repères
        </h2>
        <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {indicators.map((item) => (
            <div key={item.label} className="rounded-lg border border-gray-200 p-3">
              <dt className="text-xs font-medium text-gray-600">{item.label}</dt>
              <dd className="mt-1 text-lg font-semibold text-gray-900">{item.value}</dd>
              {item.hint && <dd className="mt-1 text-xs text-gray-500">{item.hint}</dd>}
            </div>
          ))}
        </dl>
      </section>

      <WeightQuickLog userId={user.id} date={getTodayDate()} currentWeight={profile.poids_kg} onSave={handleSaveWeight} />

      <section aria-labelledby="body-title" className="rounded-lg bg-white p-4 shadow-md sm:p-6">
        <h2 id="body-title" className="mb-1 text-lg text-gray-900">
          Données corporelles
        </h2>
        <p className="mb-6 text-sm text-gray-600">Elles servent à calculer vos besoins caloriques.</p>

        <form onSubmit={handleSave} noValidate className="space-y-6" aria-labelledby="body-title">
          <fieldset>
            <legend className="mb-2 block text-sm font-medium text-gray-700">Sexe</legend>
            <div className="flex gap-4">
              <button type="button" aria-pressed={form.sexe === 'M'} onClick={() => setForm({ ...form, sexe: 'M' })} className={choiceClass(form.sexe === 'M')}>
                Homme
              </button>
              <button type="button" aria-pressed={form.sexe === 'F'} onClick={() => setForm({ ...form, sexe: 'F' })} className={choiceClass(form.sexe === 'F')}>
                Femme
              </button>
            </div>
          </fieldset>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="date_naissance" className="mb-1 block text-sm font-medium text-gray-700">
                Date de naissance
              </label>
              <input
                type="date"
                id="date_naissance"
                value={form.date_naissance}
                max={getTodayDate()}
                onChange={(e) => setForm({ ...form, date_naissance: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="taille_cm" className="mb-1 block text-sm font-medium text-gray-700">
                Taille (cm)
              </label>
              <input
                type="number"
                id="taille_cm"
                value={form.taille_cm}
                min={PROFILE_LIMITS.taille_cm.min}
                max={PROFILE_LIMITS.taille_cm.max}
                onChange={(e) => setForm({ ...form, taille_cm: Number(e.target.value) })}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="body_fat_pct" className="mb-1 block text-sm font-medium text-gray-700">
                Masse grasse (%, optionnel)
              </label>
              <input
                type="number"
                id="body_fat_pct"
                value={form.body_fat_pct ?? ''}
                min={PROFILE_LIMITS.body_fat_pct.min}
                max={PROFILE_LIMITS.body_fat_pct.max}
                step="0.1"
                placeholder="Si connue"
                onChange={(e) => setForm({ ...form, body_fat_pct: e.target.value ? Number(e.target.value) : undefined })}
                className={inputClass}
              />
            </div>
          </div>

          <p className="text-xs text-gray-500">
            Poids actuel : {formatNumber(profile.poids_kg, 1)} kg. Il se met à jour avec vos pesées (carte « Ma pesée »).
          </p>

          {message && (
            <p
              role={message.type === 'error' ? 'alert' : 'status'}
              className={`rounded-md border p-3 text-sm ${
                message.type === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-green-200 bg-green-50 text-green-700'
              }`}
            >
              {message.text}
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-3 font-medium text-white transition-colors hover:bg-blue-700 disabled:bg-blue-400"
          >
            <Save className="h-5 w-5" aria-hidden="true" />
            {saving ? 'Enregistrement…' : 'Enregistrer les données'}
          </button>
        </form>
      </section>
    </div>
  );
}
