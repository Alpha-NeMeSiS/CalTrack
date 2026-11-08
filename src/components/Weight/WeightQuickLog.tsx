// Saisie rapide d'une pesée depuis le tableau de bord.
// Enregistre la pesée pour la date affichée (permet aussi de rattraper un jour
// passé) et affiche la dernière pesée avec l'évolution sur 7 jours.
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Scale } from 'lucide-react';
import type { WeightLog } from '../../lib/supabase';
import { fetchWeightLogs } from '../../services/weights';
import { addDaysToDateString, getTodayDate, parseLocalDate } from '../../utils/date';
import { PROFILE_LIMITS } from '../../utils/validation';
import { getLatestWeight, weightChangeSince } from '../../utils/weights';

interface WeightQuickLogProps {
  userId: string;
  date: string;
  currentWeight: number;
  /** Enregistre la pesée (et met à jour le profil si besoin) */
  onSave: (weightKg: number, date: string) => Promise<void>;
}

const formatKg = (value: number) =>
  `${value.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg`;

export function WeightQuickLog({ userId, date, currentWeight, onSave }: WeightQuickLogProps) {
  const [logs, setLogs] = useState<WeightLog[]>([]);
  const [value, setValue] = useState('');
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

    setSaving(true);
    try {
      await onSave(Math.round(weight * 10) / 10, date);
      setValue('');
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
    <section aria-labelledby="weight-quick-log-title" className="card-kaizen">
      <div className="flex flex-col gap-4 p-2 sm:flex-row sm:items-end sm:justify-between sm:p-4">
        <div>
          <h2 id="weight-quick-log-title" className="flex items-center gap-2 text-lg text-shonen-700">
            <Scale className="h-5 w-5" aria-hidden="true" />
            Ma pesée
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            {latest ? (
              <>
                Dernière : <span className="font-semibold text-gray-900">{formatKg(latest.weight_kg)}</span>{' '}
                le {parseLocalDate(latest.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                {change7d !== null && (
                  <span className="text-gray-500"> · {change7d > 0 ? '+' : ''}{formatKg(change7d)} sur 7 jours</span>
                )}
              </>
            ) : (
              <>Poids du profil : {formatKg(currentWeight)}. Enregistrez une pesée pour suivre votre évolution.</>
            )}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex items-end gap-2">
          <div>
            <label htmlFor="weight-input" className="block text-xs font-medium text-gray-600 mb-1">
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
              className="w-28 rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-kaizen-500"
            />
          </div>
          <button type="submit" disabled={saving || !value} className="btn-kaizen disabled:opacity-50">
            {saving ? 'Enregistrement…' : logForDate ? 'Mettre à jour' : 'Enregistrer'}
          </button>
        </form>
      </div>

      {message && (
        <p
          role={message.type === 'error' ? 'alert' : 'status'}
          className={`px-2 pb-2 text-sm sm:px-4 ${message.type === 'error' ? 'text-red-700' : 'text-kaizen-700'}`}
        >
          {message.text}
        </p>
      )}
    </section>
  );
}
