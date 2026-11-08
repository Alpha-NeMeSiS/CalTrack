// Composition corporelle dans le temps (pesées avec composition) : masse
// grasse et masse maigre, chacune avec sa valeur actuelle, son évolution et
// une courbe à sa propre échelle (les deux masses n'ont pas le même ordre de
// grandeur). SVG sans dépendance, sans texte dans le dessin.
import type { WeightLog } from '../../lib/supabase';
import { compositionChange, compositionPoints, CompositionPoint } from '../../utils/bodyComposition';
import { parseLocalDate } from '../../utils/date';
import { formatKg, formatSigned } from '../../utils/format';

interface BodyCompositionChartProps {
  logs: readonly WeightLog[];
}

const WIDTH = 200;
const HEIGHT = 56;
const PAD = 4;

const formatSignedKg = (value: number) => `${formatSigned(value, 1)} kg`;
const formatDate = (date: string) => parseLocalDate(date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

function Sparkline({ points, values, label, strokeClass }: { points: CompositionPoint[]; values: number[]; label: string; strokeClass: string }) {
  const firstTime = parseLocalDate(points[0].date).getTime();
  const span = Math.max(1, parseLocalDate(points[points.length - 1].date).getTime() - firstTime);
  let min = Math.min(...values);
  let max = Math.max(...values);
  // Échelle minimale de 1 kg : une variation de 100 g ne doit pas paraître énorme
  if (max - min < 1) {
    const mid = (max + min) / 2;
    min = mid - 0.5;
    max = mid + 0.5;
  }
  const x = (date: string) => PAD + ((parseLocalDate(date).getTime() - firstTime) / span) * (WIDTH - 2 * PAD);
  const y = (value: number) => PAD + ((max - value) / (max - min)) * (HEIGHT - 2 * PAD);
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.date).toFixed(1)},${y(values[i]).toFixed(1)}`).join(' ');

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="none"
      className="mt-2 block h-14 w-full"
      role="img"
      aria-label={`${label} : de ${formatKg(values[0])} le ${formatDate(points[0].date)} à ${formatKg(values[values.length - 1])} le ${formatDate(points[points.length - 1].date)}`}
    >
      <path d={path} fill="none" className={strokeClass} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function BodyCompositionChart({ logs }: BodyCompositionChartProps) {
  const points = compositionPoints(logs);

  if (points.length === 0) {
    return (
      <p className="rounded-lg bg-surface-muted p-4 text-sm text-subtle">
        Pour suivre votre masse grasse et votre masse maigre, ajoutez la composition de votre balance impédancemètre
        lors de vos pesées (carte « Ma pesée », section « Composition »).
      </p>
    );
  }

  const last = points[points.length - 1];
  const change = compositionChange(points);
  const series = [
    { label: 'Masse grasse', values: points.map((p) => p.fatKg), current: last.fatKg, delta: change?.fatKg, strokeClass: 'stroke-warning-600' },
    { label: 'Masse maigre', values: points.map((p) => p.leanKg), current: last.leanKg, delta: change?.leanKg, strokeClass: 'stroke-brand-600' },
  ];

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {series.map((item) => (
          <div key={item.label} role="group" aria-label={item.label} className="rounded-lg border border-line bg-surface p-3">
            <div className="text-xs font-medium text-muted">{item.label}</div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-xl font-semibold text-ink">{formatKg(item.current)}</span>
              {item.delta !== undefined && <span className="text-sm text-muted">{formatSignedKg(item.delta)}</span>}
            </div>
            {points.length > 1 && <Sparkline points={points} values={item.values} label={item.label} strokeClass={item.strokeClass} />}
          </div>
        ))}
      </div>
      <p className="text-xs text-subtle">
        {change
          ? `Évolution depuis le ${formatDate(change.since)} (${points.length} mesures). Mesures d’impédancemètre : comparez-les dans les mêmes conditions (le matin, à jeun).`
          : `Mesure du ${formatDate(last.date)}. Ajoutez une deuxième mesure pour voir l’évolution.`}
      </p>
    </div>
  );
}
