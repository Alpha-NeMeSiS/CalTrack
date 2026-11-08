// Page « Mon profil » (menu du compte) : identité (photo, prénom, nom),
// connexion (email, mot de passe), repères calculés (âge, IMC, métabolisme de
// base, dépense estimée, masse maigre), pesée et données corporelles (dont
// des mesures détaillées facultatives : eau, graisse viscérale, muscles, os).
// Le poids n'est plus un champ du profil : il vient du journal de pesées
// (une seule source de vérité, comme sur le tableau de bord).
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { KeyRound, Save } from 'lucide-react';
import { supabase, Goal, BodyComposition } from '../../lib/supabase';
import { useAuth } from '../../contexts/useAuth';
import { fetchActiveGoal, upsertDailyTargetForGoal } from '../../services/goals';
import { recordWeight } from '../../services/weights';
import { calculateAge, calculateBMR, calculateTDEE, estimateLeanMass, LeanMassSource } from '../../utils/calculations';
import { chooseBmrMethod } from '../../utils/goals';
import { getTodayDate } from '../../utils/date';
import { PROFILE_LIMITS, validateProfileInput } from '../../utils/validation';
import { EmailChangeForm } from '../Account/EmailChangeForm';
import { NewPasswordForm } from '../Auth/NewPasswordForm';
import { IdentityCard } from './IdentityCard';
import { WeightQuickLog } from '../Weight/WeightQuickLog';
import { formatNumber } from '../../utils/format';


/** Mesures détaillées facultatives (balance impédancemètre, bilan) */
type DetailedField = 'body_water_pct' | 'muscle_mass_kg' | 'bone_mass_kg' | 'visceral_fat_rating';

const DETAILED_FIELDS: { key: DetailedField; label: string; step: string; hint: string }[] = [
  { key: 'muscle_mass_kg', label: 'Masse musculaire (kg)', step: '0.1', hint: 'Avec la masse osseuse, donne votre masse maigre.' },
  { key: 'bone_mass_kg', label: 'Masse osseuse (kg)', step: '0.1', hint: 'Souvent entre 2 et 4 kg.' },
  {
    key: 'body_water_pct',
    label: 'Eau corporelle (%)',
    step: '0.1',
    hint: 'Sert à estimer la masse maigre si la masse grasse et les muscles ne sont pas connus.',
  },
  {
    key: 'visceral_fat_rating',
    label: 'Graisse viscérale (indice)',
    step: '1',
    hint: 'Indicateur de santé : il ne change pas le calcul.',
  },
];

const LEAN_MASS_SOURCE_LABELS: Record<LeanMassSource, string> = {
  body_fat: 'D’après votre masse grasse',
  muscle_bone: 'Masse musculaire + masse osseuse',
  muscle: 'D’après votre masse musculaire (os estimés)',
  water: 'D’après votre eau corporelle',
};

const optionalNumber = (value: string) => (value ? Number(value) : undefined);

export function ProfilePage() {
  const { user, profile, refreshProfile } = useAuth();
  const [activeGoal, setActiveGoal] = useState<Goal | null>(null);
  const [form, setForm] = useState(() => ({
    sexe: profile?.sexe ?? 'M',
    date_naissance: profile?.date_naissance ?? '',
    taille_cm: profile?.taille_cm ?? 170,
    body_fat_pct: profile?.body_fat_pct ?? undefined,
    body_water_pct: profile?.body_water_pct ?? undefined,
    visceral_fat_rating: profile?.visceral_fat_rating ?? undefined,
    muscle_mass_kg: profile?.muscle_mass_kg ?? undefined,
    bone_mass_kg: profile?.bone_mass_kg ?? undefined,
  }));
  // Section ouverte d'emblée si des mesures détaillées sont déjà saisies
  const [detailsOpen, setDetailsOpen] = useState(() => DETAILED_FIELDS.some(({ key }) => profile?.[key] != null));
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

  // Composition mise à jour ailleurs (pesée avec composition) : le formulaire
  // la reprend, sinon un enregistrement remettrait les anciennes valeurs
  const { body_fat_pct, body_water_pct, visceral_fat_rating, muscle_mass_kg, bone_mass_kg } = profile ?? {};
  useEffect(() => {
    setForm((current) => ({
      ...current,
      body_fat_pct: body_fat_pct ?? undefined,
      body_water_pct: body_water_pct ?? undefined,
      visceral_fat_rating: visceral_fat_rating ?? undefined,
      muscle_mass_kg: muscle_mass_kg ?? undefined,
      bone_mass_kg: bone_mass_kg ?? undefined,
    }));
  }, [body_fat_pct, body_water_pct, visceral_fat_rating, muscle_mass_kg, bone_mass_kg]);

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
        body_water_pct: form.body_water_pct || null,
        visceral_fat_rating: form.visceral_fat_rating || null,
        muscle_mass_kg: form.muscle_mass_kg || null,
        bone_mass_kg: form.bone_mass_kg || null,
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
  const handleSaveWeight = async (weightKg: number, date: string, composition?: BodyComposition) => {
    const profileUpdated = await recordWeight({
      userId: user.id,
      date,
      weightKg,
      composition,
      profile,
      goalForToday: activeGoal,
      today: getTodayDate(),
    });
    if (profileUpdated) await refreshProfile();
  };

  // Repères calculés à partir du profil enregistré
  const age = profile.date_naissance ? calculateAge(profile.date_naissance) : null;
  const bmi = profile.poids_kg / (profile.taille_cm / 100) ** 2;
  const leanMass = estimateLeanMass(profile);
  const bmr = calculateBMR(profile, chooseBmrMethod(profile));
  const expenditure = activeGoal ? calculateTDEE(bmr, Number(activeGoal.activity_level)) : null;
  const indicators = [
    { label: 'Âge', value: age !== null ? `${age} ans` : '—' },
    { label: 'IMC', value: formatNumber(bmi, 1), hint: 'Indicatif : ne tient pas compte de la masse musculaire' },
    {
      label: 'Métabolisme de base',
      value: `${formatNumber(bmr)} kcal/j`,
      hint: leanMass
        ? 'Énergie dépensée au repos · formule Katch-McArdle (masse maigre)'
        : 'Énergie dépensée au repos · formule Mifflin-St Jeor (poids, taille, âge)',
    },
    {
      label: 'Dépense estimée',
      value: expenditure ? `${formatNumber(expenditure)} kcal/j` : '—',
      hint: expenditure ? 'Métabolisme de base × niveau d’activité de votre objectif' : 'Définissez un objectif pour la calculer',
    },
    {
      label: 'Masse maigre',
      value: leanMass ? `${formatNumber(leanMass.kg, 1)} kg` : '—',
      hint: leanMass
        ? LEAN_MASS_SOURCE_LABELS[leanMass.source]
        : 'Ajoutez une mesure détaillée (masse grasse, muscles, eau) pour l’estimer',
    },
    ...(profile.visceral_fat_rating
      ? [
          {
            label: 'Graisse viscérale',
            value: String(profile.visceral_fat_rating),
            hint: 'Indicateur de santé : 1 à 12 est la zone saine sur la plupart des balances',
          },
        ]
      : []),
  ];

  const inputClass =
    'w-full px-3 py-2 field-input';
  const choiceClass = (active: boolean) =>
    `flex-1 py-3 px-4 border-2 rounded-md font-medium transition-colors ${
      active ? 'border-primary-600 bg-primary-50 text-primary-700' : 'border-line-strong bg-surface text-body hover:border-line-emphasis'
    }`;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="page-title">Mon profil</h1>

      <IdentityCard />

      <section aria-label="Connexion" className="space-y-8 panel p-4 sm:p-6">
        <EmailChangeForm />
        <section aria-labelledby="profile-password-title" className="space-y-3 border-t border-line pt-6">
          <h2 id="profile-password-title" className="flex items-center gap-2 card-title">
            <KeyRound className="h-5 w-5 text-subtle" aria-hidden="true" />
            Mot de passe
          </h2>
          <NewPasswordForm submitLabel="Changer le mot de passe" />
        </section>
      </section>

      <section aria-labelledby="indicators-title" className="panel p-4 sm:p-6">
        <h2 id="indicators-title" className="mb-4 card-title">
          Vos repères
        </h2>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {indicators.map((item) => (
            <div key={item.label} className="rounded-lg border border-line p-3">
              <dt className="text-xs font-medium text-muted">{item.label}</dt>
              <dd className="mt-1 text-lg font-semibold text-ink">{item.value}</dd>
              {item.hint && <dd className="mt-1 text-xs text-subtle">{item.hint}</dd>}
            </div>
          ))}
        </dl>
      </section>

      <WeightQuickLog userId={user.id} date={getTodayDate()} currentWeight={profile.poids_kg} onSave={handleSaveWeight} />

      <section aria-labelledby="body-title" className="panel p-4 sm:p-6">
        <h2 id="body-title" className="mb-1 card-title">
          Données corporelles
        </h2>
        <p className="mb-6 text-sm text-muted">Elles servent à calculer vos besoins caloriques.</p>

        <form onSubmit={handleSave} noValidate className="space-y-6" aria-labelledby="body-title">
          <fieldset>
            <legend className="mb-2 field-label">Sexe</legend>
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
              <label htmlFor="date_naissance" className="mb-1 field-label">
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
              <label htmlFor="taille_cm" className="mb-1 field-label">
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
              <label htmlFor="body_fat_pct" className="mb-1 field-label">
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

          <details
            open={detailsOpen}
            onToggle={(event) => setDetailsOpen(event.currentTarget.open)}
            className="rounded-md border border-line"
          >
            <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium text-ink">
              Mesures détaillées <span className="font-normal text-subtle">(facultatif)</span>
            </summary>
            <div className="space-y-4 border-t border-line p-4">
              <p className="text-xs text-muted">
                Valeurs d’une balance impédancemètre ou d’un bilan (salle de sport, diététicien). Elles servent à estimer
                votre masse maigre, pour un métabolisme de base plus précis. Renseignez seulement celles que vous avez et
                mettez-les à jour de temps en temps.
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {DETAILED_FIELDS.map((field) => {
                  const limits = PROFILE_LIMITS[field.key];
                  return (
                    <div key={field.key}>
                      <label htmlFor={field.key} className="mb-1 field-label">
                        {field.label}
                      </label>
                      <input
                        type="number"
                        id={field.key}
                        inputMode="decimal"
                        value={form[field.key] ?? ''}
                        min={limits.min}
                        max={limits.max}
                        step={field.step}
                        aria-describedby={`${field.key}-hint`}
                        onChange={(e) => setForm({ ...form, [field.key]: optionalNumber(e.target.value) })}
                        className={inputClass}
                      />
                      <p id={`${field.key}-hint`} className="mt-1 text-xs text-subtle">
                        {field.hint}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </details>

          <p className="text-xs text-subtle">
            Poids actuel : {formatNumber(profile.poids_kg, 1)} kg. Il se met à jour avec vos pesées (carte « Ma pesée »).
          </p>

          {message && (
            <p
              role={message.type === 'error' ? 'alert' : 'status'}
              className={`rounded-md border p-3 text-sm ${
                message.type === 'error' ? 'border-danger-200 bg-danger-50 text-danger-700' : 'border-success-200 bg-success-50 text-success-700'
              }`}
            >
              {message.text}
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-md btn-primary px-4 py-3 font-medium"
          >
            <Save className="h-5 w-5" aria-hidden="true" />
            {saving ? 'Enregistrement…' : 'Enregistrer les données'}
          </button>
        </form>
      </section>
    </div>
  );
}
