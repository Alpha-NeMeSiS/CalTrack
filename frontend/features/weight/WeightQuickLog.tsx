// Saisie rapide d'une pesée depuis le tableau de bord.
// Enregistre la pesée pour la date affichée (permet aussi de rattraper un jour
// passé), avec son moment (le matin à jeun ou plus tard) et la composition
// facultative d'une balance impédancemètre. Affiche la dernière pesée de
// référence avec l'évolution sur 7 jours : seules les pesées du matin comptent
// (voir referenceWeights), une pesée « plus tard » ne remplace pas celle du matin.
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Scale } from 'lucide-react';
import type { BodyComposition, WeightLog } from '../../shared/supabase';
import { fetchWeightLogs } from './weights.service';
import { addDaysToDateString, getTodayDate, parseLocalDate } from '../../shared/date';
import { formatDecimal, formatKg } from '../../shared/format';
import { PROFILE_LIMITS, validateBodyComposition } from '../goals/validation';
import { hasComposition, pickComposition } from './bodyComposition';
import {
  getLatestWeight,
  momentOf,
  referenceWeights,
  suggestMoment,
  weightChangeSince,
  type WeighInMoment,
} from './weights';

interface WeightQuickLogProps {
  userId: string;
  date: string;
  currentWeight: number;
  /** Enregistre la pesée (et met à jour le profil si besoin) ; composition seulement si saisie */
  onSave: (weightKg: number, date: string, moment: WeighInMoment, composition?: BodyComposition) => Promise<void>;
}

type CompositionField = keyof BodyComposition;

const MOMENT_OPTIONS: { value: WeighInMoment; label: string }[] = [
  { value: 'morning', label: 'Le matin, à jeun' },
  { value: 'later', label: 'Plus tard dans la journée' },
];

/** Moment rappelé sous le titre : « Pesée de ce jour : 68,1 kg, le matin à jeun » */
const MOMENT_REMINDER: Record<WeighInMoment, string> = {
  morning: 'le matin à jeun',
  later: 'plus tard dans la journée',
};

/** Champs de composition : libellés courts (la carte est compacte) */
const COMPOSITION_INPUTS: { key: CompositionField; label: string }[] = [
  { key: 'body_fat_pct', label: 'Masse grasse (%)' },
  { key: 'muscle_mass_kg', label: 'Muscles (kg)' },
  { key: 'bone_mass_kg', label: 'Os (kg)' },
  { key: 'body_water_pct', label: 'Eau (%)' },
  { key: 'visceral_fat_rating', label: 'Graisse viscérale' },
];

const emptyComposition = (): Record<CompositionField, string> => ({
  body_fat_pct: '',
  muscle_mass_kg: '',
  bone_mass_kg: '',
  body_water_pct: '',
  visceral_fat_rating: '',
});

const parseDecimal = (value: string) => (value.trim() ? Number(value.replace(',', '.')) : undefined);

const formatOne = (value: number) => formatDecimal(value);

/** Résumé de la composition d'une pesée (ex : « Masse grasse 18,5 % · muscles 60,1 kg ») */
function compositionSummary(log: BodyComposition): string | null {
  const parts = [
    log.body_fat_pct != null && `masse grasse ${formatOne(Number(log.body_fat_pct))} %`,
    log.muscle_mass_kg != null && `muscles ${formatOne(Number(log.muscle_mass_kg))} kg`,
    log.body_water_pct != null && `eau ${formatOne(Number(log.body_water_pct))} %`,
    log.visceral_fat_rating != null && `graisse viscérale ${log.visceral_fat_rating}`,
  ].filter(Boolean) as string[];
  if (parts.length === 0) return null;
  const text = parts.join(' · ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function WeightQuickLog({ userId, date, currentWeight, onSave }: WeightQuickLogProps) {
  const [logs, setLogs] = useState<WeightLog[]>([]);
  const [value, setValue] = useState('');
  const [composition, setComposition] = useState(emptyComposition);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const isToday = date === getTodayDate();
  const [moment, setMoment] = useState<WeighInMoment>(() => suggestMoment({ isToday, hour: new Date().getHours() }));

  /** Recharge les pesées ; renvoie null si la lecture échoue */
  const loadLogs = useCallback(async (): Promise<WeightLog[] | null> => {
    try {
      const fresh = await fetchWeightLogs(userId, addDaysToDateString(getTodayDate(), -60));
      setLogs(fresh);
      return fresh;
    } catch (error) {
      // Non bloquant : le tableau de bord reste utilisable sans l'historique
      console.error('Error loading weight logs:', error);
      return null;
    }
  }, [userId]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  // « Dernière » et « sur 7 jours » : pesées de référence seulement
  const references = referenceWeights(logs);
  const latest = getLatestWeight(references);
  const change7d = weightChangeSince(references, addDaysToDateString(getTodayDate(), -7));
  const logForDate = logs.find((log) => log.date === date);
  const existingMoment = logForDate ? momentOf(logForDate) : null;
  // Sans poids saisi, « Mettre à jour » corrige seulement le moment de la pesée du jour
  const canChangeMomentOnly = logForDate !== undefined && moment !== existingMoment;

  // Moment proposé d'office : selon l'heure aujourd'hui, sinon celui de la pesée du jour
  useEffect(() => {
    setMoment(
      suggestMoment({ isToday, hour: new Date().getHours(), existing: existingMoment ? { moment: existingMoment } : null })
    );
  }, [date, isToday, existingMoment]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setMessage(null);

    const momentOnly = !value.trim() && canChangeMomentOnly;
    const weight = momentOnly && logForDate ? logForDate.weight_kg : Number(value.replace(',', '.'));
    const { min, max } = PROFILE_LIMITS.poids_kg;
    if (!Number.isFinite(weight) || weight < min || weight > max) {
      setMessage({ type: 'error', text: `Le poids doit être compris entre ${min} et ${max} kg.` });
      return;
    }

    const roundedWeight = Math.round(weight * 10) / 10;
    const measured = pickComposition(
      Object.fromEntries(COMPOSITION_INPUTS.map(({ key }) => [key, parseDecimal(composition[key])])) as BodyComposition
    );
    const compositionErrors = validateBodyComposition({ poids_kg: roundedWeight, ...measured });
    if (compositionErrors.length > 0) {
      setMessage({ type: 'error', text: compositionErrors.join(' ') });
      return;
    }

    // Le matin l'emporte : une pesée plus tard (autre poids) ne remplace pas celle du matin
    if (moment === 'later' && logForDate && existingMoment === 'morning' && roundedWeight !== logForDate.weight_kg) {
      setMessage({
        type: 'info',
        text: `Votre pesée du matin (${formatKg(logForDate.weight_kg)}) reste celle de ce jour. Pour la corriger, choisissez « Le matin, à jeun ».`,
      });
      return;
    }

    setSaving(true);
    try {
      if (hasComposition(measured)) {
        await onSave(roundedWeight, date, moment, measured);
      } else {
        await onSave(roundedWeight, date, moment);
      }
      setValue('');
      setComposition(emptyComposition());
      const fresh = await loadLogs();
      const outsideTracking =
        moment === 'later' && fresh !== null && !referenceWeights(fresh).some((log) => log.date === date);
      setMessage({
        type: 'success',
        text: outsideTracking
          ? 'Pesée enregistrée. Elle reste hors suivi : la pesée du matin sert de référence.'
          : 'Pesée enregistrée.',
      });
    } catch (error) {
      console.error('Error saving weight:', error);
      setMessage({ type: 'error', text: "La pesée n'a pas pu être enregistrée. Réessayez." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section aria-labelledby="weight-quick-log-title" data-tour="weight" className="panel p-4">
      <div className="flex flex-col gap-4 p-2 sm:flex-row sm:items-end sm:justify-between sm:p-4">
        <div>
          <h2 id="weight-quick-log-title" className="flex items-center gap-2 card-title">
            <Scale className="h-5 w-5" aria-hidden="true" />
            Ma pesée
          </h2>
          <p className="mt-1 text-sm text-muted">
            {latest ? (
              <>
                Dernière : <span className="font-semibold text-ink">{formatKg(latest.weight_kg)}</span>{' '}
                le {parseLocalDate(latest.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                {change7d !== null && (
                  <span className="text-subtle"> · {change7d > 0 ? '+' : ''}{formatKg(change7d)} sur 7 jours</span>
                )}
              </>
            ) : (
              <>Poids du profil : {formatKg(currentWeight)}. Enregistrez une pesée pour suivre votre évolution.</>
            )}
          </p>
          {latest && compositionSummary(latest) && (
            <p className="mt-0.5 text-xs text-subtle">{compositionSummary(latest)}</p>
          )}
          {logForDate && existingMoment && (
            <p className="mt-0.5 text-xs text-subtle">
              Pesée de ce jour : {formatKg(logForDate.weight_kg)}, {MOMENT_REMINDER[existingMoment]}
            </p>
          )}
        </div>

        <form id="weight-quick-log-form" onSubmit={handleSubmit} className="flex items-end gap-2">
          <div>
            <label htmlFor="weight-input" className="block text-xs font-medium text-muted mb-1">
              {isToday ? "Poids aujourd'hui (kg)" : 'Poids ce jour-là (kg)'}
            </label>
            <input
              id="weight-input"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              // Champ texte (clavier décimal) : accepte « 80,4 » comme « 80.4 ».
              // La validation des limites est faite à l'envoi.
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={String(logForDate?.weight_kg ?? currentWeight)}
              className="w-28 rounded-md border border-line-strong px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-600"
            />
          </div>
          <button
            type="submit"
            disabled={saving || (!value.trim() && !canChangeMomentOnly)}
            className="btn-brand disabled:opacity-50"
          >
            {saving ? 'Enregistrement…' : logForDate ? 'Mettre à jour' : 'Enregistrer'}
          </button>
        </form>
      </div>

      <fieldset className="mx-2 mb-3 sm:mx-4">
        <legend className="mb-1 text-xs font-medium text-muted">Moment de la pesée</legend>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {MOMENT_OPTIONS.map((option) => (
            <label key={option.value} className="flex items-center gap-2 text-sm text-body">
              <input
                type="radio"
                name="weigh-in-moment"
                form="weight-quick-log-form"
                value={option.value}
                checked={moment === option.value}
                onChange={() => setMoment(option.value)}
              />
              {option.label}
            </label>
          ))}
        </div>
        <p className="mt-1 text-xs text-subtle">
          Le matin, à jeun, après être passé aux toilettes : c'est la pesée la plus fiable.
        </p>
      </fieldset>

      <details className="mx-2 mb-2 rounded-md border border-line sm:mx-4">
        <summary className="cursor-pointer select-none px-3 py-2 text-sm text-body">
          Composition (facultatif)
        </summary>
        <div className="space-y-2 border-t border-line p-3">
          <p className="text-xs text-subtle">
            Valeurs de votre balance impédancemètre, enregistrées avec la pesée. Elles alimentent la courbe masse grasse /
            masse maigre (Tendances) et, pour la dernière pesée, le calcul de vos besoins.
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {COMPOSITION_INPUTS.map((field) => (
              <div key={field.key}>
                <label htmlFor={`weigh-in-${field.key}`} className="mb-1 block text-xs font-medium text-muted">
                  {field.label}
                </label>
                <input
                  id={`weigh-in-${field.key}`}
                  form="weight-quick-log-form"
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  value={composition[field.key]}
                  onChange={(e) => setComposition((current) => ({ ...current, [field.key]: e.target.value }))}
                  className="w-full rounded-md border border-line-strong px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600"
                />
              </div>
            ))}
          </div>
        </div>
      </details>

      {message && (
        <p
          role={message.type === 'error' ? 'alert' : 'status'}
          className={`px-2 pb-2 text-sm sm:px-4 ${
            message.type === 'error' ? 'text-danger-700' : message.type === 'info' ? 'text-body' : 'text-brand-700'
          }`}
        >
          {message.text}
        </p>
      )}
    </section>
  );
}
