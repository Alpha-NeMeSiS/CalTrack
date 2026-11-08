// Saisie rapide d'une pesée depuis le tableau de bord.
// Enregistre la pesée pour la date affichée (permet aussi de rattraper un jour
// passé), avec la composition facultative d'une balance impédancemètre, et
// affiche la dernière pesée avec l'évolution sur 7 jours.
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Scale } from 'lucide-react';
import type { BodyComposition, WeightLog } from '../../lib/supabase';
import { fetchWeightLogs } from '../../services/weights';
import { addDaysToDateString, getTodayDate, parseLocalDate } from '../../utils/date';
import { formatDecimal, formatKg } from '../../utils/format';
import { PROFILE_LIMITS, validateBodyComposition } from '../../utils/validation';
import { hasComposition, pickComposition } from '../../utils/bodyComposition';
import { getLatestWeight, weightChangeSince } from '../../utils/weights';

interface WeightQuickLogProps {
  userId: string;
  date: string;
  currentWeight: number;
  /** Enregistre la pesée (et met à jour le profil si besoin) ; composition seulement si saisie */
  onSave: (weightKg: number, date: string, composition?: BodyComposition) => Promise<void>;
}

type CompositionField = keyof BodyComposition;

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
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadLogs = useCallback(async () => {
    try {
      setLogs(await fetchWeightLogs(userId, addDaysToDateString(getTodayDate(), -60)));
    } catch (error) {
      // Non bloquant : le tableau de bord reste utilisable sans l'historique
      console.error('Error loading weight logs:', error);
    }
  }, [userId]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const latest = getLatestWeight(logs);
  const change7d = weightChangeSince(logs, addDaysToDateString(getTodayDate(), -7));
  const logForDate = logs.find((log) => log.date === date);
  const isToday = date === getTodayDate();

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setMessage(null);

    const weight = Number(value.replace(',', '.'));
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

    setSaving(true);
    try {
      if (hasComposition(measured)) {
        await onSave(roundedWeight, date, measured);
      } else {
        await onSave(roundedWeight, date);
      }
      setValue('');
      setComposition(emptyComposition());
      setMessage({ type: 'success', text: 'Pesée enregistrée.' });
      await loadLogs();
    } catch (error) {
      console.error('Error saving weight:', error);
      setMessage({ type: 'error', text: "La pesée n'a pas pu être enregistrée. Réessayez." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section aria-labelledby="weight-quick-log-title" className="panel p-4">
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
          <button type="submit" disabled={saving || !value} className="btn-brand disabled:opacity-50">
            {saving ? 'Enregistrement…' : logForDate ? 'Mettre à jour' : 'Enregistrer'}
          </button>
        </form>
      </div>

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
          className={`px-2 pb-2 text-sm sm:px-4 ${message.type === 'error' ? 'text-danger-700' : 'text-brand-700'}`}
        >
          {message.text}
        </p>
      )}
    </section>
  );
}
