// Carte « Eau » du journal : total du jour, progression vers l'objectif,
// ajout rapide (+ 250 ml, + 500 ml, quantité libre) et annulation.
import { useState } from 'react';
import { Droplet, Undo2 } from 'lucide-react';
import { formatLiters, QUICK_WATER_AMOUNTS, validateWaterAmount, waterProgress } from '../../utils/water';
import { formatNumber } from '../../utils/format';
import { Button } from '../ui/Button';
import { Field } from '../ui/Field';
import { useWaterDay } from './useWaterDay';

interface WaterCardProps {
  userId: string | undefined;
  date: string;
  /** Objectif du jour en ml (manuel ou automatique) */
  goalMl: number;
}

export function WaterCard({ userId, date, goalMl }: WaterCardProps) {
  const { totalMl, last, loading, error, busy, add, undoLast, reload } = useWaterDay(userId, date);
  const [customOpen, setCustomOpen] = useState(false);
  const [custom, setCustom] = useState('');
  const [customError, setCustomError] = useState<string | null>(null);

  const progress = waterProgress(totalMl, goalMl);

  const submitCustom = async () => {
    const amount = Number(custom.replace(',', '.'));
    const problem = validateWaterAmount(amount);
    if (problem) {
      setCustomError(problem);
      return;
    }
    setCustomError(null);
    if (await add(amount)) {
      setCustom('');
      setCustomOpen(false);
    }
  };

  return (
    <section aria-labelledby="water-title" className="panel p-4 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="water-title" className="card-title flex items-center gap-2">
          <Droplet className="h-5 w-5 text-info-600" aria-hidden="true" />
          Eau
        </h2>
        <p className="text-sm text-muted">
          <span className="text-lg font-bold text-ink">{formatLiters(totalMl)}</span> / {formatLiters(goalMl)}
        </p>
      </div>

      <div
        className="mt-3 h-3 w-full overflow-hidden rounded-full bg-surface-strong"
        role="progressbar"
        aria-label="Eau bue par rapport à l’objectif"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress.barPercent}
        aria-valuetext={`${formatLiters(totalMl)} sur ${formatLiters(goalMl)}`}
      >
        <div
          className={`h-full rounded-full transition-all duration-300 ${progress.reached ? 'bg-success-500' : 'bg-info-500'}`}
          style={{ width: `${progress.barPercent}%` }}
        />
      </div>
      <div className="mt-1 flex justify-between gap-2 text-xs">
        {progress.reached ? (
          <span className="font-semibold text-success-700">Objectif atteint · {formatNumber(progress.percent)} %</span>
        ) : (
          <span className="text-subtle">{formatNumber(progress.percent)} %</span>
        )}
        {!progress.reached && <span className="text-subtle">Encore {formatLiters(progress.remainingMl)}</span>}
      </div>

      {loading && <p className="mt-3 text-sm text-subtle">Chargement…</p>}

      {error && (
        <div role="alert" className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-danger-200 bg-danger-50 p-3 text-sm text-danger-700">
          <span>{error}</span>
          {!busy && (
            <Button variant="secondary" size="sm" onClick={() => void reload()}>
              Réessayer
            </Button>
          )}
        </div>
      )}

      {customOpen ? (
        <div className="mt-4 space-y-2">
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Field
                label="Quantité (ml)"
                type="number"
                inputMode="numeric"
                min={1}
                max={3000}
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                error={customError ?? undefined}
                hint="De 1 à 3 000 ml."
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="rounded-full" onClick={submitCustom} disabled={busy}>
              Ajouter
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="rounded-full"
              onClick={() => {
                setCustomOpen(false);
                setCustomError(null);
              }}
            >
              Annuler
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          {QUICK_WATER_AMOUNTS.map((amount) => (
            <Button key={amount} size="sm" className="rounded-full" onClick={() => void add(amount)} disabled={busy || !userId}>
              + {amount} ml
            </Button>
          ))}
          <Button variant="secondary" size="sm" className="rounded-full" onClick={() => setCustomOpen(true)} disabled={busy}>
            Autre…
          </Button>
        </div>
      )}

      {last && (
        <Button variant="ghost" size="sm" className="mt-2 -ml-2 text-primary-700" onClick={() => void undoLast()} disabled={busy}>
          <Undo2 className="h-4 w-4" aria-hidden="true" />
          Annuler le dernier (+ {formatNumber(last.amount_ml)} ml)
        </Button>
      )}
    </section>
  );
}
